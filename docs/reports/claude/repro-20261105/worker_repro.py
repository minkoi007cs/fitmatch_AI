"""Drive an unmodified copy of scripts/worker/worker.py against a loopback fake server.
Scenario W1: /complete returns 503 once (reply lost)    -> does the worker send /fail after a finalized output?
Scenario W2: claim envelope revision differs from config -> does the worker release/fail the job, or leave it running?
Synthetic only: no real app, tokens, photos or models.
"""
import hashlib, http.server, importlib.util, json, sys, tempfile, threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
import os
spec = importlib.util.spec_from_file_location('worker', os.environ.get('WORKER_PY', str(HERE / 'src/scripts/worker/worker.py')))
worker = importlib.util.module_from_spec(spec); spec.loader.exec_module(worker)
PHOTO = b'\xff\xd8synthetic'
calls = []
mode = {}

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, obj=None, raw=None):
        body = raw if raw is not None else (b'' if obj is None else json.dumps(obj).encode())
        self.send_response(code); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        self._send(200, raw=PHOTO)
    def do_PUT(self):
        self.rfile.read(int(self.headers['Content-Length'])); calls.append('PUT upload'); self._send(200, {})
    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0); body = json.loads(self.rfile.read(n) or b'{}')
        p = self.path.replace('/api/v2/worker/', '')
        calls.append(p.split('/')[-1] + ('' if 'code' not in body else ':' + body['code']))
        port = self.server.server_address[1]
        if p == 'heartbeat': return self._send(200, {'success': True})
        if p == 'claim':
            return self._send(200, {'protocolVersion': 1, 'jobId': 'job-1', 'kind': 'avatar.reconstruct', 'modelId': 'm',
                'modelRevision': mode['revision'], 'lease': {'token': 't', 'expiresAt': 'x', 'attempt': 1},
                'input': {'params': {}, 'avatarVersionId': None, 'garmentVersionId': None, 'assets': [
                    {'assetId': 'a1', 'role': 'front', 'url': f'http://127.0.0.1:{port}/a', 'sha256': hashlib.sha256(PHOTO).hexdigest(), 'bytes': len(PHOTO)}]},
                'outputContract': {}})
        if p.endswith('output-intent'): return self._send(201, {'assetId': 'out-1', 'uploadUrl': f'http://127.0.0.1:{port}/put'})
        if p.endswith('finalize'): return self._send(200, {'assetId': 'out-1', 'sha256': 'h'})
        if p.endswith('complete'):
            if mode.get('drop_complete'):
                mode['drop_complete'] = False; return self._send(503, {'success': False})
            return self._send(200, {'success': True})
        if p.endswith('fail'): return self._send(200, {'success': True})
        self._send(404, {})

def run(name, revision_in_claim, drop_complete):
    calls.clear(); mode.update(revision=revision_in_claim, drop_complete=drop_complete)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
    tmp = Path(tempfile.mkdtemp())
    adapter = tmp / 'adapter.py'
    adapter.write_text("import json,struct,sys\nm=json.load(open(sys.argv[1]))\nopen(m['outputPath'],'wb').write(struct.pack('<III',0x46546C67,2,20)+b'\\0'*8)\n")
    cfg = tmp / 'config.json'
    cfg.write_text(json.dumps({'appUrl': f'http://127.0.0.1:{srv.server_address[1]}', 'workDir': str(tmp / 'work'),
        'engines': {'avatar.reconstruct': {'model': 'm', 'revision': 'r', 'command': [sys.executable, str(adapter), '{input}', '{output}']}}}))
    import os; os.environ['FITMATCH_WORKER_TOKEN'] = 'fmw_' + 'x' * 43
    sys.argv = ['worker.py', '--config', str(cfg), '--once']
    try: worker.main()
    except SystemExit: pass
    srv.shutdown()
    print(f'{name}: server saw ->', ' , '.join(c for c in calls if c != 'heartbeat'))

run('W1 complete reply lost once', {'model': 'm', 'revision': 'r'}, True)
run('W2 engine revision mismatch', {'model': 'm', 'revision': 'OTHER'}, False)
