"""Unit tests for worker checkpoint safety and error classification (stdlib unittest, no network)."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import shutil
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


def symlink_or_skip(test, link, target, directory=False):
    """Windows needs Developer Mode/privilege for symlinks; skip there instead of failing the native run."""
    try:
        link.symlink_to(target, target_is_directory=directory)
    except (OSError, NotImplementedError) as error:
        test.skipTest('symlinks not permitted here: ' + type(error).__name__)


class SharedGpuAdmissionTests(unittest.TestCase):
    """QREV-LOCK + QREV-BIND-02: integrated Qwen is bound to the PC3D coordinator's canonical lock/slot/guard."""

    GUARD_REL = 'fitmatch_AI/workers/windows/gpu_guard.py'

    def setUp(self):
        self.ws = Path(tempfile.mkdtemp()) / 'Fitmatch-GPU'
        self.dir = self.ws / 'coordination'
        self.dir.mkdir(parents=True)
        self.lock = self.dir / 'gpu0.lock'
        self.lock.write_bytes(b'0')
        self.guard = self.ws.joinpath(*self.GUARD_REL.split('/'))
        self.guard.parent.mkdir(parents=True)
        self.guard.write_text('# guard under test\n')
        self.guard_sha = hashlib.sha256(self.guard.read_bytes()).hexdigest()
        self.slot = self.dir / 'gpu0-slot.json'
        self.policy = self.dir / 'gpu-coordinator.json'
        self.policy_sha = self.write_policy()

    def policy_doc(self, lock_path=None, **patch):
        st = os.stat(lock_path or self.lock)
        doc = {'kind': 'fitmatch.gpu-coordinator.v1', 'coordinator': 'pc-3d', 'owners': ['pc-3d', 'pc-ai'],
               'lock': {'name': 'gpu0.lock', 'volume': st.st_dev, 'fileId': st.st_ino},
               'slot': {'name': 'gpu0-slot.json'},
               'guard': {'relativeToWorkspace': self.GUARD_REL, 'sha256': self.guard_sha},
               'issuedAtUtc': '2026-11-09T06:00:00+00:00'}
        doc.update(patch)
        return doc

    def write_policy(self, path=None, **patch):
        path = path or self.policy
        path.write_text(json.dumps(self.policy_doc(**patch)))
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def config(self, **patch):
        base = {'gpuCoordinator': {'path': str(self.policy), 'sha256': self.policy_sha}, 'engines': {'garment.analyze': {}}}
        base.update(patch)
        return base

    def write_slot(self, owner='pc-ai', issued=None, seconds=900, version=1, path=None, **extra):
        issued = time.time() if issued is None else issued
        slot = {'version': version, 'owner': owner,
                'issuedAtUtc': worker.datetime.fromtimestamp(issued, worker.timezone.utc).isoformat(),
                'issuedAtUnix': issued, 'admitUntilUnix': issued + seconds}
        if version == 0:
            slot.pop('version'); slot.pop('issuedAtUnix')
        slot.update(extra)
        (path or self.slot).write_text(json.dumps(slot))

    def copy_workspace(self, name='Copied-GPU'):
        """A second coordination tree with byte-identical policy and guard, as if copied or restored elsewhere."""
        other = self.ws.parent / name
        shutil.copytree(self.ws, other)
        return other

    def test_analysis_engine_requires_shared_lock(self):
        self.assertTrue(worker.requires_shared_gpu({'engines': {'garment.analyze': {}}}))
        self.assertFalse(worker.requires_shared_gpu({'engines': {'avatar.reconstruct': {}}}))
        self.assertTrue(worker.requires_shared_gpu({'requireSharedGpuLock': True}))

    def test_valid_binding_derives_canonical_paths(self):
        a = worker.SharedGpuAdmission(self.config())
        self.assertEqual((a.lock_path, a.slot_path, a.guard_path),
                         (Path(os.path.realpath(self.lock)), Path(os.path.realpath(self.slot)), self.guard.resolve()))
        self.assertEqual(a.lock_identity, worker.file_identity(os.stat(self.lock)))

    def test_config_cannot_name_lock_slot_or_guard(self):
        """QREV-BIND-02: an existing foreign absolute lock/slot or a self-declared guard is never trusted."""
        foreign = self.ws.parent / 'foreign-existing.lock'
        foreign.write_bytes(b'0')
        forged = self.ws.parent / 'forged-slot.json'
        self.write_slot('pc-ai', path=forged)
        for patch in ({'gpuLock': str(foreign)}, {'gpuLock': str(self.lock)}, {'gpuLock': 'default'},
                      {'gpuSlot': str(forged)}, {'gpuGuard': {'path': str(self.guard), 'sha256': self.guard_sha}}):
            with self.assertRaisesRegex(worker.AdmissionError, 'only from', msg=json.dumps(patch)):
                worker.SharedGpuAdmission(self.config(**patch))

    def test_pin_and_location_refusals(self):
        alt = self.dir / 'other.json'
        alt.write_text(self.policy.read_text())
        for patch in ({'gpuCoordinator': None}, {'gpuCoordinator': {'path': str(self.policy)}},
                      {'gpuCoordinator': {'path': 'coordination/gpu-coordinator.json', 'sha256': self.policy_sha}},
                      {'gpuCoordinator': {'path': str(self.policy), 'sha256': '0' * 64}},
                      {'gpuCoordinator': {'path': str(self.policy), 'sha256': self.policy_sha, 'extra': 1}},
                      {'gpuCoordinator': {'path': str(alt), 'sha256': self.policy_sha}},
                      {'gpuCoordinator': {'path': str(self.dir / 'missing' / 'gpu-coordinator.json'), 'sha256': self.policy_sha}},
                      {'gpuSlotOwner': 'pc-qwen'}):
            with self.assertRaises(worker.AdmissionError, msg=json.dumps(patch)):
                worker.SharedGpuAdmission(self.config(**patch))

    def test_policy_content_refusals(self):
        bad = [dict(kind='other'), dict(coordinator='pc-ai'), dict(owners=['pc-ai']), dict(slot={'name': 'x.json'}),
               dict(extra=1),
               dict(lock={'name': 'gpu1.lock', 'volume': 1, 'fileId': 1}),
               dict(lock={'name': 'gpu0.lock', 'volume': True, 'fileId': 1}),
               dict(lock={'name': 'gpu0.lock', 'volume': 1, 'fileId': -1}),
               dict(guard={'relativeToWorkspace': '/abs/gpu_guard.py', 'sha256': self.guard_sha}),
               dict(guard={'relativeToWorkspace': '../outside/gpu_guard.py', 'sha256': self.guard_sha}),
               dict(guard={'relativeToWorkspace': 'a\\b.py', 'sha256': self.guard_sha}),
               dict(guard={'relativeToWorkspace': 'C:/x.py', 'sha256': self.guard_sha}),
               dict(guard={'relativeToWorkspace': self.GUARD_REL, 'sha256': '1' * 64})]
        for patch in bad:
            sha = self.write_policy(**patch)
            with self.assertRaises(worker.AdmissionError, msg=json.dumps(patch)):
                worker.SharedGpuAdmission(self.config(gpuCoordinator={'path': str(self.policy), 'sha256': sha}))
        for raw in ('{"kind": 1, "kind": 2}', '{"kind": NaN}', '[1]', '{bad'):
            self.policy.write_text(raw)
            sha = hashlib.sha256(self.policy.read_bytes()).hexdigest()
            with self.assertRaises(worker.AdmissionError, msg=raw):
                worker.SharedGpuAdmission(self.config(gpuCoordinator={'path': str(self.policy), 'sha256': sha}))

    def test_guard_link_escaping_workspace_refused(self):
        outside = self.ws.parent / 'elsewhere.py'
        outside.write_bytes(self.guard.read_bytes())
        self.guard.unlink()
        symlink_or_skip(self, self.guard, outside)
        with self.assertRaisesRegex(worker.AdmissionError, 'outside the workspace'):
            worker.SharedGpuAdmission(self.config())

    def test_copied_coordination_with_identical_policy_refused_while_canonical_held(self):
        """QFINAL-022 case 1, fixed: another existing lock cannot be admitted even with byte-identical policy."""
        holder = worker.FileLock(self.lock, create=False)
        self.assertTrue(holder.acquire(0))
        try:
            other = self.copy_workspace()
            pinned = {'path': str(other / 'coordination' / 'gpu-coordinator.json'), 'sha256': self.policy_sha}
            with self.assertRaisesRegex(worker.AdmissionError, 'identity'):
                worker.SharedGpuAdmission(self.config(gpuCoordinator=pinned))
            second = worker.FileLock(other / 'coordination' / 'gpu0.lock', create=False)
            self.assertTrue(second.acquire(0), 'a split lock would be free: the refusal is what prevents overlap')
            second.release()
        finally:
            holder.release()

    def test_forged_or_linked_slot_cannot_admit_other_owner(self):
        """QFINAL-022 case 2, fixed: the canonical slot alone decides; a link to a forged slot is refused."""
        holder = worker.FileLock(self.lock, create=False)
        self.assertTrue(holder.acquire(0))
        try:
            self.write_slot('pc-3d')
            a = worker.SharedGpuAdmission(self.config())
            with self.assertRaisesRegex(worker.AdmissionError, 'another owner'):
                a.check()
            forged = self.ws.parent / 'forged-slot.json'
            self.write_slot('pc-ai', path=forged)
            self.slot.unlink()
            symlink_or_skip(self, self.slot, forged)
            with self.assertRaisesRegex(worker.AdmissionError, 'link'):
                a.check()
            with self.assertRaisesRegex(worker.AdmissionError, 'link'):
                worker.SharedGpuAdmission(self.config())
        finally:
            holder.release()

    def test_linked_lock_or_policy_refused(self):
        real = self.ws.parent / 'real.lock'
        real.write_bytes(b'0')
        self.lock.unlink()
        symlink_or_skip(self, self.lock, real)
        sha = self.write_policy(lock_path=real)
        with self.assertRaisesRegex(worker.AdmissionError, 'link'):
            worker.SharedGpuAdmission(self.config(gpuCoordinator={'path': str(self.policy), 'sha256': sha}))
        self.lock.unlink()
        self.lock.write_bytes(b'0')
        sha = self.write_policy()
        target = self.dir / 'real-policy.json'
        os.replace(self.policy, target)
        symlink_or_skip(self, self.policy, target)
        with self.assertRaisesRegex(worker.AdmissionError, 'link'):
            worker.SharedGpuAdmission(self.config(gpuCoordinator={'path': str(self.policy), 'sha256': sha}))

    def test_aliased_workspace_resolves_to_the_same_exclusive_lock(self):
        alias = self.ws.parent / 'alias-of-workspace'
        symlink_or_skip(self, alias, self.ws, directory=True)
        a = worker.SharedGpuAdmission(self.config(gpuCoordinator={
            'path': str(alias / 'coordination' / 'gpu-coordinator.json'), 'sha256': self.policy_sha}))
        self.assertEqual(a.lock_path, Path(os.path.realpath(self.lock)))
        holder = worker.FileLock(self.lock, create=False)
        self.assertTrue(holder.acquire(0))
        try:
            self.assertFalse(a.make_lock().acquire(0), 'same file through an alias: still exclusive')
        finally:
            holder.release()

    def test_lock_replaced_after_startup_refused_on_open_and_loop_exits(self):
        a = worker.SharedGpuAdmission(self.config())
        # POSIX: keep the old inode alive so the replacement cannot reuse its number. Windows cannot replace
        # an open file; NTFS file ids carry a sequence number, so a new file gets a new identity anyway.
        keep = open(self.lock, 'rb') if os.name != 'nt' else None
        try:
            fresh = self.dir / 'fresh.lock'
            fresh.write_bytes(b'0')
            os.replace(fresh, self.lock)
            with self.assertRaisesRegex(worker.AdmissionError, 'identity'):
                a.make_lock().acquire(0)
            w = worker.Worker.__new__(worker.Worker)
            w.gpu, w.admission, w.admission_refusal = a.make_lock(), a, None
            w.gpu_busy_logged, w.gpu_busy, w.quarantine, w.claims = False, False, None, 0
            w.worker_heartbeat = lambda: None
            w.resume_pending = lambda: None
            w.claim = lambda: setattr(w, 'claims', w.claims + 1)
            self.write_slot('pc-ai')
            self.assertEqual(w.loop(once=True, poll_seconds=0), 5)
            self.assertEqual(w.claims, 0)
        finally:
            if keep:
                keep.close()

    def test_check_rejects_a_held_lock_that_is_not_canonical(self):
        a = worker.SharedGpuAdmission(self.config())
        self.write_slot('pc-ai')
        other = self.ws.parent / 'x.lock'
        other.write_bytes(b'0')
        wrong = worker.FileLock(other, create=False)
        self.assertTrue(wrong.acquire(0))
        try:
            with self.assertRaisesRegex(worker.AdmissionError, 'canonical'):
                a.check(lock=wrong)
        finally:
            wrong.release()
        right = a.make_lock()
        self.assertTrue(right.acquire(0))
        try:
            a.check(lock=right)
        finally:
            right.release()
        with self.assertRaisesRegex(worker.AdmissionError, 'canonical'):
            a.check(lock=right)  # not held

    def test_policy_edit_after_startup_refused_before_claim(self):
        a = worker.SharedGpuAdmission(self.config())
        self.write_slot('pc-ai')
        a.check()
        self.write_policy(issuedAtUtc='2026-11-10T00:00:00+00:00')
        with self.assertRaisesRegex(worker.AdmissionError, 'ACKed revision'):
            a.check()

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
        w.gpu, w.admission, w.admission_refusal = a.make_lock(), a, None
        w.gpu_busy_logged, w.gpu_busy, w.quarantine, w.claims = False, False, None, 0
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

    def run_main(self, config_doc):
        work = Path(tempfile.mkdtemp())
        config = work / 'config.json'
        config.write_text(json.dumps({'appUrl': 'http://127.0.0.1:9', 'workDir': str(work / 'data'),
            'processContainment': 'unsafe-disabled',
            'engines': {'garment.analyze': {'model': 'm', 'revision': 'r', 'command': ['x']}}, **config_doc}))
        return subprocess.run([sys.executable, str(Path(worker.__file__)), '--config', str(config), '--once'],
                              env={**os.environ, 'FITMATCH_WORKER_TOKEN': 'fmw_test'}, capture_output=True, text=True, timeout=60)

    def test_main_refuses_to_start_with_legacy_or_foreign_binding(self):
        result = self.run_main({'gpuLock': 'default'})
        self.assertEqual(result.returncode, 5, result.stdout + result.stderr)
        self.assertIn('Refusing to start', result.stdout)
        other = self.copy_workspace('Main-Copy')
        result = self.run_main({'gpuCoordinator': {'path': str(other / 'coordination' / 'gpu-coordinator.json'), 'sha256': self.policy_sha}})
        self.assertEqual(result.returncode, 5, result.stdout + result.stderr)
        self.assertIn('identity', result.stdout)


