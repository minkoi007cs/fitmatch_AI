"""Unit tests for worker checkpoint safety and error classification (stdlib unittest, no network)."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import time
import unittest

spec = importlib.util.spec_from_file_location('worker', Path(__file__).with_name('worker.py'))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

JOB_ID = '11111111-2222-4333-8444-555555555555'


def glb_bytes(extra=b'\0' * 8):
    body = struct.pack('<III', 0x46546C67, 2, 12 + len(extra)) + extra
    return body


def job(revision='r'):
    return {'jobId': JOB_ID, 'modelId': 'm1', 'kind': 'avatar.reconstruct', 'modelRevision': {'model': 'x', 'revision': revision},
            'lease': {'token': 't', 'attempt': 1},
            'input': {'params': {'heightCm': 170}, 'assets': [{'role': 'front', 'assetId': 'a', 'sha256': 's', 'bytes': 1}]}}


class CheckpointTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())

    def make(self, revision='r', tamper=False, file_name='a1-x/output.glb'):
        cp = worker.Checkpoint(self.root, JOB_ID)
        out = cp.dir / 'a1-x' / 'output.glb'
        out.parent.mkdir(parents=True)
        data = glb_bytes()
        out.write_bytes(data)
        sha = hashlib.sha256(data).hexdigest()
        j = job(revision)
        cp.save(jobId=JOB_ID, modelId='m1', kind='avatar.reconstruct', modelRevision=j['modelRevision'],
                inputDigest=worker.input_digest(j), stage='finalized', leaseToken='t',
                output={'file': file_name, 'bytes': len(data), 'sha256': sha})
        if tamper:
            out.write_bytes(glb_bytes(b'\1' * 8))
        reloaded = worker.Checkpoint(self.root, JOB_ID)
        reloaded.load()
        return reloaded

    def test_valid_output_is_reused(self):
        cp = self.make()
        self.assertIsNotNone(cp.recoverable_output(job(), worker.input_digest(job())))

    def test_tampered_output_is_refused(self):
        cp = self.make(tamper=True)
        self.assertIsNone(cp.recoverable_output(job(), worker.input_digest(job())))

    def test_other_engine_revision_is_refused(self):
        cp = self.make()
        other = job('newer')
        self.assertIsNone(cp.recoverable_output(other, worker.input_digest(other)))

    def test_path_outside_job_dir_is_refused(self):
        cp = self.make(file_name='../../../outside.glb')
        (self.root / 'outside.glb').write_bytes(glb_bytes())
        self.assertIsNone(cp.recoverable_output(job(), worker.input_digest(job())))

    def test_garbage_checkpoint_is_set_aside_not_deleted(self):
        cp = worker.Checkpoint(self.root, JOB_ID)
        cp.dir.mkdir(parents=True)
        cp.file.write_text('{not json', encoding='utf8')
        self.assertIsNone(cp.load())
        self.assertFalse(cp.file.exists())
        self.assertEqual(len(list(cp.dir.glob('checkpoint.rejected.*.json'))), 1)

    def test_unknown_version_is_set_aside(self):
        cp = worker.Checkpoint(self.root, JOB_ID)
        cp.dir.mkdir(parents=True)
        cp.file.write_text(json.dumps({'version': 99}), encoding='utf8')
        self.assertIsNone(cp.load())

    def test_job_id_must_be_uuid(self):
        for bad in ('../x', 'a/b', '', 'not-a-uuid'):
            with self.assertRaises(ValueError):
                worker.Checkpoint(self.root, bad)


class ClassificationTests(unittest.TestCase):
    def test_exit_codes_follow_structured_adapter_contract(self):
        err = Path(tempfile.mkdtemp()) / 'adapter.err'
        def classify(code, text, engine=None):
            err.write_text(text, encoding='utf8')
            return worker.classify_exit(code, engine or {}, err)
        disabled = '{"success":false,"code":"MODEL_UNAVAILABLE","reason":"SiTH adapter is disabled"}'
        invalid = '{"success":false,"code":"INVALID_INPUT","reason":"Invalid manifest JSON"}'
        self.assertEqual(classify(78, disabled), 'MODEL_UNAVAILABLE')            # actual PC adapter (draft PR1)
        self.assertEqual(classify(2, invalid), 'INVALID_INPUT')                   # actual PC adapter
        self.assertEqual(classify(2, 'usage: sith_avatar.py [-h] --input INPUT'), 'INFERENCE_FAILED')  # argparse, non-JSON
        self.assertEqual(classify(2, disabled), 'INFERENCE_FAILED')              # code/exit mismatch
        self.assertEqual(classify(78, ''), 'INFERENCE_FAILED')                    # missing record
        self.assertEqual(classify(1, 'Traceback ... CUDA out of memory'), 'INFERENCE_FAILED')  # no traceback guessing
        self.assertEqual(classify(3, '{"success":false,"code":"OOM"}'), 'INFERENCE_FAILED')    # 3 is not agreed
        oom = {'exitCodes': {'3': 'OOM', '9': 'NOT_A_CODE'}}
        self.assertEqual(classify(3, '{"success":false,"code":"OOM"}', oom), 'OOM')           # operator-configured
        self.assertEqual(classify(9, '{"success":false,"code":"NOT_A_CODE"}', oom), 'INFERENCE_FAILED')
        self.assertEqual(classify(78, 'noise\n' + disabled + '\n'), 'MODEL_UNAVAILABLE')     # last line wins

    def test_adapter_environment_drops_secrets(self):
        token = 'fmw_' + 'z' * 43
        saved = dict(os.environ)
        try:
            os.environ.update({'FITMATCH_WORKER_TOKEN': token, 'FITMATCH_WORKER_TOKEN_2': 'x', 'MY_API_KEY': 'k',
                               'SUPABASE_SERVICE_ROLE_KEY': 'k', 'HF_TOKEN': 'h', 'COPY': 'prefix-' + token, 'SAFE_VALUE': 'ok'})
            env = worker.adapter_environment(token)
        finally:
            os.environ.clear()
            os.environ.update(saved)
        for name in ('FITMATCH_WORKER_TOKEN', 'FITMATCH_WORKER_TOKEN_2', 'MY_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'HF_TOKEN', 'COPY'):
            self.assertNotIn(name, env)
        self.assertEqual(env.get('SAFE_VALUE'), 'ok')

    def test_job_failure_unknown_code_maps_to_inference_failed(self):
        self.assertEqual(worker.JobFailure('WHATEVER').code, 'INFERENCE_FAILED')
        self.assertEqual(worker.JobFailure('TIMEOUT').code, 'TIMEOUT')


class InputNameTests(unittest.TestCase):
    def test_media_type_wins_and_legacy_roles_still_work(self):
        self.assertEqual(worker.input_name(0, {'role': 'video', 'mediaType': 'video/webm'}), 'input-0.webm')
        self.assertEqual(worker.input_name(1, {'role': 'face', 'mediaType': 'image/jpeg'}), 'input-1.jpg')
        self.assertEqual(worker.input_name(2, {'role': 'front'}), 'input-2.jpg')
        self.assertEqual(worker.input_name(3, {'role': 'garment'}), 'input-3.glb')
        self.assertEqual(worker.input_name(4, {'role': 'video', 'mediaType': 'text/html'}), 'input-4.bin')


class GpuLockTests(unittest.TestCase):
    def test_one_gpu_job_per_host_across_workers(self):
        path = Path(tempfile.mkdtemp()) / 'gpu.lock'
        a, b = worker.FileLock(path), worker.FileLock(path)
        self.assertTrue(a.acquire(0))
        self.assertTrue(a.acquire(0), 're-entrant for the holder')
        self.assertFalse(b.acquire(0), 'second worker (other owner/workDir) must wait')
        self.assertIsNone(b.handle, 'failed acquisition closes its descriptor')
        if os.name == 'nt':
            self.assertEqual(a.fds(), (), 'Windows uses containment instead of pass_fds')
        else:
            self.assertNotEqual(a.fds(), (), 'adapter inherits the GPU lock on POSIX')
        a.release()
        self.assertEqual(a.fds(), ())
        self.assertTrue(b.acquire(0))
        b.release()
        self.assertIsNone(a.handle)
        self.assertIsNone(b.handle)
        self.assertTrue(a.acquire(0), 'released lock can be reopened')
        a.release()


    def test_independent_process_exclusion_and_crash_release(self):
        # No GPU/model/server required; OS releases this test child's lock on death.
        child_code = """
