"""Bounded heartbeat-only window helper. Import/format tests do not read secrets or perform IO."""
import argparse
import ctypes as C
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import time
import urllib.request

G = Path(r'<GPU_ROOT>')
Q = G / 'coordination'
P = G / 'worker-data/qwen-pilot/private'
JOB = '1dadcac7-dbac-477c-a305-2f0c45644ab8'
APP = 'e6541f4f129b2fec16eedf1d275db8f612387eeb'
WORKER = '8f1cc6bb-6446-4a7f-9d67-6144deba29be'
REF = 'gohczmqykjkrgdblgbog'
ORIGIN = 'https://fitmatch.minkoi.org'
OFF_SHA = '72e26da104cd2dbcaf98ab951c68f1de95c7b763bf662abfa0d0f8be3703b921'
PINS = {'admission': 'bbbee7778eb8690fbaa9b0191d4acfea7d7e03cd0c9bdd8b3004bfa86a8b7b37',
        'manifest': '74cb0422f2252612b1ecf855decbd29b8bc66191b8b128b8a90d39d8f702e162',
        'config': '584ec8e7775b8c603ad96d145ba6c0557e01fc496ba26a762d99ab9e2d938d4d',
        'guard': '47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c',
        'coordinator': '789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039',
        'transport': 'ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6',
        'workerHelper': '7868dcfac0f200465076220604a0e6264c9ce03e49a28e3856dc10fa9a0427a5'}
HTTP_SECONDS = 15
NATIVE_SECONDS = 30
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
STAMP = re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$')


def utc():
    return datetime.now(timezone.utc).isoformat()


def datetime_ns(value):
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError('Explicit UTC offset required')
    delta = value.astimezone(timezone.utc) - EPOCH
    return (delta.days * 86400 + delta.seconds) * 1000000000 + delta.microseconds * 1000


def parse_stamp(original):
    """Python3.10 parser input is microsecond precision; age gates retain all source nanoseconds."""
    if not isinstance(original, str):
        raise ValueError('Timestamp must be a string')
    match = STAMP.fullmatch(original)
    if not match:
        raise ValueError('ISO timestamp with explicit offset required')
    base, fraction, offset = match.groups()
    fraction = fraction or ''
    offset = '+00:00' if offset == 'Z' else offset
    normalized = base + ('.' + fraction[:6] if fraction else '') + offset
    parsed = datetime.fromisoformat(normalized).astimezone(timezone.utc)
    remainder = int(fraction.ljust(9, '0') or '0') - parsed.microsecond * 1000
    return {'original': original, 'pythonParserInput': normalized,
            'utcMicrosecondRepresentation': parsed.isoformat(),
            'fractionRemainderNanoseconds': remainder,
            'epochNanoseconds': datetime_ns(parsed) + remainder}


def fresh_stamp(original, now, seconds):
    parsed = parse_stamp(original)
    age = datetime_ns(now) - parsed['epochNanoseconds']
    if not 0 <= age < seconds * 1000000000:
        raise ValueError('Timestamp is future or stale')
    return {**parsed, 'ageNanoseconds': age}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    data = Path(path).read_bytes()
    if len(data) > 1024 * 1024:
        raise ValueError('Metadata exceeds bound')
    return json.loads(data.decode('utf-8-sig'))


def approvals_off():
    ap = Q / 'qint-worker-qwen54-approval.json'
    return (sha(ap) == OFF_SHA and read(ap)['enabled'] is False
            and read(P / 'qwen48-offline-approval.json')['enabled'] is False
            and read(Q / 'qint-test-approval.json')['enabled'] is False)