class GpuBusyReportingTests(unittest.TestCase):
    """QREV-STATUS: heartbeats say truthfully whether the shared GPU was taken at the last claim attempt."""
    GUARD_REL = SharedGpuAdmissionTests.GUARD_REL
    setUp, config, write_slot = SharedGpuAdmissionTests.setUp, SharedGpuAdmissionTests.config, SharedGpuAdmissionTests.write_slot
    policy_doc, write_policy = SharedGpuAdmissionTests.policy_doc, SharedGpuAdmissionTests.write_policy

    def make_worker(self):
        w = worker.Worker.__new__(worker.Worker)
        w.admission, w.admission_refusal = worker.SharedGpuAdmission(self.config()), None
        w.gpu = w.admission.make_lock()
        w.gpu_busy_logged, w.gpu_busy, w.quarantine, w.claims = False, False, None, 0
        w.capabilities, w.warned, w.sent = {'garment.analyze': {'model': 'm', 'revision': 'r'}}, set(), []

        class Client:
            def api(self, path, body):
                w.sent.append((path, dict(body)))
                return {'grantedCapabilities': ['garment.analyze']}
        w.client = Client()
        w.resume_pending = lambda: None
        w.claim = lambda: setattr(w, 'claims', w.claims + 1)
        return w

    def beats(self, w):
        return [b['gpuBusy'] for p, b in w.sent if p == 'heartbeat']

    def test_lock_held_elsewhere_is_reported_busy_at_once_then_cleared(self):
        self.write_slot('pc-ai')
        w = self.make_worker()
        other = worker.FileLock(self.lock, create=False)
        self.assertTrue(other.acquire(0))
        self.assertEqual(w.loop(once=True, poll_seconds=0), 0)
        self.assertEqual(w.claims, 0)
        self.assertEqual(self.beats(w), [False, True], 'transition reported immediately, not one poll later')
        self.assertEqual(w.loop(once=True, poll_seconds=0), 0)
        self.assertEqual(self.beats(w), [False, True, True], 'no extra heartbeat while it stays busy')
        other.release()
        self.assertEqual(w.loop(once=True, poll_seconds=0), 0)
        self.assertEqual(w.claims, 1)
        w.loop(once=True, poll_seconds=0)
        self.assertEqual(self.beats(w)[-1], False, 'cleared once the worker could claim')

    def test_slot_for_the_other_owner_is_busy_without_claiming(self):
        self.write_slot('pc-3d')
        w = self.make_worker()
        self.assertEqual(w.loop(once=True, poll_seconds=0), 0)
        self.assertEqual((w.claims, self.beats(w)), (0, [False, True]))
        self.assertFalse(w.gpu.held)

    def test_heartbeat_carries_only_a_boolean(self):
        w = self.make_worker()
        w.gpu_busy = 'yes'
        w.worker_heartbeat()
        self.assertEqual(w.sent[-1][1], {'capabilities': w.capabilities, 'gpuBusy': True})