import importlib.util, sys
spec = importlib.util.spec_from_file_location('worker', sys.argv[1])
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)
lock = w.FileLock(sys.argv[2])
if not lock.acquire(0):
    raise SystemExit(4)
import os
print('LOCKED', os.getpid(), flush=True)
sys.stdin.read()
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'gpu.lock'
            marker = Path(directory) / 'ready.txt'
            with marker.open('w') as output:
                # Test-only (CL-WINTEST-01): a Windows venv python.exe is a launcher that spawns the
                # base interpreter, so Popen.pid would be the launcher and kill() would leave the
                # real lock holder alive. This child is stdlib-only, so start the base interpreter
                # directly and assert below that the PID we kill is the one holding the lock.
                interpreter = getattr(sys, '_base_executable', None) or sys.executable
                child = subprocess.Popen(
                    [interpreter, '-I', '-c', child_code,
                     str(Path(__file__).with_name('worker.py').resolve()), str(path)],
                    stdin=subprocess.PIPE, stdout=output, stderr=subprocess.DEVNULL)
                probe = worker.FileLock(path)
                try:
                    import time
                    deadline = time.monotonic() + 10
                    while not marker.read_text().startswith('LOCKED '):
                        self.assertIsNone(child.poll(), 'lock-holder child failed')
                        self.assertLess(time.monotonic(), deadline, 'child readiness timeout')
                        time.sleep(0.02)
                    holder = int(marker.read_text().split()[1])
                    self.assertEqual(holder, child.pid, 'the process we kill must be the lock holder, not a launcher')
                    self.assertFalse(probe.acquire(0), 'another process must be excluded')
                    self.assertIsNone(probe.handle)
                    child.kill()  # only this test-owned child; simulate abrupt worker death
                    child.wait(timeout=10)
                    self.assertTrue(probe.acquire(0), 'OS releases lock after process death')
                finally:
                    probe.release()
                    # EOF first: any process still reading stdin exits even if kill() missed it.
                    child.stdin.close()
                    if child.poll() is None:
                        child.kill()
                    child.wait(timeout=10)


