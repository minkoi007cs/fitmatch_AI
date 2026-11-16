"""One authorized transport start; observer never owns/releases GPU byte0 or kills processes."""
import argparse
import ctypes as C
from ctypes import wintypes as W
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
import re
import uuid
from pathlib import Path
import subprocess
import sys
import time
import psutil

G = Path(r'<GPU_ROOT>')
Q = G / 'coordination'
P = G / 'worker-data/qwen-pilot/private'
OUT = G / 'reports/ai/qint_p/cat54/helper-preparation'
JOB = '1dadcac7-dbac-477c-a305-2f0c45644ab8'
APP = 'e6541f4f129b2fec16eedf1d275db8f612387eeb'
ADMISSION_SHA = 'bbbee7778eb8690fbaa9b0191d4acfea7d7e03cd0c9bdd8b3004bfa86a8b7b37'
MANIFEST_SHA = '74cb0422f2252612b1ecf855decbd29b8bc66191b8b128b8a90d39d8f702e162'
CONFIG_SHA = '584ec8e7775b8c603ad96d145ba6c0557e01fc496ba26a762d99ab9e2d938d4d'
APPROVAL_SHA = 'c9db71996dafbdb77c82738ae54223e114f56f18b73707f75d0db9e0e9acb926'
TRANSPORT_SHA = 'ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6'
GUARD_SHA = '47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c'
MODEL = 'ebb281ec70b05090aa6165b016eac8ec08e71b17'
OBSERVATION_SECONDS = 330
MIN_SLOT_REMAINING = 360


def utc():
    return datetime.now(timezone.utc).isoformat()


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    data = Path(path).read_bytes()
    if len(data) > 1024 * 1024:
        raise ValueError('Metadata exceeds bound')
    return json.loads(data.decode('utf-8-sig'))


