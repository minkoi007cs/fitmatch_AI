#!/usr/bin/env python3
"""Outbound Fitmatch worker protocol v1, revision v1-r2. Python 3.10+, stdlib only; inference adapters are separate.
Never advertises a model unless a local command is explicitly configured. No mock generation.

R1 recovery rules (see docs/worker-api-contract-v1.md):
- Every side effect around an output is recorded in a durable per-job checkpoint, written atomically.
- Once an adapter produced a verified output, the worker never sends `fail` for it and never runs the model
  again for the same job/inputs/engine revision: it retries, reconciles with the server, or keeps the
  checkpoint so a later lease (same process, restart, or reclaimed attempt) publishes the same bytes.
- Network-level failures are retried with bounded exponential backoff + jitter; 409 means the lease is no
  longer ours (server is authoritative); 401/403 means the credential is no longer valid.
"""
import argparse
import hashlib
import http.client
import json
import os
from pathlib import Path
import random
import re
import signal
import struct
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

PROTOCOL_REVISION = 'v1-r2'
KINDS = {'avatar.reconstruct', 'garment.reconstruct', 'garment.drape', 'bottom.reconstruct', 'bottom.drape'}
MAX_BYTES = 40 * 1024 * 1024
CHECKPOINT_VERSION = 1
FAIL_CODES = {'OOM', 'INVALID_INPUT', 'MODEL_UNAVAILABLE', 'INFERENCE_FAILED', 'EXPORT_FAILED', 'TIMEOUT'}
# Adapter exit contract (provisional, from PC-CONF-01 / draft PR1, adapter revision 37213bc): a failure is
# classified only when the exit code is in this table AND stderr ends with one bounded JSON object
# {"success": false, "code": <same code>}. Anything else (argparse usage text, unknown exit, malformed or
# mismatched record) is INFERENCE_FAILED. Operators may extend it per engine with "exitCodes" once agreed.
DEFAULT_EXIT_CODES = {78: 'MODEL_UNAVAILABLE', 2: 'INVALID_INPUT'}
SECRET_NAME = re.compile(r'(TOKEN|SECRET|PASSW|CREDENTIAL|API_?KEY|PRIVATE_?KEY|SERVICE_?ROLE|AUTHORIZATION|COOKIE|SESSION)', re.I)
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
RESUMABLE = ('output_ready', 'uploading', 'finalized')


class LeaseLost(Exception):
    """409: the server says this lease/assignment is no longer ours."""


class CredentialLost(LeaseLost):
    """401/403: worker credential revoked or invalid."""


class Retryable(Exception):
    """Network failure, timeout, 429 or 5xx: outcome unknown, safe to retry the same idempotent call."""


class Rejected(Exception):
    """Definitive 4xx answer for this request (other than 401/403/409)."""

    def __init__(self, status, code):
        super().__init__(f'HTTP {status} {code}')
        self.status, self.code = status, code


class JobFailure(Exception):
    """Definitive failure before any output exists; reported with a contract failure code."""

    def __init__(self, code):
        super().__init__(code)
        self.code = code if code in FAIL_CODES else 'INFERENCE_FAILED'


def _error_code(error):
    try:
        return json.loads(error.read() or b'{}').get('error') or 'UNKNOWN'
    except Exception:
        return 'UNKNOWN'


NETWORK_ERRORS = (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException, OSError)