class ContainmentTests(unittest.TestCase):
    def failing(self):
        raise OSError(5, 'access denied')

    def test_windows_binding_failure_refuses_to_start(self):
        with self.assertRaises(worker.ContainmentError):
            worker.ensure_process_containment({}, platform='nt', binder=self.failing)

    def test_windows_binding_success(self):
        self.assertEqual(worker.ensure_process_containment({}, platform='nt', binder=lambda: object()), 'windows-job-object')

    def test_windows_explicit_disabled_mode_runs_with_warning(self):
        mode = worker.ensure_process_containment({'processContainment': 'unsafe-disabled'}, platform='nt', binder=self.failing)
        self.assertEqual(mode, 'disabled-by-operator')

    def test_unknown_mode_is_rejected_everywhere(self):
        for platform in ('nt', 'posix'):
            with self.assertRaises(worker.ContainmentError):
                worker.ensure_process_containment({'processContainment': 'off'}, platform=platform, binder=lambda: object())

    def test_posix_uses_session_and_dirlock(self):
        self.assertEqual(worker.ensure_process_containment({}, platform='posix', binder=self.failing), 'posix-session+dirlock')


def _alive(pid):
    """Non-zombie process with this pid exists (Linux /proc when available)."""
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    stat = Path('/proc') / str(pid) / 'stat'
    if stat.exists():
        text = stat.read_text()
        return text[text.rfind(')') + 2:].split()[0] != 'Z'
    return True