def write_bytes(path, data):
    # In-place write preserves the existing owner-only file ACL.
    with Path(path).open('wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def save(path, value):
    write_bytes(path, (json.dumps(value, indent=2) + '\n').encode('utf-8'))


def validate_window(auth, slot, go, now):
    if not (auth.get('active') is True and auth.get('id') == go
            and auth.get('jobId') == JOB and auth.get('maxStarts') == 1
            and now < auth['notAfterUnix']):
        raise ValueError('No current exact-job execution GO')
    if not (slot.get('owner') == 'pc-ai'
            and slot['issuedAtUnix'] >= auth['minimumSlotIssuedUnix']
            and slot['issuedAtUnix'] <= now + 5
            and 599 <= slot['admitUntilUnix'] - slot['issuedAtUnix'] <= 601
            and MIN_SLOT_REMAINING <= slot['admitUntilUnix'] - now <= 600):
        raise ValueError('Require new 600s slot with at least 360s remaining')


def preflight(go):
    # Coordinator must issue the slot then standby WITHOUT a Python watcher.
    # Every other Python/Blender process is refused; no coordinator-name exemption.
    auth = read(Q / 'qint-p-qwen54-phase-b-execution-ready-20261116.json')['executionAuthorization']
    initial_slot_bytes = (Q / 'gpu0-slot.json').read_bytes()
    slot = json.loads(initial_slot_bytes.decode('utf-8-sig'))
    validate_window(auth, slot, go, time.time())
    ap = Q / 'qint-worker-qwen54-approval.json'
    cp = P / 'qwen54-worker.active.json'
    mp = P / 'qwen54-runtime-manifest.json'
    if (sha(ap), sha(cp), sha(mp)) != (APPROVAL_SHA, CONFIG_SHA, MANIFEST_SHA):
        raise ValueError('Approval/config/manifest pin mismatch')
    policy, config, manifest = read(ap), read(cp), read(mp)
    if not (policy['approved_job_id'] == JOB and policy['enabled'] is False
            and policy['app_revision'] == manifest['appRevision'] == APP
            and len(manifest['files']) == 111
            and all(sha(G / row['path']) == row['sha256'] for row in manifest['files'])
            and sha(policy['transport_path']) == TRANSPORT_SHA
            and config['engines']['garment.analyze']['revision'] == MODEL
            and config['engines']['garment.analyze']['timeoutSeconds'] == 240
            and config['engines']['garment.analyze']['drainSeconds'] == 30):
        raise ValueError('Reviewed source/job/model/bounds mismatch')
    if read(P / 'qwen48-offline-approval.json')['enabled'] or read(Q / 'qint-test-approval.json')['enabled']:
        raise ValueError('Offline/external guard approval must remain OFF')
    sys.path.insert(0, str(G / 'ai-service/qint_p_qwen54'))
    import worker_admission as admission
    if sha(admission.__file__) != ADMISSION_SHA or sha(admission.GUARD) != GUARD_SHA:
        raise ValueError('Admission/guard pin mismatch')
    admission.validate_worker_config(config, policy)
    identity = admission.coordinator_binding(policy)
    spec = importlib.util.spec_from_file_location('once_native_guard', admission.GUARD)
    guard = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(guard)
    guard.no_surviving_child()
    guard.validate_slot(slot, time.time())
    hb_name = auth['heartbeatReceipt']
    if Path(hb_name).name != hb_name or not hb_name.startswith('qint-p-qwen54-heartbeat-only-'):
        raise ValueError('Invalid heartbeat receipt reference')
    hb = read(Q / hb_name)
    age = time.time() - datetime.fromisoformat(hb['completedUTC']).timestamp()
    if not (hb['gatePass'] and hb['HTTPstatus'] == 200 and 0 <= age <= 600
            and hb['backendProjectRef'] == 'gohczmqykjkrgdblgbog'
            and hb['grantedCapabilities'] == ['garment.analyze']
            and hb['workerIdExpected'] == '8f1cc6bb-6446-4a7f-9d67-6144deba29be'
            and hb['configSHA256'] == CONFIG_SHA and hb['runtimeManifestSHA256'] == MANIFEST_SHA):
        raise ValueError('Fresh exact backend heartbeat required')
    ancestors = {item.pid for item in psutil.Process().parents()}
    native = []
    for proc in psutil.process_iter(['pid', 'name']):
        if proc.pid == os.getpid() or (proc.info['name'] or '').lower() not in {
                'python.exe', 'pythonw.exe', 'blender.exe', 'blender-launcher.exe'}:
            continue
        stamp = guard.live_stamp(proc.pid)
        args, exe, parent = proc.cmdline(), proc.exe(), proc.ppid()
        again = guard.live_stamp(proc.pid)
        own = (proc.pid in ancestors and Path(exe) == G / 'envs/qwen-vl/Scripts/python.exe'
               and args[1:] == ['-B', str(Path(__file__)), '--go', go])
        if not (own and stamp is not None and stamp == again):
            raise ValueError('Unreviewed GPU-capable process; coordinator must standby')
        native.append({'pid': proc.pid, 'creationFILETIME': stamp, 'recheckFILETIME': again,
                       'exe': exe, 'parent': parent, 'command': args})
    ram = psutil.virtual_memory().available
    free = int(subprocess.run(['nvidia-smi', '--query-gpu=memory.free',
               '--format=csv,noheader,nounits'], capture_output=True, text=True,
               timeout=15, check=True).stdout.strip().splitlines()[0])
    if ram < 4294967296 or free < 8192:
        raise ValueError('RAM/VRAM below reviewed gates')
    plan = read(P / 'connect45-worker.disabled.json')
    raw = (P / 'connect45-worker.env').read_text(encoding='utf-8').strip()
    if not raw.startswith('FITMATCH_WORKER_TOKEN='):
        raise ValueError('Token file shape mismatch')
    token = raw.split('=', 1)[1]
    if hashlib.sha256(token.encode()).hexdigest() != plan['tokenSHA256']:
        raise ValueError('Reserved token mismatch')
    root = Path(config['workDir'])
    if not root.is_dir() or (root / 'jobs' / JOB).exists():
        raise ValueError('Existing exact-job attempt; no retry')
    if any(read(old).get('stage') != 'completed' for old in root.glob('jobs/*/checkpoint.json')):
        raise ValueError('Unreviewed pending output')
    enabled = {**policy, 'enabled': True, 'reviews': {**policy['reviews'], 'backend_preflight': 'PASS'}}
    admission.validate_policy(enabled)
    # Freshly re-read GO and slot after IO/native/resource/token checks, before any activation.
    current_auth = read(Q / 'qint-p-qwen54-phase-b-execution-ready-20261116.json')['executionAuthorization']
    current_slot = read(Q / 'gpu0-slot.json')
    validate_window(current_auth, current_slot, go, time.time())
    current_slot_sha = sha(Q / 'gpu0-slot.json')
    if (current_auth != auth or current_slot != slot or sha(ap) != APPROVAL_SHA
            or current_slot_sha != hashlib.sha256(initial_slot_bytes).hexdigest()):
        raise ValueError('Execution binding changed during admission')
    prelaunch = {'observedAtUTC': utc(), 'targetDirectoryAbsent': not (root / 'jobs' / JOB).exists(),
                 'jobId': JOB, 'executionGO': go, 'slotSHA256': current_slot_sha,
                 'workerSHA256': TRANSPORT_SHA, 'workDir': str(root),
                 'workDirExclusivityBasis': 'reviewed_worker_main_DirLock_before_claim_control_path',
                 'workDirLockIndependentlyProbed': False}
    if not prelaunch['targetDirectoryAbsent']:
        raise ValueError('Target appeared before start; no replay')
    transport_argv = [policy['transport_python_exe'], policy['transport_path'], '--config', str(cp), '--once']
    return {'go': go, 'policyPath': ap, 'originalApproval': ap.read_bytes(),
            'prelaunchBinding': prelaunch, 'slotSHA256': current_slot_sha,
            'transportArgv': transport_argv, 'engineCommandTemplate': config['engines']['garment.analyze']['command'],
            'basePythonExe': policy['transport_python_exe'], 'observerPID': os.getpid(),
            'enabledPolicy': enabled, 'root': root, 'token': token, 'slot': slot,
            'configPath': cp, 'marker': P / 'qwen54-execute-once-20261116-attempt.json',
            'logPath': OUT / 'worker-once-20261116.private.log',
            'resultPath': Q / 'qint-p-qwen54-worker-result-20261116.json',
            'progressPath': Q / 'qint-p-qwen54-worker-progress-20261116.json',
            'startPath': Q / 'qint-p-qwen54-worker-start-20261116.json',
            'RAMAvailableBytes': ram, 'VRAMFreeMiB': free, 'lockIdentity': list(identity),
            'nativeCPULaunchers': native}


def checkpoint_view(plan):
    path = plan['root'] / 'jobs' / JOB / 'checkpoint.json'
    if not path.exists():
        return None
    value = read(path)
    instance = value.get('instance')
    attempt = value.get('attempt')
    if (value.get('jobId') != JOB or value.get('kind') != 'garment.analyze'
            or value.get('modelRevision') != {'model': 'Qwen/Qwen3-VL-4B-Instruct', 'revision': MODEL}
            or type(attempt) is not int
            or attempt != 1 or not isinstance(instance, str)
            or str(uuid.UUID(instance)) != instance
            or value.get('attemptDir') != f'a{attempt}-{instance[:8]}'):
        raise ValueError('Checkpoint not this first fresh attempt')
    view = {key: value.get(key) for key in ('jobId', 'kind', 'modelRevision', 'attempt',
            'instance', 'attemptDir', 'stage', 'adapterPid', 'updatedAt', 'completedAt')}
    view['observedAtUTC'] = utc()
    if value.get('stage') == 'inferring':
        if type(value.get('adapterPid')) is not int or value['adapterPid'] <= 0:
            raise ValueError('Inferring checkpoint lacks actual adapter PID')
        if 'inferringCheckpointObservation' not in plan:
            plan['inferringCheckpointObservation'] = dict(view)
    return view


def process_role(plan, pid, parent, exe, args, worker_pid):
    """Only exact operator-pinned argv is retained; unknown argv/env never enters receipts."""
    result = {'isWorker': False, 'isAdapter': False, 'argvRole': 'other_owned_descendant',
              'argvMatchesPinned': False, 'executable': None, 'matchedArgv': None,
              'observedAttemptDir': None}
    transport = plan['transportArgv']
    if (pid == worker_pid and parent == plan['observerPID']
            and Path(exe) == Path(transport[0]) and args == transport):
        result.update(isWorker=True, argvRole='worker', argvMatchesPinned=True,
                      executable=exe, matchedArgv=list(args))
        return result
    template = plan['engineCommandTemplate']
    if len(args) != len(template) or template.count('{input}') != 1 or template.count('{output}') != 1:
        return result
    input_path = Path(args[template.index('{input}')])
    output_path = Path(args[template.index('{output}')])
    expected_parent = plan['root'] / 'jobs' / JOB
    if (input_path.name != 'input.json' or input_path.parent.parent != expected_parent
            or not re.fullmatch(r'a1-[0-9a-f]{8}', input_path.parent.name)
            or output_path != input_path.parent / 'result.json'):
        return result
    expected = [item.replace('{input}', str(input_path)).replace('{output}', str(output_path))
                for item in template]
    allowed_exes = {Path(template[0]), Path(plan['basePythonExe'])}
    if Path(exe) not in allowed_exes or Path(args[0]) not in allowed_exes or args[1:] != expected[1:]:
        return result
    role = 'adapter_launcher' if Path(exe) == Path(template[0]) else 'adapter_interpreter'
    result.update(isAdapter=True, argvRole=role, argvMatchesPinned=True,
                  executable=exe, matchedArgv=list(args), observedAttemptDir=input_path.parent.name)
    return result


def completed_binding(plan):
    view = checkpoint_view(plan)
    if not view:
        return None
    path = plan['root'] / 'jobs' / JOB / 'checkpoint.json'
    value = read(path)
    output = value.get('output') or {}
    relative = Path(output.get('file', ''))
    expected = Path(view['attemptDir']) / 'result.json'
    output_path = path.parent / relative
    view['outputRelativePath'] = str(relative)
    view['outputBytes'] = output.get('bytes')
    view['checkpointOutputMatchesActualFile'] = bool(
        relative == expected and output_path.is_file() and not output_path.is_symlink()
        and output_path.stat().st_size == output.get('bytes')
        and sha(output_path) == output.get('sha256') and output.get('format') == 'json-v1')
    # No lease, input/image digest, result text/hash or private attributes are exported.
    return view


def admission_identity_binding(plan):
    observed = plan.get('inferringCheckpointObservation')
    if not observed:
        return None
    path = plan['root'] / 'jobs' / JOB / observed['attemptDir'] / 'qwen-events.jsonl'
    if not path.exists():
        return None
    data = path.read_bytes()
    if len(data) > 1024 * 1024:
        raise ValueError('Admission event trace exceeds bound')
    for line in data.decode('utf-8').splitlines():
        record = json.loads(line)
        if record.get('phase') == 'worker_admission':
            return {key: record.get(key) for key in ('actual_pid', 'actual_creation_time',
                    'worker_pid', 'worker_creation_time', 'placement')}
    return None


def native_creation_matches(record, pid, created):
    if not record or type(pid) is not int or not isinstance(created, (int, float)):
        return False
    return (record.get('pid') == pid and abs(record['nativeCreationFILETIME'] / 10000000
            - 11644473600 - created) <= .00001)


def control_flow_audit(plan, result):
    snapshot = result.get('nativeFinalSnapshot') or {}
    records = snapshot.get('records', [])
    checkpoint = result.get('privateCompletedCheckpointBinding')
    inferring = plan.get('inferringCheckpointObservation')
    admission = result.get('privateAdmissionIdentityBinding') or {}
    prelaunch = plan.get('prelaunchBinding') or {}
    workers = [r for r in records if r.get('isWorker') and r.get('pid') == result.get('workerPID')]
    adapters = [r for r in records if r.get('isAdapter')]
    worker = workers[0] if len(workers) == 1 else None
    actual = next((r for r in adapters if native_creation_matches(
        r, admission.get('actual_pid'), admission.get('actual_creation_time'))), None)
    launcher = next((r for r in adapters if inferring and r['pid'] == inferring['adapterPid']), None)
    # Every adapter ancestry edge must refer to a retained object with the same native identity.
    def ancestor_matches(child, parent_record):
        return bool(child and parent_record and child.get('observedParentPID') == parent_record['pid']
                    and child.get('observedParentCreationFILETIME') == parent_record['nativeCreationFILETIME'])
    ancestry = (ancestor_matches(launcher, worker) and actual is not None
                and (actual is launcher or ancestor_matches(actual, launcher)))
    local_complete = bool(
        prelaunch.get('targetDirectoryAbsent') is True and prelaunch.get('jobId') == JOB
        and prelaunch.get('executionGO') == plan['go'] and prelaunch.get('slotSHA256') == plan.get('slotSHA256')
        and result.get('singleStartMarkerConsumed') is True and result.get('workerStarts') == 1
        and result.get('workerExitCode') == 0 and result.get('workerApprovalOFF') is True
        and result.get('state') == 'WORKER_EXITED_OBSERVED_NATIVE_DRAIN'
        and snapshot.get('allObservedExited') is True and snapshot.get('unknownCount') == 0
        and len(records) >= 2 and worker and launcher and actual and ancestry
        and worker.get('argvMatchesPinned') is True and worker.get('argvRole') == 'worker'
        and all(r.get('argvMatchesPinned') is True for r in (launcher, actual))
        and all(r.get('nativeHandleSignalledExited') is True and r.get('nativeWaitResult') == 0 for r in records)
        and native_creation_matches(worker, admission.get('worker_pid'), admission.get('worker_creation_time'))
        and admission.get('placement') == 'worker_owns_byte0'
        and checkpoint and checkpoint.get('stage') == 'completed'
        and checkpoint.get('checkpointOutputMatchesActualFile') is True and inferring
        and all(checkpoint.get(key) == inferring.get(key) for key in
                ('jobId', 'kind', 'modelRevision', 'attempt', 'instance', 'attemptDir'))
        and all(r.get('observedAttemptDir') == inferring['attemptDir'] for r in (launcher, actual)))
    return {'kind': 'fitmatch.qwen48.worker-control-flow-drain.v1', 'jobId': JOB,
            'executionGO': plan['go'], 'slotSHA256': plan.get('slotSHA256'),
            'workerSHA256': TRANSPORT_SHA, 'localProducerEvidenceComplete': local_complete,
            'transportDrainEvidenceBasis': 'reviewed_completed_checkpoint_control_path'
                if local_complete else 'not_established',
            'counterIndependentlyRecorded': False, 'modelPythonUnloadCallbackExported': False,
            'canonicalServerResultVerification': 'PENDING_MAC_INDEPENDENT_CHECK',
            'coordinatorFreshNativeAndByte0Verification': 'PENDING_INDEPENDENT_CHECK',
            'localEvidenceVerifiedAtUTC': utc(), 'prelaunchBinding': prelaunch,
            'privateInferringCheckpointBinding': inferring,
            'privateCompletedCheckpointBinding': checkpoint,
            'privateAdmissionIdentityBinding': admission,
            'nativeProcessHandles': records}


class NativeObserver:
    def __init__(self, plan):
        self.plan = plan
        self.k = C.WinDLL('kernel32', use_last_error=True)
        self.k.OpenProcess.argtypes = [W.DWORD, W.BOOL, W.DWORD]
        self.k.OpenProcess.restype = W.HANDLE
        self.k.GetProcessTimes.argtypes = [W.HANDLE] + [C.POINTER(W.FILETIME)] * 4
        self.k.GetProcessTimes.restype = W.BOOL
        self.k.WaitForSingleObject.argtypes = [W.HANDLE, W.DWORD]
        self.k.WaitForSingleObject.restype = W.DWORD
        self.k.GetExitCodeProcess.argtypes = [W.HANDLE, C.POINTER(W.DWORD)]
        self.k.GetExitCodeProcess.restype = W.BOOL
        self.k.CloseHandle.argtypes = [W.HANDLE]
        self.k.CloseHandle.restype = W.BOOL
        self.handles = {}
        self.records = []
        self.errors = []

    def track(self, worker):
        try:
            root = psutil.Process(worker.pid)
            candidates = [root] + root.children(recursive=True)
        except psutil.NoSuchProcess:
            if worker.poll() is not None and self.handles:
                return
            raise RuntimeError('Worker exited before native handle retention')
        for proc in candidates:
            expected = proc.create_time()
            handle = self.k.OpenProcess(0x1000 | 0x100000, False, proc.pid)
            if not handle:
                self.errors.append({'pid': proc.pid, 'phase': 'OpenProcess', 'winerror': C.get_last_error()})
                raise RuntimeError('Native process observation unresolved')
            try:
                values = [W.FILETIME() for _ in range(4)]
                if not self.k.GetProcessTimes(handle, *(C.byref(v) for v in values)):
                    raise C.WinError(C.get_last_error())
                stamp = (values[0].dwHighDateTime << 32) | values[0].dwLowDateTime
                if abs(stamp / 10000000 - 11644473600 - expected) > .00001:
                    raise RuntimeError('PID creation identity changed')
                key = (proc.pid, stamp)
                if key not in self.handles:
                    parent = proc.ppid()
                    args, exe = proc.cmdline(), proc.exe()
                    role = process_role(self.plan, proc.pid, parent, exe, args, worker.pid)
                    parent_record = next((r for r in self.records if r['pid'] == parent), None)
                    state = int(self.k.WaitForSingleObject(handle, 0))
                    self.handles[key] = handle
                    self.records.append({'pid': proc.pid, 'nativeCreationFILETIME': stamp,
                                         'handleRetainedBeforeExit': state == 258, 'observedUTC': utc(),
                                         'observedParentPID': parent,
                                         'observedParentCreationFILETIME': parent_record['nativeCreationFILETIME']
                                             if parent_record else None, **role})
                    handle = None
            finally:
                if handle:
                    self.k.CloseHandle(handle)

    def snapshot(self):
        records = []
        unknown = len(self.errors)
        for record in self.records:
            row = dict(record)
            h = self.handles[(row['pid'], row['nativeCreationFILETIME'])]
            state = int(self.k.WaitForSingleObject(h, 0))
            code = W.DWORD()
            ok = self.k.GetExitCodeProcess(h, C.byref(code))
            row.update(nativeWaitResult=state, nativeHandleSignalledExited=state == 0,
                       exitCode=int(code.value) if ok else None)
            if state not in (0, 258) or not ok:
                unknown += 1
            records.append(row)
        return {'records': records, 'unknownCount': unknown,
                'liveCount': sum(not r['nativeHandleSignalledExited'] for r in records),
                'allObservedExited': bool(records) and unknown == 0
                    and all(r['nativeHandleSignalledExited'] for r in records),
                'observationErrors': list(self.errors)}

    def close(self):
        errors = []
        for key, handle in list(self.handles.items()):
            try:
                if not self.k.CloseHandle(handle):
                    errors.append({'pid': key[0], 'winerror': C.get_last_error()})
            except BaseException as error:
                errors.append({'pid': key[0], 'errorType': type(error).__name__})
        self.handles.clear()
        return errors


def read_outcome(root):
    checkpoint = root / 'jobs' / JOB / 'checkpoint.json'
    cp = read(checkpoint) if checkpoint.exists() else {}
    paths = sorted((root / 'jobs' / JOB).glob('a*/result.json'))
    result = read(paths[-1]) if paths else {}
    # Never include attributes, OCR, raw output/hash, image, lease or private input.
    return {'checkpointStage': cp.get('stage'), 'attempt': cp.get('attempt'),
            'resultPresent': bool(result), 'resultStatus': result.get('outcome'),
            'abstainReason': result.get('abstainReason'),
            'attributesNull': result.get('attributes') is None if result else None,
            'approvedForAutoApply': result.get('approvedForAutoApply'),
            'evidence': {k: result.get('evidence', {}).get(k)
                         for k in ('attempts', 'outputTokens', 'durationMs', 'gpuMiB')}}


def run_once(plan):
    """No retry/kill/GPU-lock release/slot write, including exception/deadline paths."""
    result = {'utc': utc(), 'executionGO': plan['go'], 'jobId': JOB,
              'state': 'START_NOT_ATTEMPTED', 'workerStarts': 0,
              'outerObservationSeconds': OBSERVATION_SECONDS,
              'automaticRetry': False, 'observerKilledProcess': False,
              'observerReleasedGPULock': False, 'observerWroteSlot': False,
              'anonymousAdapterJobIndependentlyQueried': False,
              'modelUnloadedIndependentlyVerified': False,
              'requiresIndependentCoordinatorDrainAndWithdraw': True}
    worker = native = log = None
    env = {}
    started = time.monotonic()
    deadline = min(started + OBSERVATION_SECONDS,
                   started + plan['slot']['admitUntilUnix'] - time.time() - 30)
    minimum_ram = None
    marker_created = False
    try:
        # Rechecking here makes the observation deadline meaningful even for delayed callers.
        if plan['slot']['admitUntilUnix'] - time.time() < MIN_SLOT_REMAINING:
            raise ValueError('Slot too short before activation')
        with plan['marker'].open('x', encoding='utf-8') as stream:
            json.dump({'utc': utc(), 'executionGO': plan['go'], 'jobId': JOB, 'maxWorkerStarts': 1,
                       'slotSHA256': plan.get('slotSHA256'), 'prelaunchBinding': plan.get('prelaunchBinding')}, stream)
        marker_created = True
        native = NativeObserver(plan)
        save(plan['policyPath'], plan['enabledPolicy'])
        result['workerApprovalSHA256Enabled'] = sha(plan['policyPath'])
        result['approvalChanges'] = ['enabled false to true', 'backend_preflight PENDING to PASS from current reviewed heartbeat/GO']
        log = plan['logPath'].open('xb')
        env = os.environ.copy()
        env['FITMATCH_WORKER_TOKEN'] = plan['token']
        env['PYTHONDONTWRITEBYTECODE'] = '1'
        policy = plan['enabledPolicy']
        worker = subprocess.Popen(plan['transportArgv'], cwd=plan['root'],
                  env=env, stdout=log, stderr=subprocess.STDOUT)
        result.update(workerStarts=1, workerPID=worker.pid, launchedUTC=utc(), state='OBSERVING')
        env.pop('FITMATCH_WORKER_TOKEN', None)
        plan['token'] = None
        save(plan['startPath'], {**result, 'RAMAvailableBytes': plan['RAMAvailableBytes'],
             'VRAMFreeMiB': plan['VRAMFreeMiB'], 'slot': plan['slot'], 'sourcePinsVerified': 111,
             'canonicalLockIdentity': plan['lockIdentity'], 'nativeCPULaunchers': plan['nativeCPULaunchers'],
             'prelaunchBinding': plan.get('prelaunchBinding'), 'slotSHA256': plan.get('slotSHA256')})
        print(json.dumps({'state': 'WORKER_STARTED', 'pid': worker.pid,
                          'executionGO': plan['go'], 'approvalSHA256': result['workerApprovalSHA256Enabled']}), flush=True)
        while True:
            if time.monotonic() >= deadline:
                result.update(state='QUARANTINE', failure='outer_observation_deadline')
                break
            checkpoint_view(plan)  # Preserve actual inferring adapterPid/instance before it clears.
            native.track(worker)
            snapshot = native.snapshot()
            if snapshot['unknownCount']:
                raise RuntimeError('Native wait/exit state unresolved')
            available = psutil.virtual_memory().available
            minimum_ram = available if minimum_ram is None else min(minimum_ram, available)
            save(plan['progressPath'], {'utc': utc(), 'workerPID': worker.pid,
                 'elapsedSeconds': round(time.monotonic() - started, 3),
                 'observedHandles': len(snapshot['records']), 'liveCount': snapshot['liveCount'],
                 'unknownCount': snapshot['unknownCount'], 'RAMAvailableBytes': available,
                 'privateInferringCheckpointBinding': plan.get('inferringCheckpointObservation')})
            code = worker.poll()
            if code is not None:
                result.update(workerExitCode=code, **read_outcome(plan['root']),
                              privateCompletedCheckpointBinding=completed_binding(plan),
                              privateAdmissionIdentityBinding=admission_identity_binding(plan))
                result['state'] = 'WORKER_EXITED_AWAIT_NATIVE_FINAL_SNAPSHOT'
                break
            time.sleep(.2)
    except BaseException as error:
        result.update(state='QUARANTINE' if worker is not None else 'START_FAILED_NO_WORKER',
                      failure=type(error).__name__)
    finally:
        env.pop('FITMATCH_WORKER_TOKEN', None)
        plan['token'] = None
        # Always attempt OFF, even on Popen/IO/observer exceptions and live/unknown trees.
        # OFF is revocation, not evidence that a worker drained or a slot may be withdrawn.
        try:
            write_bytes(plan['policyPath'], plan['originalApproval'])
            result['workerApprovalOFF'] = read(plan['policyPath']).get('enabled') is False
            result['workerApprovalSHA256Disabled'] = sha(plan['policyPath'])
        except BaseException as error:
            result.update(workerApprovalOFF=False, approvalDisableError=type(error).__name__, state='QUARANTINE')
        try:
            snapshot = native.snapshot() if native is not None else {
                'records': [], 'unknownCount': 1 if worker is not None else 0,
                'liveCount': 0, 'allObservedExited': False, 'observationErrors': []}
            result['nativeFinalSnapshot'] = snapshot
            if worker is not None:
                result['workerExitCode'] = worker.poll()
                if not snapshot['allObservedExited'] or result['workerExitCode'] is None:
                    result['state'] = 'QUARANTINE'
                elif result['state'] == 'WORKER_EXITED_AWAIT_NATIVE_FINAL_SNAPSHOT':
                    result['state'] = 'WORKER_EXITED_OBSERVED_NATIVE_DRAIN'
                    result['transportDrainPathReturned'] = False  # Set only after full same-run producer binding.
        except BaseException as error:
            result.update(state='QUARANTINE', nativeSnapshotError=type(error).__name__)
        result.update(utc=utc(), seconds=round(time.monotonic() - started, 3),
                      minimumSampledRAMAvailableBytes=minimum_ram, singleStartMarkerConsumed=marker_created)
        try:
            result['controlFlowDrainAudit'] = control_flow_audit(plan, result)
            result['transportDrainPathReturned'] = result['controlFlowDrainAudit']['localProducerEvidenceComplete']
        except BaseException as error:
            result.update(state='QUARANTINE', producerError=type(error).__name__, transportDrainPathReturned=False)
            result['controlFlowDrainAudit'] = {
                'localProducerEvidenceComplete': False, 'transportDrainEvidenceBasis': 'not_established',
                'counterIndependentlyRecorded': False, 'modelPythonUnloadCallbackExported': False}
        close_errors = []
        try:
            # Record actual wait states before closing our query/synchronize handles.
            save(plan['resultPath'], result)
        except BaseException as error:
            result.update(state='QUARANTINE', receiptWriteError=type(error).__name__, transportDrainPathReturned=False)
            result['controlFlowDrainAudit']['localProducerEvidenceComplete'] = False
            result['controlFlowDrainAudit']['transportDrainEvidenceBasis'] = 'not_established'
            print(json.dumps(result), flush=True)  # Bounded secret-free fallback receipt before close.
        finally:
            try:
                if native is not None:
                    close_errors.extend(native.close() or [])
            except BaseException as error:
                close_errors.append({'nativeCloseError': type(error).__name__})
            finally:
                try:
                    if log is not None:
                        log.close()
                except BaseException as error:
                    close_errors.append({'logCloseError': type(error).__name__})
        if close_errors:
            result.update(state='QUARANTINE', observerCloseErrors=close_errors, transportDrainPathReturned=False)
            result['controlFlowDrainAudit']['localProducerEvidenceComplete'] = False
            result['controlFlowDrainAudit']['transportDrainEvidenceBasis'] = 'not_established'
            try:
                save(plan['resultPath'], result)
            except BaseException as error:
                result['finalReceiptWriteError'] = type(error).__name__
    print(json.dumps(result), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--go', required=True, help='Exact NEW active Mac execution GO identifier')
    args = parser.parse_args()
    try:
        plan = preflight(args.go)
    except Exception as error:
        print(json.dumps({'state': 'CPU_REFUSED', 'errorType': type(error).__name__,
                          'workerStarted': False, 'claimGPUOrHeartbeatStarted': False}))
        return 75
    result = run_once(plan)
    return 0 if (result['state'] == 'WORKER_EXITED_OBSERVED_NATIVE_DRAIN'
                 and result.get('workerExitCode') == 0
                 and result.get('controlFlowDrainAudit', {}).get('localProducerEvidenceComplete') is True) else 75


if __name__ == '__main__':
    raise SystemExit(main())