def window_gate(args, reserve_seconds=0):
    # Existing HOLD/CLOSED/issue markers always refuse; never revive an old window.
    if '-' + args.window + '-' not in args.go_id:
        raise ValueError('Window/GoId mismatch')
    runtime = args.ready.parent
    if args.ready.name != 'APPROVAL_READY.json' or any((runtime / name).exists()
            for name in ('HOLD.json', 'CLOSED.json', 'ISSUE_EXITED_0.json')):
        raise ValueError('Window closed, held or issue already invoked')
    ready = read(args.ready)
    if not (ready.get('state') == 'APPROVAL_READY' and ready.get('goId') == args.go_id
            and ready.get('jobId') == JOB and ready.get('issueInvoked') is False
            and ready.get('withdrawInvoked') is False and ready.get('goWaitSeconds') == 300
            and ready.get('noPythonResidentWhileWaiting') is True):
        raise ValueError('Actual READY binding mismatch')
    now = datetime.now(timezone.utc)
    parsed = fresh_stamp(ready['readyAtUtc'], now, 300)
    before = parse_stamp(args.issue_before)
    deadline_ns = min(parsed['epochNanoseconds'] + 300000000000, before['epochNanoseconds'])
    if datetime_ns(now) + reserve_seconds * 1000000000 >= deadline_ns:
        raise ValueError('Window lacks time for bounded HTTP; no late heartbeat')
    return ready, parsed, sha(args.ready)


def preflight(args):
    ready, parsed, ready_sha = window_gate(args)
    started = time.monotonic()
    import psutil
    sys.path.insert(0, str(G / 'ai-service/qint_p_qwen54'))
    import worker_admission as admission
    cp, mp = P / 'qwen54-worker.prepared.json', P / 'qwen54-runtime-manifest.json'
    ap = Q / 'qint-worker-qwen54-approval.json'
    config, manifest, policy = read(cp), read(mp), read(ap)
    actual = {'admission': sha(admission.__file__), 'config': sha(cp), 'manifest': sha(mp),
              'guard': sha(admission.GUARD), 'coordinator': sha(Q / 'gpu-coordinator.json'),
              'transport': sha(policy['transport_path']),
              'workerHelper': sha(Path(__file__).with_name('execute-once-20261116.py'))}
    if actual != PINS or len(manifest['files']) != 111 or not all(
            sha(G / row['path']) == row['sha256'] for row in manifest['files']):
        raise ValueError('Reviewed pins mismatch')
    if not (approvals_off() and policy['approved_job_id'] == JOB
            and policy['app_revision'] == manifest['appRevision'] == APP
            and config['appUrl'] == ORIGIN
            and config['expectedBackend'] == {'projectRef': REF, 'appOrigin': ORIGIN}
            and set(config['engines']) == {'garment.analyze'}):
        raise ValueError('OFF approvals/job/backend binding mismatch')
    admission.validate_worker_config(config, policy)
    identity = admission.coordinator_binding(policy)
    spec = importlib.util.spec_from_file_location('heartbeat_native_guard', admission.GUARD)
    guard = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(guard)
    guard.no_surviving_child()
    historical = read(G / 'reports/qwen48-worker-window-001/readiness-private.json')
    records = []
    for saved in historical['currentSavedOwnedIdentityQueries']:
        pid, expected = saved['pid'], saved.get('savedCreationFILETIME')
        stamp = guard.live_stamp(pid)  # AccessDenied/unknown refuses, no privilege adjustment.
        if stamp is not None and (expected is None or stamp == expected):
            raise ValueError('Owned live or unknown saved native identity')
        records.append({'pid': pid, 'savedCreationFILETIME': expected, 'currentCreationFILETIME': stamp,
                        'status': 'absent_or_exited' if stamp is None else 'different_native_creation'})
        if time.monotonic() - started >= NATIVE_SECONDS:
            raise TimeoutError('Fresh native admission exceeded bound')
    state = read(guard.STATE)
    job_state = 'no_previous_named_job'
    if state.get('jobName'):
        handle = guard.open_job(4, False, state['jobName'])
        if not handle:
            if C.get_last_error() != 2:
                raise C.WinError(C.get_last_error())
            job_state = 'absent'
        else:
            try:
                account = guard.Accounting()
                guard.check(guard.query_job(handle, 1, C.byref(account), C.sizeof(account), None))
                if account.activeProcesses != 0:
                    raise ValueError('Prior named Job has live processes')
                job_state = 'queried_empty'
            finally:
                guard.close(handle)
    ancestors = {proc.pid for proc in psutil.Process().parents()}
    inventory = []
    for proc in psutil.process_iter(['pid', 'name']):
        if proc.pid == os_getpid() or (proc.info['name'] or '').lower() not in {
                'python.exe', 'pythonw.exe', 'blender.exe', 'blender-launcher.exe'}:
            continue
        stamp = guard.live_stamp(proc.pid)
        command, exe = proc.cmdline(), proc.exe()
        again = guard.live_stamp(proc.pid)
        own = (proc.pid in ancestors and Path(exe) == G / 'envs/qwen-vl/Scripts/python.exe'
               and command[1:] == ['-B', str(Path(__file__)), *sys.argv[1:]]
               and stamp is not None and stamp == again)
        if not own:
            raise ValueError('Unreviewed Python/renderer; coordinator must wait in PowerShell')
        inventory.append({'pid': proc.pid, 'creationFILETIME': stamp,
                          'recheckCreationFILETIME': again, 'exactOwnCPULauncher': True})
    import subprocess
    ram = psutil.virtual_memory().available
    free = int(subprocess.run(['nvidia-smi', '--query-gpu=memory.free',
        '--format=csv,noheader,nounits'], capture_output=True, text=True,
        check=True, timeout=10).stdout.strip().splitlines()[0])
    if ram < 4294967296 or free < 8192 or time.monotonic() - started >= NATIVE_SECONDS:
        raise ValueError('Fresh resource/native gate refused')
    # Re-read actual READY/age/pins after the checks, in this SAME invocation.
    ready2, parsed2, ready_sha2 = window_gate(args, HTTP_SECONDS)
    if ready2 != ready or ready_sha2 != ready_sha or not approvals_off():
        raise ValueError('READY or OFF approval changed during admission')
    facts = {'nativeClearAtUTC': utc(), 'sameOwnedLive': 0, 'unknownNativeQueries': 0,
             'nativeSavedIdentityQueries': records, 'priorNamedJobQuery': job_state,
             'nativeOwnCPULaunchers': inventory, 'RAMAvailableBytes': ram, 'VRAMFreeMiB': free,
             'canonicalLockIdentity': list(identity), 'sourcePinsVerified': 111,
             'nativeChecksDurationSeconds': round(time.monotonic() - started, 3),
             'actualPins': actual, 'readyTimestamp': parsed2, 'readyReceiptSHA256': ready_sha,
             'reportedGpuBusy': False, 'globalGPUIdleIndependentlyProven': False, 'byte0Probed': False}
    return config, facts