class Client:
    def __init__(self, base, token, timeout=30):
        parsed = urllib.parse.urlparse(base)
        if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1')):
            raise ValueError('App URL must use HTTPS (or local loopback for development)')
        self.base, self.token, self.timeout = base.rstrip('/'), token, timeout

    def api(self, path, body):
        request = urllib.request.Request(self.base + '/api/v2/worker/' + path,
            json.dumps(body).encode(), {'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return None if response.status == 204 else json.load(response)
        except urllib.error.HTTPError as error:
            code = _error_code(error)
            if error.code in (401, 403):
                raise CredentialLost(code) from None
            if error.code == 409:
                raise LeaseLost(code) from None
            if error.code == 429 or error.code >= 500:
                raise Retryable('HTTP ' + str(error.code)) from None
            raise Rejected(error.code, code) from None
        except NETWORK_ERRORS as error:
            raise Retryable(type(error).__name__) from None

    @staticmethod
    def _check_url(raw):
        url = urllib.parse.urlparse(raw)
        if url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1')):
            raise ValueError('Storage URL must use HTTPS')

    def download(self, asset, destination):
        self._check_url(asset['url'])
        digest = hashlib.sha256()
        size = 0
        try:
            with urllib.request.urlopen(asset['url'], timeout=60) as response, destination.open('wb') as target:
                while True:
                    part = response.read(1024 * 1024)
                    if not part:
                        break
                    size += len(part)
                    if size > MAX_BYTES:
                        raise JobFailure('INVALID_INPUT')
                    digest.update(part)
                    target.write(part)
        except urllib.error.HTTPError as error:
            raise Rejected(error.code, 'DOWNLOAD_REFUSED') from None
        except NETWORK_ERRORS as error:
            raise Retryable(type(error).__name__) from None
        if size != asset['bytes'] or digest.hexdigest() != asset['sha256']:
            raise JobFailure('INVALID_INPUT')

    def put(self, url, path):
        """Returns 'stored' or 'exists'. Raises Rejected (e.g. expired URL) or Retryable (unknown outcome)."""
        self._check_url(url)
        request = urllib.request.Request(url, path.read_bytes(),
            {'Content-Type': 'model/gltf-binary', 'x-upsert': 'false'}, method='PUT')
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                response.read()
                return 'stored'
        except urllib.error.HTTPError as error:
            text = (error.read() or b'')[:2000].decode('utf8', 'replace')
            if error.code == 409 or re.search(r'exists|duplicate', text, re.I):
                return 'exists'  # an earlier attempt with unknown outcome landed; finalize verifies the bytes
            if error.code == 429 or error.code >= 500:
                raise Retryable('HTTP ' + str(error.code)) from None
            raise Rejected(error.code, 'UPLOAD_REFUSED') from None
        except NETWORK_ERRORS as error:
            raise Retryable(type(error).__name__) from None


class Retry:
    def __init__(self, attempts=6, base=2.0, cap=30.0):
        self.attempts, self.base, self.cap = attempts, base, cap

    def run(self, call):
        for index in range(self.attempts):
            try:
                return call()
            except Retryable:
                if index == self.attempts - 1:
                    raise
                delay = min(self.cap, self.base * (2 ** index))
                time.sleep(delay * random.uniform(0.5, 1.0))


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(part)
    return digest.hexdigest()


def glb_ok(path):
    try:
        size = path.stat().st_size
        if size < 20 or size > MAX_BYTES:
            return False
        with path.open('rb') as stream:
            return struct.unpack('<III', stream.read(12)) == (0x46546C67, 2, size)
    except (OSError, struct.error):
        return False


def input_digest(job):
    """Identity of what the model would compute: job, model version, engine revision and verified inputs."""
    parts = {'jobId': job['jobId'], 'modelId': job['modelId'], 'kind': job['kind'], 'modelRevision': job['modelRevision'],
             'params': job['input']['params'],
             'assets': sorted((a['role'], a['assetId'], a['sha256'], a['bytes']) for a in job['input']['assets'])}
    return hashlib.sha256(json.dumps(parts, sort_keys=True).encode()).hexdigest()


def adapter_environment(token):
    """Never pass credentials to the adapter: drop anything that looks secret or carries the worker token."""
    return {k: v for k, v in os.environ.items()
            if not SECRET_NAME.search(k) and not k.startswith('FITMATCH_WORKER') and (not token or token not in v)}


def structured_error(err_path, limit=16384):
    """Last non-empty stderr line as a bounded JSON error record, or None. Raw stderr is never forwarded."""
    try:
        with err_path.open('rb') as stream:
            stream.seek(max(0, err_path.stat().st_size - limit))
            lines = [line for line in stream.read().decode('utf8', 'replace').splitlines() if line.strip()]
        record = json.loads(lines[-1]) if lines else None
    except (OSError, ValueError):
        return None
    if not isinstance(record, dict) or record.get('success') is not False or record.get('code') not in FAIL_CODES:
        return None
    return record['code']


def classify_exit(returncode, engine, err_path):
    mapping = dict(DEFAULT_EXIT_CODES)
    for key, value in (engine.get('exitCodes') or {}).items():
        if str(key).lstrip('-').isdigit() and value in FAIL_CODES:
            mapping[int(key)] = value
    expected = mapping.get(returncode)
    if expected and structured_error(err_path) == expected:
        return expected
    return 'INFERENCE_FAILED'


class Checkpoint:
    """Durable per-job state in <workDir>/jobs/<jobId>/checkpoint.json, replaced atomically."""

    def __init__(self, root, job_id):
        if not UUID.match(job_id or ''):
            raise ValueError('Invalid job id')
        self.dir = root / 'jobs' / job_id
        self.file = self.dir / 'checkpoint.json'
        self.data = None

    def load(self):
        if not self.file.exists():
            return None
        try:
            data = json.loads(self.file.read_text(encoding='utf8'))
            if not isinstance(data, dict) or data.get('version') != CHECKPOINT_VERSION:
                raise ValueError('unrecognized checkpoint')
            self.data = data
            return data
        except (ValueError, OSError):
            self.reject('unreadable or unrecognized checkpoint')
            return None

    def save(self, **changes):
        self.dir.mkdir(parents=True, mode=0o700, exist_ok=True)
        self.data = {**(self.data or {'version': CHECKPOINT_VERSION}), **changes, 'updatedAt': time.time()}
        temp = self.dir / ('checkpoint.' + uuid.uuid4().hex + '.tmp')
        with temp.open('w', encoding='utf8') as stream:
            json.dump(self.data, stream, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, self.file)

    def reject(self, reason):
        """Keep evidence, never delete: move the checkpoint aside so it is not trusted again."""
        if self.file.exists():
            target = self.dir / f'checkpoint.rejected.{int(time.time() * 1000)}.json'
            os.replace(self.file, target)
            print('Checkpoint set aside:', reason, flush=True)
        self.data = None

    def recoverable_output(self, job, digest):
        """A previously produced output is reused only if everything about it still matches."""
        cp = self.data
        if not cp or cp.get('stage') not in RESUMABLE + ('completed',):
            return None
        same = (cp.get('jobId') == job['jobId'] and cp.get('modelId') == job['modelId'] and cp.get('kind') == job['kind']
                and cp.get('modelRevision') == job['modelRevision'] and cp.get('inputDigest') == digest)
        output = cp.get('output') or {}
        path = (self.dir / output.get('file', '')).resolve() if output.get('file') else None
        if not same or not path or self.dir.resolve() not in path.parents or not path.exists():
            return None
        if path.stat().st_size != output.get('bytes') or not glb_ok(path) or sha256_file(path) != output.get('sha256'):
            return None
        return {'path': path, 'bytes': output['bytes'], 'sha256': output['sha256']}


class DirLock:
    """One worker process per workDir. On POSIX the lock is inherited by the adapter (pass_fds), so an
    adapter orphaned by a worker crash keeps the lock until it exits: a restarted worker cannot start a
    second inference meanwhile. On Windows the adapter is placed in a kill-on-close job object instead."""

    def __init__(self, root):
        self.path = root / '.worker.lock'
        self.handle = None

    def acquire(self, wait_seconds):
        self.handle = self.path.open('a+')
        deadline = time.monotonic() + wait_seconds
        while True:
            try:
                if os.name == 'nt':
                    import msvcrt
                    self.handle.seek(0)
                    msvcrt.locking(self.handle.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(self.handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                return True
            except OSError:
                if time.monotonic() >= deadline:
                    return False
                time.sleep(1)

    def fds(self):
        return (self.handle.fileno(),) if self.handle and os.name != 'nt' else ()


class ContainmentError(RuntimeError):
    pass


CONTAINMENT_DISABLED = 'unsafe-disabled'


def bind_windows_job_object():
    """Put this worker in a Job Object with KILL_ON_JOB_CLOSE so adapters die with the worker.

    Returns the open job handle (must stay open for the life of the process) or raises OSError.
    The job does not set BREAKAWAY_OK, so adapter children cannot leave it.
    """
    import ctypes
    from ctypes import wintypes

    class Basic(ctypes.Structure):
        _fields_ = [('PerProcessUserTimeLimit', ctypes.c_int64), ('PerJobUserTimeLimit', ctypes.c_int64),
                    ('LimitFlags', wintypes.DWORD), ('MinimumWorkingSetSize', ctypes.c_size_t),
                    ('MaximumWorkingSetSize', ctypes.c_size_t), ('ActiveProcessLimit', wintypes.DWORD),
                    ('Affinity', ctypes.c_size_t), ('PriorityClass', wintypes.DWORD), ('SchedulingClass', wintypes.DWORD)]

    class Io(ctypes.Structure):
        _fields_ = [(n, ctypes.c_uint64) for n in ('Read', 'Write', 'Other', 'ReadBytes', 'WriteBytes', 'OtherBytes')]

    class Extended(ctypes.Structure):
        _fields_ = [('Basic', Basic), ('Io', Io), ('ProcessMemoryLimit', ctypes.c_size_t), ('JobMemoryLimit', ctypes.c_size_t),
                    ('PeakProcessMemoryUsed', ctypes.c_size_t), ('PeakJobMemoryUsed', ctypes.c_size_t)]

    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.CreateJobObjectW.argtypes = (wintypes.LPVOID, wintypes.LPCWSTR)
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.SetInformationJobObject.argtypes = (wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD)
    kernel32.AssignProcessToJobObject.argtypes = (wintypes.HANDLE, wintypes.HANDLE)
    kernel32.IsProcessInJob.argtypes = (wintypes.HANDLE, wintypes.HANDLE, ctypes.POINTER(wintypes.BOOL))
    job = kernel32.CreateJobObjectW(None, None)
    if not job:
        raise OSError(ctypes.get_last_error(), 'CreateJobObjectW failed')
    info = Extended()
    info.Basic.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    if not kernel32.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info)):
        raise OSError(ctypes.get_last_error(), 'SetInformationJobObject failed')
    if not kernel32.AssignProcessToJobObject(job, kernel32.GetCurrentProcess()):
        raise OSError(ctypes.get_last_error(), 'AssignProcessToJobObject failed (worker may already be in a job without breakaway)')
    inside = wintypes.BOOL(False)
    if not kernel32.IsProcessInJob(kernel32.GetCurrentProcess(), job, ctypes.byref(inside)) or not inside.value:
        raise OSError(ctypes.get_last_error(), 'IsProcessInJob did not confirm the job binding')
    return job


def ensure_process_containment(config, platform=None, binder=bind_windows_job_object):
    """Fail closed: refuse to start inference unless adapters cannot outlive the worker.

    POSIX: adapters run in their own session, the parent kills the group on timeout/lease loss,
    and an adapter orphaned by a parent crash keeps the inherited workDir flock, so a restarted
    worker refuses to start (DirLock). Windows: a KILL_ON_JOB_CLOSE job object is required.
    The only way to run Windows without it is the explicit operator opt-in
    `"processContainment": "unsafe-disabled"`, which is logged on every start.
    """
    platform = platform or os.name
    mode = config.get('processContainment', 'required')
    if mode not in ('required', CONTAINMENT_DISABLED):
        raise ContainmentError(f'processContainment must be "required" or "{CONTAINMENT_DISABLED}"')
    if platform != 'nt':
        return 'posix-session+dirlock'
    try:
        ensure_process_containment.job = binder()  # keep the handle open for the life of the process
        return 'windows-job-object'
    except Exception as error:
        if mode == CONTAINMENT_DISABLED:
            print('WARNING: processContainment=unsafe-disabled. A worker crash can leave an adapter running on the GPU; '
                  'restart only after checking Task Manager. Reason: ' + type(error).__name__, flush=True)
            return 'disabled-by-operator'
        raise ContainmentError('Could not bind adapters to a kill-on-close job object (' + type(error).__name__ +
                               '). Refusing to run GPU jobs. Start the worker outside other job objects, or set '
                               f'"processContainment": "{CONTAINMENT_DISABLED}" only if you accept orphaned adapters.')


def stop_process(process):
    if process.poll() is not None:
        return
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True, check=False)
    else:
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=5)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
    process.wait(timeout=10)


