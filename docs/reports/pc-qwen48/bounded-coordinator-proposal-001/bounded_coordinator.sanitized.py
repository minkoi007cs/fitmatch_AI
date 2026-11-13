"""PROPOSAL: bounded issue-and-exit / post-drain-withdraw calls. Never launch AI.

No external guard wraps the worker. Root must see issue exit0 before starting AI.
Run only with a new operator GO; old GO155 is expired. No approval bypasses.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import ctypes as C
from ctypes import wintypes as W
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
JOB = '<root-reviewed-private-job-id>'
APP = 'f58024703bf4ec8be365bee2f8b3e1bd2248fdec'
PINS = {
    'policy': '789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039',
    'guard': '47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c',
    'worker': 'ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6',
    'admission': 'bbbee7778eb8690fbaa9b0191d4acfea7d7e03cd0c9bdd8b3004bfa86a8b7b37',
    'manifest': 'd79a0738e31f08e04de2fc41b8b825ef04e1f78732bcdaeae5ede3e58f383f0e',
    'config': '643b8b47b6eac98e27083ff4ea86e971a8e9fc4a733ef293917cd610abfcef31',
}
IDENTITY = (3699583840, 2251799814103012)


class Hold(RuntimeError):
    pass


def require(value, reason):
    if not value:
        raise Hold(reason)


def utc():
    return datetime.now(timezone.utc).isoformat()


def epoch(value):
    d = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(d.tzinfo is not None, 'timestamp_needs_timezone')
    return d.timestamp()


def read(path):
    require(path.stat().st_size <= 1048576, 'metadata_oversize')
    def constant(_):
        raise Hold('nonfinite_metadata')
    def pairs(items):
        d = {}
        for k, v in items:
            require(k not in d, 'duplicate_metadata_key')
            d[k] = v
        return d
    return json.loads(path.read_text(encoding='utf-8-sig'), parse_constant=constant, object_pairs_hook=pairs)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
    with path.open('x', encoding='utf-8') as f:
        f.write(json.dumps(value, indent=2, allow_nan=False) + '\n')


def inside(path):
    p = Path(path).resolve(strict=True)
    require(p.is_relative_to(ROOT.resolve()), 'path_outside_workspace')
    return p


def module(path, name):
    s = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


def validate_go(go, now):
    require(go.get('kind') == 'fitmatch.qwen48.operator-go.v1', 'wrong_go_kind')
    require(go.get('phase') == 'worker-single-job' and go.get('jobId') == JOB, 'wrong_job_or_phase')
    require(go.get('appSHA') == APP and go.get('pins') == PINS, 'go_pin_mismatch')
    require(go.get('backendReady') is True and go.get('oneEligibleJob') is True, 'backend_not_ready')
    require(type(go.get('slotSeconds')) is int and go['slotSeconds'] == 600
            and type(go.get('engineSeconds')) is int and go['engineSeconds'] == 240
            and type(go.get('drainSeconds')) is int and go['drainSeconds'] == 30
            and go.get('autoRenew') is False, 'wrong_bounds')
    require(isinstance(go.get('goId'), str) and 0 < len(go['goId']) <= 80
            and all(c.isalnum() or c in '-_' for c in go['goId']), 'bad_go_id')
    start, end = epoch(go['issuedAtUtc']), epoch(go['issueBeforeUtc'])
    require(0 < end - start <= 600 and start <= now and now + 2 < end, 'go_expired_or_not_yet_valid')
    require(isinstance(go.get('previousSlotSHA256'), str) and len(go['previousSlotSHA256']) == 64,
            'missing_previous_slot_pin')


def validate_heartbeat(h, go, now):
    stamp = epoch(h['observedAtUTC'])
    require(epoch(go['heartbeatNotBeforeUtc']) <= stamp <= now and now - stamp <= 180,
            'heartbeat_stale')
    require(h.get('HTTPstatus') == 200 and h.get('appSuccess') is True
            and h.get('backendProjectRef') == 'gohczmqykjkrgdblgbog'
            and h.get('grantedCapabilities') == ['garment.analyze'], 'heartbeat_binding_refused')
    require(h.get('configSHA256') == PINS['config'] and h.get('runtimeManifestSHA256') == PINS['manifest'],
            'heartbeat_old_pins')
    no_claim = ((type(h.get('claimsSent')) is int and h['claimsSent'] == 0)
                or h.get('claimSent') is False)
    require(h.get('GPUOrModelStarted') is False and no_claim,
            'heartbeat_started_execution')


def libraries():
    require(os.name == 'nt' and sys.version_info[:2] == (3, 10), 'requires_existing_windows_python310')
    paths = {'policy': ROOT/'coordination/gpu-coordinator.json',
             'guard': ROOT/'fitmatch_AI/workers/windows/gpu_guard.py',
             'worker': ROOT/'handoffs/app-native33-499ead0/scripts/worker/worker.py',
             'admission': ROOT/'ai-service/qint_p_qwen48/worker_admission.py',
             'manifest': ROOT/'worker-data/qwen-pilot/private/qwen48-runtime-manifest.json'}
    for key, path in paths.items():
        require(sha(path) == PINS[key], 'actual_pin_mismatch_' + key)
    w = module(paths['worker'], 'bounded_binding')
    g = module(paths['guard'], 'bounded_guard_primitives')
    binding = w.SharedGpuAdmission({'gpuCoordinator': {'path': str(paths['policy']), 'sha256': PINS['policy']},
                                    'gpuSlotOwner': 'pc-ai'})
    require(binding.lock_identity == IDENTITY, 'canonical_identity_mismatch')
    return w, g, binding, paths


def fresh_checks(w, g, binding, paths, out):
    import msvcrt
    import psutil
    a = read(ROOT/'coordination/qint-worker-qwen48-approval.json')
    require(a.get('enabled') is True and a.get('approved_job_id') == JOB
            and a.get('app_revision') == APP and a.get('config_sha256') == PINS['config']
            and a.get('transport_sha256') == PINS['worker']
            and a.get('coordinator_sha256') == PINS['policy'] and a.get('guard_sha256') == PINS['guard'],
            'worker_approval_not_exact_current_job')
    require(sha(inside(a['config_path'])) == PINS['config'], 'actual_config_mismatch')
    require(not read(ROOT/'coordination/qint-test-approval.json')['enabled']
            and not read(ROOT/'worker-data/qwen-pilot/private/qwen48-offline-approval.json')['enabled'],
            'external_or_offline_approval_enabled')
    manifest = read(paths['manifest'])
    require(len(manifest['files']) == 98, 'wrong_source_count')
    for entry in manifest['files']:
        p = inside(ROOT/entry['path'])
        require(p.suffix in ('.py', '.json') and p.stat().st_size < 2097152
                and sha(p) == entry['sha256'], 'source_pin_mismatch')
    prior = read(ROOT/'reports/<private-native-readiness-receipt>/readiness-private.json')
    queries = []
    for old in prior['currentSavedOwnedIdentityQueries']:
        current = g.live_stamp(old['pid'])  # AccessDenied is a HOLD, never ignored.
        saved = old['savedCreationFILETIME']
        require(current is None or (saved is not None and current != saved), 'saved_owned_object_live_or_unknown')
        queries.append({'pid': old['pid'], 'savedCreation': saved, 'currentCreation': current})
    state = read(ROOT/'coordination/gpu0-state.json')
    if state.get('jobName'):
        h = g.open_job(0x4, False, state['jobName'])
        if h:
            try:
                count = g.Accounting()
                g.check(g.query_job(h, 1, C.byref(count), C.sizeof(count), None))
                require(count.activeProcesses == 0, 'prior_native_job_not_empty')
            finally:
                g.close(h)
        else:
            require(C.get_last_error() == 2, 'prior_job_query_unknown')
    known = {'worker.py', 'worker_cli.py', 'model_worker.py', 'gpu_guard.py',
             'offline_regression48.py', 'template_drape.py', 'inference.py', 'fitting.py'}
    for p in psutil.process_iter(['pid', 'name']):
        if p.pid == os.getpid():
            continue
        name = (p.info['name'] or '').lower()
        if name == 'blender.exe' or name.startswith('python'):
            try:
                args = p.cmdline()
            except psutil.NoSuchProcess:
                continue
            require(name != 'blender.exe' and not known.intersection(Path(x).name.lower() for x in args[1:]),
                    'known_engine_process_present')
    ram = psutil.virtual_memory().available
    gpu = subprocess.run(['nvidia-smi', '--query-gpu=memory.free', '--format=csv,noheader,nounits'],
                         capture_output=True, text=True, check=True, timeout=10)
    free = int(gpu.stdout.strip())
    require(ram >= 4294967296 and free >= 8192, 'insufficient_RAM_or_VRAM')
    # stat + opened handle + native Win32 file index, not a path-only check.
    class Info(C.Structure):
        _fields_ = [('a', W.DWORD), ('c', W.FILETIME), ('r', W.FILETIME), ('w', W.FILETIME),
                    ('v', W.DWORD), ('sh', W.DWORD), ('sl', W.DWORD), ('n', W.DWORD),
                    ('ih', W.DWORD), ('il', W.DWORD)]
    fn = g.k.GetFileInformationByHandle
    fn.argtypes, fn.restype = [W.HANDLE, C.POINTER(Info)], W.BOOL
    with binding.lock_path.open('rb') as f:
        info = Info()
        g.check(fn(msvcrt.get_osfhandle(f.fileno()), C.byref(info)))
        native = (int(info.v), (int(info.ih) << 32) | int(info.il))
        require(native == w.file_identity(os.fstat(f.fileno())) == w.file_identity(os.stat(binding.lock_path))
                == IDENTITY, 'stat_fstat_native_identity_mismatch')
    result = {'atUtc': utc(), 'RAMAvailableBytes': ram, 'VRAMFreeMiB': free,
              'nativeQueries': queries, 'sourcePins': 98, 'canonicalIdentity': list(IDENTITY),
              'globalGPUIdleClaimed': False}
    save(out/'fresh-private.json', result)
    return result


def issue(go, out):
    validate_go(go, time.time())  # Before all native IO and before mutation.
    require(not (ROOT/'coordination'/('qint-g-' + go['goId'] + '-issued.json')).exists(), 'go_already_used')
    validate_heartbeat(read(inside(ROOT/go['heartbeatReceipt'])), go, time.time())
    w, g, b, paths = libraries()
    checks = fresh_checks(w, g, b, paths, out)
    slot_path = ROOT/'coordination/gpu0-slot.json'
    require(sha(slot_path) == go['previousSlotSHA256'], 'previous_slot_changed')
    before = read(slot_path)
    require(before['admitUntilUnix'] < time.time(), 'existing_slot_still_active')
    # Pin the existing file against replacement; no lock creation/deletion.
    with b.lock_path.open('rb') as retained:
        lock = b.make_lock()
        try:
            require(lock.acquire(0), 'byte0_busy_no_slot')
            require(w.file_identity(os.fstat(retained.fileno())) == IDENTITY
                    == w.file_identity(os.fstat(lock.handle.fileno())), 'opened_lock_changed')
            validate_go(go, time.time())
            require(sha(paths['policy']) == PINS['policy'] and sha(paths['guard']) == PINS['guard']
                    and sha(slot_path) == go['previousSlotSHA256'], 'binding_changed_before_write')
            g.no_surviving_child()
            now = time.time()
            validate_go(go, now)
            slot = {'version': 1, 'owner': 'pc-ai', 'issuedAtUtc': datetime.fromtimestamp(now, timezone.utc).isoformat(),
                    'issuedAtUnix': now, 'admitUntilUnix': now + 600,
                    'policy': 'Admission only; never preempt a held OS lock or running child'}
            g.validate_slot(slot, now)
            save(out/'allocation-attempt.json', {'atUtc': utc(), 'goId': go['goId'], 'attempts': 1})
            g.write(slot_path, slot)  # Existing reviewed atomic writer/finite schema; coordinator-only.
            save(out/'slot-applied.json', slot)  # Retain reconciliation evidence before any later reporting IO.
        finally:
            lock.release()
    require(read(slot_path) == slot, 'issued_slot_readback_mismatch_do_not_retry')
    receipt = {'kind': 'fitmatch.qwen48.bounded-issued.v1', 'goId': go['goId'], 'jobId': JOB,
               'issuedAtUtc': slot['issuedAtUtc'],
               'expiresAtUtc': datetime.fromtimestamp(slot['admitUntilUnix'], timezone.utc).isoformat(),
               'slotSHA256': sha(slot_path), 'slotFileIdDecimal': str(slot_path.stat().st_ino),
               'canonicalIdentity': list(IDENTITY), 'slotSeconds': 600, 'workerSHA256': PINS['worker'],
               'RAMAvailableBytes': checks['RAMAvailableBytes'], 'VRAMFreeMiB': checks['VRAMFreeMiB'],
               'newSlot': True, 'noRenewal': True, 'workerPlacement': 'direct --once; no external guard',
               'coordinatorExitsBeforeAIStart': True, 'state': 'ISSUED_WAIT_ACTUAL_DRAIN'}
    save(out/'issued.json', receipt)
    save(ROOT/'coordination'/('qint-g-' + go['goId'] + '-issued.json'), receipt)
    print(json.dumps(receipt), flush=True)
    # No long-lived Python watch: AI must start only after this process exit0.


def validate_drain(peer, issued):
    require(peer.get('kind') == 'fitmatch.qwen48.worker-drain.v1', 'need_actual_worker_drain_receipt')
    require(peer.get('jobId') == JOB and peer.get('slotSHA256') == issued['slotSHA256']
            and peer.get('workerSHA256') == PINS['worker'], 'drain_wrong_run')
    require(peer.get('allJobProcessesExited') is True
            and type(peer.get('activeProcessesAtDrain')) is int and peer['activeProcessesAtDrain'] == 0
            and type(peer.get('ownedLiveCount')) is int and peer['ownedLiveCount'] == 0
            and peer.get('quarantined') is False, 'owned_tree_not_drained')
    require(peer.get('modelUnloaded') is True and peer.get('allRetainedHandlesExited') is True,
            'need_actual_model_and_native_exit_evidence')
    handles = peer.get('nativeProcessHandles')
    require(isinstance(handles, list) and len(handles) >= 2, 'missing_real_native_handles')
    require(all(type(x.get('pid')) is int and x['pid'] > 0
                and type(x.get('creationFILETIME')) is int and x['creationFILETIME'] > 0
                and x.get('signalledExited') is True for x in handles), 'invalid_native_handle_evidence')
    require(epoch(peer['drainVerifiedAtUtc']) >= epoch(issued['issuedAtUtc']), 'old_drain_receipt')
    return handles


def withdraw(issued, peer, out):
    require(issued.get('kind') == 'fitmatch.qwen48.bounded-issued.v1' and issued.get('jobId') == JOB,
            'wrong_issued_receipt')
    go_id = issued.get('goId')
    require(isinstance(go_id, str) and 0 < len(go_id) <= 80
            and all(c.isalnum() or c in '-_' for c in go_id), 'bad_issued_go_id')
    require(read(ROOT/'coordination'/('qint-g-' + go_id + '-issued.json')) == issued,
            'issued_receipt_not_the_coordinator_record')
    handles = validate_drain(peer, issued)
    w, g, b, paths = libraries()
    for item in handles:
        current = g.live_stamp(item['pid'])
        require(current is None or current != item['creationFILETIME'], 'owned_native_object_still_live')
    slot_path = ROOT/'coordination/gpu0-slot.json'
    require(sha(slot_path) == issued['slotSHA256'], 'slot_changed_do_not_touch')
    old = read(slot_path)
    require(old['owner'] == 'pc-ai' and old['issuedAtUtc'] == issued['issuedAtUtc'], 'wrong_current_slot')
    lock = b.make_lock()
    try:
        require(lock.acquire(0), 'byte0_still_held_do_not_withdraw')
        require(w.file_identity(os.fstat(lock.handle.fileno())) == IDENTITY, 'held_identity_changed')
        require(sha(slot_path) == issued['slotSHA256'], 'slot_changed_while_checking')
        revised = dict(old)
        revised['admitUntilUnix'] = min(old['admitUntilUnix'], time.time())
        save(out/'withdrawal-attempt.json', {'atUtc': utc(), 'onlyChanged': ['admitUntilUnix']})
        g.write(slot_path, revised)
    finally:
        lock.release()
    require(read(slot_path) == revised, 'withdraw_readback_mismatch_no_retry')
    try:
        g.validate_slot(revised, time.time())
    except ValueError:
        pass
    else:
        raise Hold('withdrawn_admission_still_valid')
    import psutil
    gpu = subprocess.run(['nvidia-smi', '--query-gpu=memory.free,memory.used', '--format=csv,noheader,nounits'],
                         capture_output=True, text=True, timeout=10)
    receipt = {'kind': 'fitmatch.qwen48.bounded-withdrawn.v1', 'goId': issued['goId'],
               'atUtc': utc(), 'deadlineUtc': datetime.fromtimestamp(revised['admitUntilUnix'], timezone.utc).isoformat(),
               'slotSHA256': sha(slot_path), 'nativeHandlesFreshlyChecked': len(handles),
               'nativeOwnedLive': 0, 'actualPeerJobActiveCount': 0, 'canonicalByte0FreeAndReleased': True,
               'RAMAvailableBytes': psutil.virtual_memory().available, 'VRAMFreeUsedMiB': gpu.stdout.strip(),
               'onlyDeadlineShortened': True, 'newOwnerOrRenewal': False, 'nextJobAuthorized': False}
    save(out/'withdrawn.json', receipt)
    save(ROOT/'coordination'/('qint-g-' + issued['goId'] + '-withdrawn.json'), receipt)
    print(json.dumps(receipt), flush=True)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('action', choices=['check-go', 'issue', 'withdraw'])
    p.add_argument('--go', type=Path)
    p.add_argument('--issued', type=Path)
    p.add_argument('--peer-drain', type=Path)
    p.add_argument('--out', type=Path)
    p.add_argument('--execute', action='store_true')
    a = p.parse_args()
    created = False
    try:
        if a.action == 'check-go':
            validate_go(read(inside(a.go)), time.time())
            print(json.dumps({'state': 'GO_SHAPE_VALID_ONLY_NO_ADMISSION'}))
            return 0
        require(a.execute, 'execute_flag_required_no_mutation')
        require(a.out is not None and a.out.is_absolute() and a.out.parent.resolve().is_relative_to((ROOT/'reports').resolve()),
                'new_evidence_dir_must_be_inside_reports')
        require(not a.out.exists(), 'evidence_dir_exists_no_overwrite_or_retry')
        if a.action == 'issue':
            go = read(inside(a.go))
            validate_go(go, time.time())
            a.out.mkdir()
            created = True
            issue(go, a.out)
        else:
            issued, peer = read(inside(a.issued)), read(inside(a.peer_drain))
            validate_drain(peer, issued)
            a.out.mkdir()
            created = True
            withdraw(issued, peer, a.out)
        return 0
    except (Hold, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        # Never terminate, delete, renew, retry or release someone else's lock on error.
        result = {'state': 'HOLD_NO_AUTOMATIC_RETRY', 'reasonType': type(error).__name__,
                  'reason': str(error) if isinstance(error, Hold) else 'query_or_metadata_error',
                  'winerror': getattr(error, 'winerror', None)}
        print(json.dumps(result), flush=True)
        if created and not (a.out/'hold.json').exists():
            save(a.out/'hold.json', result)
        return 75


if __name__ == '__main__':
    raise SystemExit(main())