class CoordinatorPolicyHelperTests(unittest.TestCase):
    """The PC3D helper writes exactly what the worker binding accepts and never creates the lock."""

    def setUp(self):
        spec = importlib.util.spec_from_file_location('gpu_policy', Path(worker.__file__).with_name('gpu_coordinator_policy.py'))
        self.helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.helper)
        self.ws = Path(tempfile.mkdtemp()) / 'Fitmatch-GPU'
        (self.ws / 'coordination').mkdir(parents=True)
        guard = self.ws / 'fitmatch_AI' / 'workers' / 'windows' / 'gpu_guard.py'
        guard.parent.mkdir(parents=True)
        guard.write_text('# guard\n')
        self.guard_sha = hashlib.sha256(guard.read_bytes()).hexdigest()

    def run_helper(self, *argv):
        import contextlib, io
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = self.helper.main(list(argv))
        return code, out.getvalue()

    def test_write_requires_existing_lock_and_never_creates_it(self):
        with self.assertRaises(SystemExit):
            self.run_helper('write', '--workspace', str(self.ws))
        self.assertFalse((self.ws / 'coordination' / 'gpu0.lock').exists())

    def test_write_then_verify_round_trip(self):
        (self.ws / 'coordination' / 'gpu0.lock').write_bytes(b'0')
        with self.assertRaises(SystemExit):
            self.run_helper('write', '--workspace', str(self.ws), '--expected-guard-sha256', '0' * 64)
        code, out = self.run_helper('write', '--workspace', str(self.ws), '--expected-guard-sha256', self.guard_sha)
        written = json.loads(out)
        with self.assertRaises(SystemExit):
            self.run_helper('write', '--workspace', str(self.ws))  # existing policy needs --replace
        config = self.ws.parent / 'config.json'
        config.write_text(json.dumps({'gpuCoordinator': {'path': written['policy'], 'sha256': written['sha256']},
                                      'gpuSlotOwner': 'pc-ai'}))
        code, out = self.run_helper('verify', '--config', str(config))
        self.assertEqual(code, 0, out)
        self.assertTrue(json.loads(out)['admitted'])
        config.write_text(json.dumps({'gpuCoordinator': {'path': written['policy'], 'sha256': written['sha256']},
                                      'gpuLock': str(self.ws / 'coordination' / 'gpu0.lock')}))
        code, out = self.run_helper('verify', '--config', str(config))
        self.assertEqual(code, 5)
        self.assertIn('only from', json.loads(out)['refusal'])


