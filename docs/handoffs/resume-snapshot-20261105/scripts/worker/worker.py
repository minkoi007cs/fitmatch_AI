#!/usr/bin/env python3
"""Outbound Fitmatch worker protocol v1. Python 3.10+, stdlib only; inference adapters are separate.
Never advertises a model unless a local command is explicitly configured. No mock generation.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import struct
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

KINDS = {'avatar.reconstruct', 'garment.reconstruct', 'garment.drape'}
MAX_BYTES = 40 * 1024 * 1024

class LeaseLost(Exception):
    pass

class Client:
    def __init__(self, base, token):
        parsed = urllib.parse.urlparse(base)
        if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1')):
            raise ValueError('App URL must use HTTPS (or local loopback for development)')
        self.base, self.token = base.rstrip('/'), token

    def api(self, path, body):
        request = urllib.request.Request(self.base + '/api/v2/worker/' + path,
            json.dumps(body).encode(), {'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return None if response.status == 204 else json.load(response)
        except urllib.error.HTTPError as error:
            if error.code in (401, 403, 409):
                raise LeaseLost('Credential or lease no longer valid') from None
            raise RuntimeError('Worker API HTTP ' + str(error.code)) from None

    @staticmethod
    def download(asset, destination):
        url = urllib.parse.urlparse(asset['url'])
        if url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1')):
            raise ValueError('Asset URL must use HTTPS')
        digest = hashlib.sha256()
        size = 0
        with urllib.request.urlopen(asset['url'], timeout=60) as response, destination.open('wb') as target:
            while True:
                part = response.read(1024 * 1024)
                if not part:
                    break
                size += len(part)
                if size > MAX_BYTES:
                    raise ValueError('Input too large')
                digest.update(part)
                target.write(part)
        if size != asset['bytes'] or digest.hexdigest() != asset['sha256']:
            raise ValueError('Asset integrity check failed')


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


def execute(client, job, engine, root, capabilities):
    if job['protocolVersion'] != 1 or job['kind'] not in capabilities or job['modelRevision'] != capabilities[job['kind']]:
        raise ValueError('Unsupported protocol or engine revision')
    lease = {'leaseToken': job['lease']['token']}
    prefix = 'jobs/' + job['jobId'] + '/'
    directory = root / (job['jobId'] + '-' + str(job['lease']['attempt']))
    directory.mkdir(parents=True, mode=0o700, exist_ok=False)
    output = directory / 'output.glb'
    lost, done = threading.Event(), threading.Event()
    stage = ['preprocessing']
    # A transient heartbeat failure may recover; missing the entire lease stops inference.
    last_success = [time.monotonic()]
    def heartbeat():
        while not done.wait(20):
            try:
                client.api('heartbeat', {'capabilities': capabilities})
                client.api(prefix + 'heartbeat', {**lease, 'stage': stage[0]})
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
    process = None
    try:
        assets = []
        for index, asset in enumerate(job['input']['assets']):
            if lost.is_set():
                raise LeaseLost()
            local = directory / ('input-' + str(index) + ('.jpg' if asset['role'] in ('front', 'side', 'back', 'detail') else '.glb'))
            try:
                client.download(asset, local)
            except urllib.error.HTTPError:
                renewed = client.api(prefix + 'input-url', {**lease, 'assetId': asset['assetId']})
                client.download({**asset, **renewed}, local)
            assets.append({'role': asset['role'], 'assetId': asset['assetId'], 'localPath': str(local)})
        manifest = directory / 'input.json'
        manifest.write_text(json.dumps({'protocolVersion': 1, 'jobId': job['jobId'], 'kind': job['kind'],
            'params': job['input']['params'], 'assets': assets, 'modelRevision': job['modelRevision'],
            'avatarVersionId': job['input']['avatarVersionId'], 'garmentVersionId': job['input']['garmentVersionId'],
            'outputContract': job['outputContract'], 'outputPath': str(output)}, indent=2), encoding='utf8')
        # Only operator-authored argv is executed, never an app/user-supplied command or shell string.
        command = [value.replace('{input}', str(manifest)).replace('{output}', str(output)) for value in engine['command']]
        stage[0] = 'draping' if job['kind'] == 'garment.drape' else 'reconstructing'
        environment = {k: v for k, v in os.environ.items() if k not in ('FITMATCH_WORKER_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY')}
        with (directory / 'adapter.log').open('wb') as log:
            process = subprocess.Popen(command, cwd=directory, env=environment, stdout=log, stderr=subprocess.STDOUT,
                start_new_session=os.name != 'nt')
            started = time.monotonic()
            while process.poll() is None:
                if lost.wait(1):
                    raise LeaseLost()
                if time.monotonic() - started > engine.get('timeoutSeconds', 1800):
                    raise RuntimeError('Adapter time limit exceeded')
            if process.returncode != 0:
                raise RuntimeError('Adapter failed; inspect local adapter.log')
        if lost.is_set():
            raise LeaseLost()
        stage[0] = 'exporting'
        size = output.stat().st_size
        if size < 20 or size > MAX_BYTES:
            raise ValueError('Invalid output size')
        with output.open('rb') as stream:
            magic, version, length = struct.unpack('<III', stream.read(12))
        if (magic, version, length) != (0x46546C67, 2, size):
            raise ValueError('Adapter must export a real self-contained GLB v2')
        stage[0] = 'uploading'
        intent = client.api(prefix + 'output-intent', {**lease, 'bytes': size})
        request = urllib.request.Request(intent['uploadUrl'], output.read_bytes(),
            {'Content-Type': 'model/gltf-binary', 'x-upsert': 'false'}, method='PUT')
        with urllib.request.urlopen(request, timeout=90) as response:
            response.read()
        client.api(prefix + 'finalize', {**lease, 'assetId': intent['assetId']})
        client.api(prefix + 'complete', {**lease, 'assetId': intent['assetId']})
        print('Completed job', job['jobId'], flush=True)
    except LeaseLost:
        print('Stopped: lease or authorization lost for', job['jobId'], flush=True)
    except Exception as error:
        # Do not log signed URLs, tokens, source images or raw server/engine output.
        print('Job failed:', job['jobId'], type(error).__name__, '(details in local adapter log)', flush=True)
        try:
            client.api(prefix + 'fail', {**lease, 'code': 'INFERENCE_FAILED'})
        except Exception:
            pass
    finally:
        done.set()
        if process:
            stop_process(process)
        pulse.join(timeout=2)
        # Retained input/output is sensitive; operator controls cleanup, never upload to Git.


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--once', action='store_true', help='Claim at most one real job, then exit')
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding='utf8'))
    engines = config.get('engines', {})
    capabilities = {}
    for kind, engine in engines.items():
        if kind not in KINDS or not isinstance(engine.get('command'), list) or not engine['command'] or not all(isinstance(v, str) for v in engine['command']):
            raise ValueError('Each engine needs a supported kind and local argv list')
        capabilities[kind] = {'model': engine['model'], 'revision': engine['revision']}
    client = Client(config['appUrl'], os.environ['FITMATCH_WORKER_TOKEN'])
    root = Path(config.get('workDir', './worker-data')).resolve()
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    while True:
        try:
            client.api('heartbeat', {'capabilities': capabilities})
            job = client.api('claim', {})
            if job:
                execute(client, job, engines[job['kind']], root, capabilities)
            if args.once:
                return
        except KeyboardInterrupt:
            return
        except Exception as error:
            print('Worker connection unavailable:', type(error).__name__, flush=True)
            if args.once:
                raise SystemExit(1) from None
        time.sleep(8)

if __name__ == '__main__':
    main()