@unittest.skipIf(os.name == 'nt', 'POSIX process-group drain; Windows uses the per-job Job Object (native PC test)')
class QuiescenceTests(unittest.TestCase):
    """PC-QUIESCENCE-01: a launcher exiting must not count as the adapter tree being gone."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        # Foreign sentinel: not part of any adapter tree, must survive every drain.
        self.sentinel = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(120)'], start_new_session=True)
        self.addCleanup(lambda: (self.sentinel.kill(), self.sentinel.wait()))

    def launcher_leaving(self, child_code):
        """Launcher that starts the 'real interpreter' (a grandchild) and exits at once, like a venv python.exe
        whose child keeps running. The grandchild writes its pid so the test can watch it."""
        pidfile = self.tmp / 'grandchild.pid'
        code = ('import subprocess, sys; p = subprocess.Popen([sys.executable, "-c", %r]); '
                'open(%r, "w").write(str(p.pid))') % (child_code, str(pidfile))
        tree = worker.OwnedProcessTree([sys.executable, '-c', code], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        tree.process.wait(timeout=10)
        deadline = time.monotonic() + 10
        while not pidfile.exists() or not pidfile.read_text():
            self.assertLess(time.monotonic(), deadline)
            time.sleep(0.02)
        return tree, int(pidfile.read_text())

    def test_old_launcher_poll_reports_done_while_grandchild_runs(self):
        # Reproduces the finding with the previous behaviour: stop_process() returns immediately.
        tree, grandchild = self.launcher_leaving('import time; time.sleep(60)')
        try:
            worker.stop_process(tree.process)
            self.assertTrue(_alive(grandchild), 'gap reproduced: launcher done, owned interpreter still running')
        finally:
            self.assertTrue(tree.drain(10))

    def test_drain_waits_for_and_stops_owned_grandchild_only(self):
        tree, grandchild = self.launcher_leaving('import time; time.sleep(60)')
        self.assertIsNotNone(tree.poll(), 'launcher already exited')
        self.assertTrue(tree.alive(), 'tree is alive while the owned interpreter runs')
        self.assertTrue(tree.drain(10))
        self.assertFalse(_alive(grandchild))
        self.assertFalse(tree.alive())
        self.assertIsNone(self.sentinel.poll(), 'foreign process untouched')

    def test_sigterm_ignoring_grandchild_is_killed_after_grace(self):
        tree, grandchild = self.launcher_leaving(
            'import signal, time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(60)')
        started = time.monotonic()
        self.assertTrue(tree.drain(timeout=10, grace=0.5))
        self.assertFalse(_alive(grandchild))
        self.assertLess(time.monotonic() - started, 8)
        self.assertIsNone(self.sentinel.poll())

    def test_exited_grandchild_left_as_zombie_counts_as_drained(self):
        tree, grandchild = self.launcher_leaving('pass')
        deadline = time.monotonic() + 10
        while _alive(grandchild):
            self.assertLess(time.monotonic(), deadline)
            time.sleep(0.05)
        self.assertFalse(tree.alive())
        self.assertTrue(tree.drain(1))

    def test_gpu_lock_is_held_until_the_owned_tree_is_drained(self):
        path = self.tmp / 'gpu-0.lock'
        gpu = worker.FileLock(path)
        self.assertTrue(gpu.acquire(0))
        tree, grandchild = self.launcher_leaving('import time; time.sleep(60)')
        probe_code = ('import fcntl, sys; f = open(sys.argv[1], "a+")\n'
                      'try:\n fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB); print("got")\n'
                      'except OSError:\n print("busy")')
        probe = lambda: subprocess.run([sys.executable, '-c', probe_code, str(path)], capture_output=True, text=True).stdout.strip()
        self.assertEqual(probe(), 'busy', 'another process cannot take the GPU while the worker holds it')
        self.assertTrue(tree.alive())
        self.assertTrue(tree.drain(10))
        gpu.release()
        self.assertEqual(probe(), 'got')


class _StubTree:
    def __init__(self, drains):
        self.drains = list(drains)
        self.calls = 0

    def drain(self, timeout=30.0, grace=5.0):
        self.calls += 1
        return self.drains.pop(0) if self.drains else True


class QuarantineLoopTests(unittest.TestCase):
    """If drain cannot be proven the worker keeps the GPU lock and claims nothing (fail closed)."""

    def make_worker(self, lock_path):
        w = worker.Worker.__new__(worker.Worker)
        w.gpu = worker.FileLock(lock_path)
        w.gpu_busy_logged = False
        w.quarantine = None
        w.admission = None
        w.admission_refusal = None
        w.claims = 0
        w.worker_heartbeat = lambda: None
        w.resume_pending = lambda: None

        def claim():
            w.claims += 1
            return {'jobId': JOB_ID}
        w.claim = claim
        return w

    def probe(self, path):
        other = worker.FileLock(path)
        got = other.acquire(0)
        if got:
            other.release()
        return got

    def test_undrained_tree_keeps_lock_and_blocks_claims_until_it_exits(self):
        path = Path(tempfile.mkdtemp()) / 'gpu.lock'
        w = self.make_worker(path)
        stuck = _StubTree([False, True])

        def execute(job):
            w.quarantine = stuck  # what run_lease_bound does when drain() returns False
        w.execute = execute
        self.assertEqual(w.loop(once=True, poll_seconds=0), 4)
        self.assertEqual(w.claims, 1)
        self.assertTrue(w.gpu.held, 'GPU lock kept while owned processes may still run')
        if os.name != 'nt':
            self.assertFalse(self.probe(path), 'no other process can take the GPU')
        self.assertEqual(w.loop(once=True, poll_seconds=0), 4, 'still quarantined')
        self.assertEqual(w.claims, 1, 'no claim while quarantined')
        self.assertTrue(w.gpu.held)
        w.execute = lambda job: None
        self.assertEqual(w.loop(once=True, poll_seconds=0), 0, 'drained: resumes and claims again')
        self.assertIsNone(w.quarantine)
        self.assertEqual(w.claims, 2)
        self.assertFalse(w.gpu.held)
        self.assertTrue(self.probe(path))


class WindowsJobPlacementTests(unittest.TestCase):
    """Per-job Job Object placement logic with fakes (native behaviour is verified on the PC)."""

    class FakeProcess:
        def __init__(self, command, **kwargs):
            self.kwargs, self.pid, self.killed, self.returncode = kwargs, 4242, False, None

        def kill(self):
            self.killed = True

        def wait(self, timeout=None):
            self.returncode = 1
            return 1

        def poll(self):
            return self.returncode

    class FakeJob:
        def __init__(self, fail=False, active=(2, 1, 0), signaled=True):
            self.fail, self.counts, self.terminated, self.handle = fail, list(active), 0, 1
            self.signaled, self.tracks = signaled, 0

        def track(self):
            self.tracks += 1

        def wait_tracked(self, seconds):
            return self.signaled

        def assign_and_resume(self, process):
            if self.fail:
                raise OSError(5, 'nested job not allowed')

        def active(self):
            return self.counts.pop(0) if len(self.counts) > 1 else self.counts[0]

        def terminate(self):
            self.terminated += 1

        def close(self):
            self.handle = None

    def test_adapter_starts_suspended_inside_its_own_job(self):
        job = self.FakeJob()
        tree = worker.OwnedProcessTree(['adapter'], platform='nt', popen=self.FakeProcess, job_factory=lambda: job)
        self.assertTrue(tree.process.kwargs['creationflags'] & 0x4, 'CREATE_SUSPENDED until assigned')
        self.assertNotIn('start_new_session', tree.process.kwargs)
        self.assertTrue(tree.drain(timeout=5))
        self.assertGreaterEqual(job.terminated, 1, 'whole job terminated, not a PID')
        self.assertIsNone(job.handle, 'job closed only after it reported zero processes')

    def test_placement_failure_refuses_to_run_the_adapter(self):
        job = self.FakeJob(fail=True)
        made = []

        def popen(command, **kwargs):
            made.append(self.FakeProcess(command, **kwargs))
            return made[-1]
        with self.assertRaises(worker.ContainmentError):
            worker.OwnedProcessTree(['adapter'], platform='nt', popen=popen, job_factory=lambda: job)
        self.assertTrue(made[0].killed, 'suspended adapter killed before it ran')

    def test_kernel_zero_is_not_enough_until_tracked_process_objects_are_signaled(self):
        # PC-SAFE-008 native finding: ActiveProcesses==0 can precede a descendant's exit signal.
        job = self.FakeJob(active=(0,), signaled=False)
        tree = worker.OwnedProcessTree(['adapter'], platform='nt', popen=self.FakeProcess, job_factory=lambda: job)
        tree.process.returncode = 0
        self.assertFalse(tree.drain(timeout=0.5), 'not drained while a tracked process object is unsignaled')
        self.assertGreaterEqual(job.tracks, 1, 'processes tracked before release')
        job.signaled = True
        self.assertTrue(tree.drain(timeout=0.5))

    def test_job_that_never_empties_is_reported_undrained(self):
        job = self.FakeJob(active=(1,))
        tree = worker.OwnedProcessTree(['adapter'], platform='nt', popen=self.FakeProcess, job_factory=lambda: job)
        self.assertFalse(tree.drain(timeout=0.5))
        self.assertIsNotNone(job.handle, 'job handle kept open: the processes stay accounted for')


class AnalysisTransportTests(unittest.TestCase):
    """QINT-C json-v1 helpers (the end-to-end path runs in scripts/test-qwen-http.mjs)."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.binding = {'jobId': JOB_ID, 'analysisId': 'a', 'itemId': 'i', 'imageAssetId': 's', 'imageSha256': 'h'}

    def write(self, value, raw=None):
        path = self.tmp / 'result.json'
        path.write_bytes(raw if raw is not None else json.dumps(value).encode())
        return path

    def test_result_must_be_bounded_bound_and_never_self_approved(self):
        good = {'contractVersion': worker.ANALYSIS_RESULT, 'approvedForAutoApply': False, 'binding': self.binding}
        self.assertTrue(worker.json_result_ok(self.write(good), self.binding))
        self.assertFalse(worker.json_result_ok(self.write({**good, 'approvedForAutoApply': True}), self.binding))
        self.assertFalse(worker.json_result_ok(self.write({**good, 'binding': {**self.binding, 'itemId': 'x'}}), self.binding))
        self.assertFalse(worker.json_result_ok(self.write(None, b'{not json'), self.binding))
        self.assertFalse(worker.json_result_ok(self.write(None, b'[1]'), self.binding))
        self.assertFalse(worker.json_result_ok(self.write({**good, 'pad': 'x' * 9000}), self.binding), 'over 8192 bytes')

    def test_analysis_exit_codes_only_for_analysis_jobs_and_only_with_matching_record(self):
        err = self.tmp / 'adapter.err'
        err.write_text('log\n{"success": false, "code": "GPU_BUSY"}\n')
        self.assertEqual(worker.classify_exit(75, {}, err, 'garment.analyze'), 'GPU_BUSY')
        self.assertEqual(worker.classify_exit(75, {}, err, 'avatar.reconstruct'), 'INFERENCE_FAILED')
        err.write_text('{"success": false, "code": "OOM"}\n')
        self.assertEqual(worker.classify_exit(75, {}, err, 'garment.analyze'), 'INFERENCE_FAILED', 'code must match exit')
        err.write_text('{"success": false, "code": "MEMORY_PRESSURE"}\n')
        self.assertEqual(worker.classify_exit(74, {}, err, 'garment.analyze'), 'MEMORY_PRESSURE')

    def test_3d_input_digest_unchanged_and_analysis_digest_binds_identity(self):
        j = job()
        before = hashlib.sha256(json.dumps({'jobId': j['jobId'], 'modelId': j['modelId'], 'kind': j['kind'], 'modelRevision': j['modelRevision'],
            'params': j['input']['params'], 'assets': sorted((a['role'], a['assetId'], a['sha256'], a['bytes']) for a in j['input']['assets'])},
            sort_keys=True).encode()).hexdigest()
        self.assertEqual(worker.input_digest(j), before, 'existing 3D checkpoints stay valid')
        a = {**j, 'kind': 'garment.analyze', 'modelId': None, 'input': {**j['input'], 'binding': self.binding}}
        b = {**a, 'input': {**a['input'], 'binding': {**self.binding, 'itemId': 'other'}}}
        self.assertNotEqual(worker.input_digest(a), worker.input_digest(b))