class BackendBindingTests(unittest.TestCase):
    """ENV-CANON-01: the worker only claims from the app origin + backend project it was enrolled for."""
    CANON = 'gohczmqykjkrgdblgbog'

    def cfg(self, app='https://fitmatch.example', **expected):
        doc = {'appUrl': app}
        if expected:
            doc['expectedBackend'] = expected
        return doc

    def test_valid_bindings(self):
        self.assertEqual(worker.backend_binding(self.cfg(projectRef=self.CANON, appOrigin='https://fitmatch.example'), True), self.CANON)
        self.assertEqual(worker.backend_binding(self.cfg(projectRef=self.CANON, appOrigin='HTTPS://FitMatch.example/'), True), self.CANON)
        self.assertEqual(worker.backend_binding(self.cfg('http://127.0.0.1:3000', projectRef='isolated-test', appOrigin='http://127.0.0.1:3000'), True), 'isolated-test')
        self.assertIsNone(worker.backend_binding(self.cfg(), False), '3D-only worker without binding stays as before')

    def test_refusals(self):
        bad = [
            (self.cfg(), True),  # required for integrated GPU work
            (self.cfg(projectRef='wqbwwusrhertqktwsxsl', appOrigin='https://fitmatch.example'), False),  # retired smoke
            (self.cfg(projectRef='NOT-A-REF', appOrigin='https://fitmatch.example'), False),
            (self.cfg(projectRef=self.CANON, appOrigin='https://other.example'), False),
            (self.cfg(projectRef=self.CANON, appOrigin='https://fitmatch.example:8443'), False),
            (self.cfg('http://fitmatch.example', projectRef=self.CANON, appOrigin='http://fitmatch.example'), False),
            (self.cfg(projectRef='isolated-test', appOrigin='https://fitmatch.example'), False),
            ({'appUrl': 'https://fitmatch.example', 'expectedBackend': {'projectRef': self.CANON}}, False),
            ({'appUrl': 'https://fitmatch.example', 'expectedBackend': {'projectRef': self.CANON, 'appOrigin': 'https://fitmatch.example', 'x': 1}}, False),
        ]
        for config, required in bad:
            with self.assertRaises(worker.BackendMismatch, msg=json.dumps(config)):
                worker.backend_binding(config, required)

    def make_worker(self, reply):
        w = worker.Worker.__new__(worker.Worker)
        w.capabilities, w.warned, w.gpu_busy = {'garment.analyze': {'model': 'm', 'revision': 'r'}}, set(), False
        w.expected_backend = self.CANON

        class Client:
            def api(self, path, body):
                return reply
        w.client = Client()
        return w

    def test_heartbeat_reply_must_name_the_expected_project(self):
        self.make_worker({'grantedCapabilities': [], 'backend': {'projectRef': self.CANON}}).worker_heartbeat()
        for reply in ({'grantedCapabilities': []}, {'backend': {'projectRef': 'wqbwwusrhertqktwsxsl'}},
                      {'backend': 'gohczmqykjkrgdblgbog'}, {'backend': {'projectRef': 'isolated-test'}}):
            with self.assertRaises(worker.BackendMismatch, msg=json.dumps(reply)):
                self.make_worker(reply).worker_heartbeat()

    def test_loop_exits_before_claim_on_backend_mismatch(self):
        w = self.make_worker({'grantedCapabilities': ['garment.analyze'], 'backend': {'projectRef': 'abcdefghijabcdefghij'}})
        w.gpu, w.admission, w.quarantine, w.claims = None, None, None, 0
        w.resume_pending = lambda: None
        w.claim = lambda: setattr(w, 'claims', w.claims + 1)
        self.assertEqual(w.loop(once=True, poll_seconds=0), 5)
        self.assertEqual(w.claims, 0)


if __name__ == '__main__':
    unittest.main()