class Worker:
    def __init__(self, config, token, root, lock):
        self.config, self.token, self.root, self.lock = config, token, root, lock
        self.engines = config.get('engines', {})
        self.capabilities = {}
        for kind, engine in self.engines.items():
            if kind not in KINDS or not isinstance(engine.get('command'), list) or not engine['command'] or not all(isinstance(v, str) for v in engine['command']):
                raise ValueError('Each engine needs a supported kind and local argv list')
            self.capabilities[kind] = {'model': engine['model'], 'revision': engine['revision']}
        retry = config.get('retry', {})
        self.retry = Retry(int(retry.get('attempts', 6)), float(retry.get('baseSeconds', 2)), float(retry.get('maxSeconds', 30)))
        self.heartbeat_seconds = float(config.get('heartbeatSeconds', 20))
        self.client = Client(config['appUrl'], token, float(config.get('requestTimeoutSeconds', 30)))
        self.instance = str(uuid.uuid4())  # new on every process start; claim redelivery is per instance
        self.warned = set()

    def worker_heartbeat(self):
        reply = self.client.api('heartbeat', {'capabilities': self.capabilities}) or {}
        granted = set(reply.get('grantedCapabilities', self.capabilities.keys()))
        for kind in self.capabilities.keys() - granted - self.warned:
            print('Capability declared but not granted by the operator:', kind, flush=True)
            self.warned.add(kind)

    def claim(self):
        request_id = str(uuid.uuid4())
        # Same instance + request identity on every retry: a lost reply returns the same assignment.
        return self.retry.run(lambda: self.client.api('claim', {'instanceId': self.instance, 'requestId': request_id}))

    def report_failure(self, job_id, lease, code):
        try:
            self.retry.run(lambda: self.client.api('jobs/' + job_id + '/fail', {**lease, 'code': code}))
            print('Reported failure', code, 'for', job_id, flush=True)
        except LeaseLost:
            print('Failure not recorded: lease no longer held for', job_id, flush=True)
        except Exception as error:
            print('Failure report not delivered:', type(error).__name__, flush=True)

    def publish(self, job_id, lease, cp, output):
        """output-intent -> PUT -> finalize -> complete, each step idempotent and retried; no fail after output."""
        prefix = 'jobs/' + job_id + '/'
        for _ in range(3):
            intent = self.retry.run(lambda: self.client.api(prefix + 'output-intent',
                {**lease, 'bytes': output['bytes'], 'sha256': output['sha256']}))
            cp.save(stage='uploading', assetId=intent['assetId'])
            if intent.get('state') != 'ready':
                try:
                    self.retry.run(lambda: self.client.put(intent['uploadUrl'], output['path']))
                except Rejected:
                    continue  # expired/refused URL: ask again, same logical asset, fresh URL
                try:
                    self.retry.run(lambda: self.client.api(prefix + 'finalize', {**lease, 'assetId': intent['assetId']}))
                except Rejected as error:
                    if error.code == 'INVALID_GLB':
                        raise JobFailure('EXPORT_FAILED') from None
                    continue  # ASSET_NOT_UPLOADED / *_MISMATCH / ASSET_REJECTED: new intent
            cp.save(stage='finalized', assetId=intent['assetId'])
            self.retry.run(lambda: self.client.api(prefix + 'complete', {**lease, 'assetId': intent['assetId']}))
            cp.save(stage='completed', completedAt=time.time())
            print('Completed job', job_id, flush=True)
            return
        raise Retryable('Upload could not be verified')

    def run_with_lease(self, job_id, lease, stage, body):
        """Runs body() while a background thread keeps the lease alive; returns when body finishes."""
        lost, done = threading.Event(), threading.Event()
        stage_ref = [stage]
        last_success = [time.monotonic()]

        def heartbeat():
            while not done.wait(self.heartbeat_seconds):
                try:
                    self.worker_heartbeat()
                    self.client.api('jobs/' + job_id + '/heartbeat', {**lease, 'stage': stage_ref[0]})
                    last_success[0] = time.monotonic()
                except LeaseLost:
                    lost.set()
                    return
                except Exception:
                    if time.monotonic() - last_success[0] > 90:
                        lost.set()
                        return

        pulse = threading.Thread(target=heartbeat, daemon=True)
        pulse.start()
        try:
            return body(lost, stage_ref)
        finally:
            done.set()
            pulse.join(timeout=2)

    def execute(self, job):
        job_id = job['jobId']
        lease = {'leaseToken': job['lease']['token']}
        cp = Checkpoint(self.root, job_id)
        output_ready = [False]
        try:
            if job.get('protocolVersion') != 1 or job['kind'] not in self.capabilities or job['modelRevision'] != self.capabilities[job['kind']]:
                raise JobFailure('MODEL_UNAVAILABLE')
            digest = input_digest(job)
            existing = cp.load()
            output =cp.recoverable_output(job, digest) if existing else None
            if existing and not output:
                cp.reject('does not match this assignment or output is missing/altered')
            if output:
                output_ready[0] = True
                print('Reusing verified output for', job_id, '(no new inference)', flush=True)
                cp.save(attempt=job['lease']['attempt'], leaseToken=lease['leaseToken'], stage='output_ready')
            else:
                output = self.run_lease_bound(job, lease, cp, digest)
                output_ready[0] = True
            self.run_with_lease(job_id, lease, 'uploading', lambda lost, stage: self.publish(job_id, lease, cp, output))
        except JobFailure as failure:
            if output_ready[0] and failure.code != 'EXPORT_FAILED':
                print('Output kept; not failing', job_id, flush=True)
            else:
                if cp.data:
                    cp.save(stage='failed', failure=failure.code)
                self.report_failure(job_id, lease, failure.code)
        except CredentialLost:
            print('Stopped: credential no longer valid for', job_id, '(checkpoint kept)', flush=True)
        except LeaseLost:
            print('Stopped: lease lost for', job_id, '(checkpoint kept for a later lease)', flush=True)
        except Exception as error:
            if output_ready[0]:
                # Unknown outcome after an output exists: keep checkpoint; resume/reclaim publishes it later.
                print('Publish incomplete for', job_id, type(error).__name__, '(checkpoint kept, will reconcile)', flush=True)
            else:
                print('Job failed:', job_id, type(error).__name__, '(details in local adapter log)', flush=True)
                self.report_failure(job_id, lease, 'INFERENCE_FAILED')

    def run_lease_bound(self, job, lease, cp, digest):
        job_id = job['jobId']
        prefix = 'jobs/' + job_id + '/'
        attempt_dir = cp.dir / ('a' + str(job['lease']['attempt']) + '-' + self.instance[:8])
        attempt_dir.mkdir(parents=True, mode=0o700, exist_ok=False)  # unique per attempt + process instance
        engine = self.engines[job['kind']]

        def body(lost, stage):
            stage[0] = 'preprocessing'
            assets = []
            for index, asset in enumerate(job['input']['assets']):
                if lost.is_set():
                    raise LeaseLost('lease lost')
                local = attempt_dir / ('input-' + str(index) + ('.jpg' if asset['role'] in ('front', 'side', 'back', 'detail') else '.glb'))

                def fetch(asset=asset, local=local):
                    try:
                        self.client.download(asset, local)
                    except (Rejected, Retryable):
                        renewed = self.client.api(prefix + 'input-url', {**lease, 'assetId': asset['assetId']})
                        self.client.download({**asset, **renewed}, local)
                self.retry.run(fetch)
                assets.append({'role': asset['role'], 'assetId': asset['assetId'], 'localPath': str(local)})
            output = attempt_dir / 'output.glb'
            manifest = attempt_dir / 'input.json'
            manifest.write_text(json.dumps({'protocolVersion': 1, 'protocolRevision': PROTOCOL_REVISION, 'jobId': job_id, 'kind': job['kind'],
                'params': job['input']['params'], 'assets': assets, 'modelRevision': job['modelRevision'],
                'avatarVersionId': job['input']['avatarVersionId'], 'garmentVersionId': job['input']['garmentVersionId'],
                'outputContract': job['outputContract'], 'outputPath': str(output)}, indent=2), encoding='utf8')
            # Only operator-authored argv is executed, never an app/user-supplied command or shell string.
            command = [value.replace('{input}', str(manifest)).replace('{output}', str(output)) for value in engine['command']]
            stage[0] = 'draping' if job['kind'].endswith('.drape') else 'reconstructing'
            log_path = attempt_dir / 'adapter.log'
            err_path = attempt_dir / 'adapter.err'  # private; parsed for one structured error record only
            with log_path.open('wb') as log, err_path.open('wb') as err:
                process = subprocess.Popen(command, cwd=attempt_dir, env=adapter_environment(self.token), stdout=log,
                    stderr=err, start_new_session=os.name != 'nt', pass_fds=self.lock.fds())
                cp.save(version=CHECKPOINT_VERSION, jobId=job_id, modelId=job['modelId'], kind=job['kind'],
                        modelRevision=job['modelRevision'], inputDigest=digest, attempt=job['lease']['attempt'],
                        leaseToken=lease['leaseToken'], instance=self.instance, stage='inferring', adapterPid=process.pid,
                        attemptDir=attempt_dir.name, output=None)
                try:
                    started = time.monotonic()
                    while process.poll() is None:
                        if lost.wait(1):
                            raise LeaseLost('lease lost during inference')
                        if time.monotonic() - started > engine.get('timeoutSeconds', 1800):
                            raise JobFailure('TIMEOUT')
                finally:
                    stop_process(process)
            if process.returncode != 0:
                raise JobFailure(classify_exit(process.returncode, engine, err_path))
            stage[0] = 'exporting'
            if not glb_ok(output):
                raise JobFailure('EXPORT_FAILED')
            result = {'file': attempt_dir.name + '/output.glb', 'bytes': output.stat().st_size, 'sha256': sha256_file(output)}
            cp.save(stage='output_ready', output=result, adapterPid=None)
            return {'path': output, 'bytes': result['bytes'], 'sha256': result['sha256']}

        return self.run_with_lease(job_id, lease, 'preprocessing', body)

    def resume_pending(self):
        """After a restart or an exhausted retry: reconcile outputs whose publish outcome is unknown."""
        jobs = self.root / 'jobs'
        if not jobs.exists():
            return
        for path in sorted(jobs.glob('*/checkpoint.json')):
            cp = Checkpoint(self.root, path.parent.name)
            data = cp.load()
            if not data:
                continue
            if data.get('stage') == 'inferring':
                # Interrupted inference has no trusted output. Never reuse a half-written file.
                cp.save(stage='interrupted')
                continue
            if data.get('stage') not in RESUMABLE or not data.get('leaseToken') or not data.get('output'):
                continue
            job_id, lease = data['jobId'], {'leaseToken': data['leaseToken']}
            output_file = (cp.dir / data['output']['file']).resolve()
            if cp.dir.resolve() not in output_file.parents or not output_file.exists() or sha256_file(output_file) != data['output'].get('sha256'):
                cp.reject('output missing or altered')
                continue
            output = {'path': output_file, 'bytes': data['output']['bytes'], 'sha256': data['output']['sha256']}
            try:
                if data.get('stage') == 'finalized' and data.get('assetId'):
                    try:  # complete may have committed while its reply was lost: replay is idempotent
                        self.client.api('jobs/' + job_id + '/complete', {**lease, 'assetId': data['assetId']})
                        cp.save(stage='completed', completedAt=time.time())
                        print('Completed job', job_id, '(reconciled)', flush=True)
                        continue
                    except LeaseLost:
                        pass
                self.client.api('jobs/' + job_id + '/heartbeat', {**lease, 'stage': 'uploading'})
                print('Resuming publish for', job_id, 'with the original lease', flush=True)
                self.run_with_lease(job_id, lease, 'uploading', lambda lost, stage: self.publish(job_id, lease, cp, output))
            except CredentialLost:
                print('Credential rejected while resuming', job_id, flush=True)
            except LeaseLost:
                pass  # lease is gone; the job is requeued by the server and reclaim will reuse this output
            except Exception as error:
                print('Resume deferred for', job_id, type(error).__name__, flush=True)

    def loop(self, once, poll_seconds):
        while True:
            try:
                self.worker_heartbeat()
                self.resume_pending()
                job = self.claim()
                if job:
                    if job.get('redelivered'):
                        print('Claim reply was lost; received the same assignment again', flush=True)
                    self.execute(job)
                if once:
                    return 0
            except KeyboardInterrupt:
                return 0
            except Exception as error:
                print('Worker connection unavailable:', type(error).__name__, flush=True)
                if once:
                    return 1
            time.sleep(poll_seconds)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--once', action='store_true', help='Reconcile pending outputs, claim at most one job, then exit')
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding='utf8'))
    root = Path(config.get('workDir', './worker-data')).resolve()
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    lock = DirLock(root)
    if not lock.acquire(float(config.get('lockWaitSeconds', 0))):
        print('Another worker or an orphaned adapter still holds this workDir; not starting a second inference.', flush=True)
        return 2
    try:
        containment = ensure_process_containment(config)
    except ContainmentError as error:
        print(str(error), flush=True)
        return 3
    print(f'Process containment: {containment}', flush=True)
    worker = Worker(config, os.environ['FITMATCH_WORKER_TOKEN'], root, lock)
    return worker.loop(args.once, float(config.get('pollSeconds', 8)))


if __name__ == '__main__':
    sys.exit(main())