class SharedGpuAdmissionTests(unittest.TestCase):
    """QREV-LOCK: integrated Qwen shares the PC3D lock/guard/slot and fails closed on any mismatch."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp()) / 'coordination'
        self.dir.mkdir()
        self.lock = self.dir / 'gpu0.lock'
        self.lock.write_bytes(b'')
        self.guard = self.dir / 'gpu_guard.py'
        self.guard.write_text('# guard under test\n')
        self.guard_sha = hashlib.sha256(self.guard.read_bytes()).hexdigest()
        self.slot = self.dir / 'gpu0-slot.json'

    def config(self, **patch):
        base = {'gpuLock': str(self.lock), 'gpuGuard': {'path': str(self.guard), 'sha256': self.guard_sha},
                'engines': {'garment.analyze': {}}}
        base.update(patch)
        return base

    def write_slot(self, owner='pc-ai', issued=None, seconds=900, version=1, **extra):
        issued = time.time() if issued is None else issued
        slot = {'version': version, 'owner': owner,
                'issuedAtUtc': worker.datetime.fromtimestamp(issued, worker.timezone.utc).isoformat(),
                'issuedAtUnix': issued, 'admitUntilUnix': issued + seconds}
        if version == 0:
            slot.pop('version'); slot.pop('issuedAtUnix')
        slot.update(extra)
        self.slot.write_text(json.dumps(slot))

    def test_analysis_engine_requires_shared_lock(self):
        self.assertTrue(worker.requires_shared_gpu({'engines': {'garment.analyze': {}}}))
        self.assertFalse(worker.requires_shared_gpu({'engines': {'avatar.reconstruct': {}}}))
        self.assertTrue(worker.requires_shared_gpu({'requireSharedGpuLock': True}))

    def test_startup_refuses_default_relative_missing_or_unpinned(self):
        for patch in ({'gpuLock': 'default'}, {'gpuLock': None}, {'gpuLock': 'coordination/gpu0.lock'},
                      {'gpuLock': str(self.dir / 'other.lock')},
                      {'gpuGuard': None}, {'gpuGuard': {'path': str(self.guard)}},
                      {'gpuGuard': {'path': 'gpu_guard.py', 'sha256': self.guard_sha}},
                      {'gpuGuard': {'path': str(self.guard), 'sha256': '0' * 64}},
                      {'gpuGuard': {'path': str(self.dir / 'missing.py'), 'sha256': self.guard_sha}},
                      {'gpuSlot': 'gpu0-slot.json'}, {'gpuSlotOwner': 'pc-qwen'}):
            with self.assertRaises(worker.AdmissionError, msg=json.dumps(patch)):
                worker.SharedGpuAdmission(self.config(**patch))
        self.assertFalse((self.dir / 'other.lock').exists(), 'a mistyped lock is never created')

    def test_slot_rules_match_the_guard(self):
        a = worker.SharedGpuAdmission(self.config())
        with self.assertRaisesRegex(worker.AdmissionError, 'bootstrap'):
            a.check()  # missing slot file: PC3D only
        self.write_slot('pc-ai')
        a.check()
        self.write_slot('pc-ai', version=0)
        a.check()  # valid legacy UTC-only slot
        self.write_slot('pc-ai', seconds=3600)
        a.check()  # exact maximum window
        refusals = [
            dict(owner='pc-3d'), dict(seconds=3601), dict(seconds=0),
            dict(issued=time.time() - 1000, seconds=900), dict(issued=time.time() + 60),
            dict(policy='x' * 161), dict(extra_field=1),
        ]
        for patch in refusals:
            extra = {k: v for k, v in patch.items() if k not in ('owner', 'issued', 'seconds', 'version')}
            core = {k: v for k, v in patch.items() if k in ('owner', 'issued', 'seconds', 'version')}
            self.write_slot(**core, **extra)
            with self.assertRaises(worker.AdmissionError, msg=json.dumps(patch)):
                a.check()
        for raw in ('{"owner": "pc-ai", "owner": "pc-ai"}', '{"owner": "pc-ai", "admitUntilUnix": NaN}', '[1]', '{bad',
                    json.dumps({'version': 1, 'owner': 'pc-ai', 'issuedAtUtc': '2026-11-08T10:00:00+07:00',
                                'issuedAtUnix': time.time(), 'admitUntilUnix': time.time() + 60}),
                    json.dumps({'version': True, 'owner': 'pc-ai', 'issuedAtUtc': 'x', 'admitUntilUnix': 1})):
            self.slot.write_text(raw)
            with self.assertRaises(worker.AdmissionError, msg=raw):
                a.check()
        self.slot.write_bytes(b' ' * 70000)
        with self.assertRaises(worker.AdmissionError):
            a.check()
        self.write_slot('pc-ai')
        self.guard.write_text('# swapped guard\n')
        with self.assertRaisesRegex(worker.AdmissionError, 'hash'):
            a.check()

    def test_loop_refusal_releases_lock_and_claims_nothing(self):
        a = worker.SharedGpuAdmission(self.config())
        w = worker.Worker.__new__(worker.Worker)
        w.gpu, w.admission, w.admission_refusal = worker.FileLock(self.lock, create=False), a, None
        w.gpu_busy_logged, w.quarantine, w.claims = False, None, 0
        w.worker_heartbeat = lambda: None
        w.resume_pending = lambda: None
        w.claim = lambda: setattr(w, 'claims', w.claims + 1)
        self.assertEqual(w.loop(once=True, poll_seconds=0), 0)
        self.assertEqual(w.claims, 0, 'no slot: no claim')
        self.assertFalse(w.gpu.held, 'lock released after refusal')
        self.write_slot('pc-ai')
        self.assertEqual(w.loop(once=True, poll_seconds=0), 0)
        self.assertEqual(w.claims, 1, 'admitted: claims')
        self.assertFalse(w.gpu.held)

    def test_main_refuses_to_start_with_default_lock(self):
        work = Path(tempfile.mkdtemp())
        config = work / 'config.json'
        config.write_text(json.dumps({'appUrl': 'http://127.0.0.1:9', 'workDir': str(work / 'data'), 'gpuLock': 'default',
            'processContainment': 'unsafe-disabled', 'engines': {'garment.analyze': {'model': 'm', 'revision': 'r', 'command': ['x']}}}))
        result = subprocess.run([sys.executable, str(Path(worker.__file__)), '--config', str(config), '--once'],
                                env={**os.environ, 'FITMATCH_WORKER_TOKEN': 'fmw_test'}, capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 5, result.stdout + result.stderr)
        self.assertIn('Refusing to start', result.stdout)


if __name__ == '__main__':
    unittest.main()