def os_getpid():
    import os
    return os.getpid()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def exclusive_write(path, data):
    import os
    with path.open('xb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def paths_for(window):
    if not re.fullmatch(r'W\d{3}', window):
        raise ValueError('Explicit fresh window ID required')
    return (P / f'qwen54-heartbeat-only-{window}-attempt.json',
            Q / f'qint-p-qwen54-heartbeat-only-{window}.json',
            Q / f'qwen54-window-{window[1:]}-heartbeat.json')


def send_once(args, config, facts):
    marker, original, copy = paths_for(args.window)
    if any(path.exists() for path in (marker, original, copy)):
        raise ValueError('Window already attempted or receipt path exists; no automatic retry')
    window_gate(args, HTTP_SECONDS)
    plan = read(P / 'connect45-worker.disabled.json')
    raw = (P / 'connect45-worker.env').read_text(encoding='utf-8').strip()
    if not raw.startswith('FITMATCH_WORKER_TOKEN=') or plan['registeredWorkerId'] != WORKER:
        raise ValueError('Reserved scoped credential binding mismatch')
    token = raw.split('=', 1)[1]
    if hashlib.sha256(token.encode()).hexdigest() != plan['tokenSHA256']:
        raise ValueError('Reserved credential mismatch')
    raw = None
    exclusive_write(marker, (json.dumps({'startedUTC': utc(), 'windowGoId': args.go_id,
        'maxPOSTs': 1, 'heartbeatOnly': True, 'readyAtUtcOriginal': facts['readyTimestamp']['original']}) + '\n').encode())
    engine = config['engines']['garment.analyze']
    payload = {'capabilities': {'garment.analyze': {'model': engine['model'], 'revision': engine['revision']}},
               'gpuBusy': False}
    result = {**facts, 'kind': 'fitmatch.qwen48.heartbeat-only.v1', 'startedUTC': utc(),
              'windowGoId': args.go_id, 'workerIdExpected': WORKER, 'maxPOSTs': 1,
              'appRevisionConfirmedByMac': APP, 'configSHA256': PINS['config'],
              'runtimeManifestSHA256': PINS['manifest'], 'admissionSHA256': PINS['admission'],
              'tokenHashMatchesReserved': True, 'tokenValueOrDigestPublished': False,
              'workerApprovalEnabled': False, 'claimSent': False, 'GPUOrModelStarted': False,
              'approvalWritten': False, 'slotWritten': False, 'automaticRetry': False}
    try:
        request = urllib.request.Request(ORIGIN + '/api/v2/worker/heartbeat', json.dumps(payload).encode(),
            {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}, method='POST')
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        with opener.open(request, timeout=HTTP_SECONDS) as response:
            status, body = response.status, response.read(65537)
        if len(body) > 65536:
            raise ValueError('HTTP body exceeds bound')
        reply = json.loads(body)
        backend, grants = reply.get('backend') or {}, reply.get('grantedCapabilities')
        result.update(HTTPstatus=status, appSuccess=reply.get('success') is True,
                      backendProjectRef=backend.get('projectRef'), grantedCapabilities=grants,
                      gatePass=status == 200 and reply.get('success') is True
                          and backend.get('projectRef') == REF and grants == ['garment.analyze'])
    except Exception as error:
        result.update(gatePass=False, HTTPstatus=getattr(error, 'code', None),
                      errorType=type(error).__name__, requestMayHaveReachedApp=True)
    finally:
        token = None
    result.update(completedUTC=utc(), workerApprovalSHA256=sha(Q / 'qint-worker-qwen54-approval.json'),
                  approvalUnchanged=sha(Q / 'qint-worker-qwen54-approval.json') == OFF_SHA,
                  allApprovalsRemainDisabled=approvals_off())
    result['gatePass'] = result['gatePass'] and result['approvalUnchanged'] and result['allApprovalsRemainDisabled']
    exclusive_write(original, (json.dumps(result, indent=2) + '\n').encode('utf-8'))
    copied = False
    if result['gatePass']:
        exclusive_write(copy, original.read_bytes())
        copied = original.read_bytes() == copy.read_bytes()
        if not copied:
            raise ValueError('Byte-exact receipt copy failed')
    return {'state': 'HEARTBEAT_PASS' if result['gatePass'] and copied else 'HEARTBEAT_FAILED_NO_RETRY',
            'HTTPstatus': result.get('HTTPstatus'), 'completedUTC': result['completedUTC'],
            'backendProjectRef': result.get('backendProjectRef'), 'grantedCapabilities': result.get('grantedCapabilities'),
            'originalReceipt': original.name, 'originalSHA256': sha(original), 'byteExactCopy': copied,
            'copyReceipt': copy.name if copied else None, 'copySHA256': sha(copy) if copied else None,
            'allApprovalsOFF': result['allApprovalsRemainDisabled'], 'claimGPUStarted': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--window', required=True)
    parser.add_argument('--go-id', required=True)
    parser.add_argument('--ready', required=True, type=Path)
    parser.add_argument('--issue-before', required=True, help='Actual root deadline with explicit UTC offset')
    parser.add_argument('--send', action='store_true', help='One explicitly authorized POST; default is read-only')
    args = parser.parse_args()
    marker = None
    try:
        marker, original, copy = paths_for(args.window)
        if any(path.exists() for path in (marker, original, copy)):
            raise ValueError('Consumed attempt or pre-existing output; refuse before native/HTTP')
        config, facts = preflight(args)
        if not args.send:
            print(json.dumps({'state': 'FRESH_NATIVE_READY_NO_HTTP', **facts, 'requestSent': False}))
            return 0
        report = send_once(args, config, facts)
        print(json.dumps(report))
        return 0 if report['state'] == 'HEARTBEAT_PASS' else 75
    except Exception as error:
        print(json.dumps({'state': 'REFUSED_OR_STOPPED_NO_AUTOMATIC_RETRY',
                          'errorType': type(error).__name__,
                          'HTTPAttemptMarkerExists': bool(marker and marker.exists()),
                          'noClaimGPUOrApprovalWrite': True}))
        return 75


if __name__ == '__main__':
    raise SystemExit(main())
