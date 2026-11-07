"""CPU MOCK of a Qwen garment-analysis adapter (QINT-C tests only). No model, no GPU.

Reads the qwen-v1 adapter input, checks the worker's guarantees (one verified image, no credentials,
worker is the GPU lock owner) and writes a contract result chosen by FAKE_QWEN_MODE:
  proposal (default) | gpu_busy | invalid | abstain
"""
import hashlib
import json
import os
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text(encoding='utf8'))
out = Path(sys.argv[2])
assert data['contract'] == 'fitmatch.qwen-garment-analysis.v1'
assert data['kind'] == 'garment.analyze' and len(data['assets']) == 1
asset = data['assets'][0]
image = Path(asset['localPath']).read_bytes()
assert hashlib.sha256(image).hexdigest() == asset['sha256'] == data['binding']['imageSha256']
assert image[:2] == b'\xff\xd8', 'normalized JPEG snapshot'
assert data['policy']['imageIsUntrustedData'] is True
assert not any(k.startswith('FITMATCH_WORKER') for k in os.environ), 'no worker credentials in adapter env'
assert os.environ.get('FITMATCH_GPU_LOCK_HELD_BY') == 'worker', 'single lock owner: do not take the lock again'

mode = os.environ.get('FAKE_QWEN_MODE', 'proposal')
if mode == 'gpu_busy':
    sys.stderr.write('admission: another GPU job holds the device\n{"success": false, "code": "GPU_BUSY"}\n')
    sys.exit(75)
result = {
    'contractVersion': 'fitmatch.garment-analysis.result.v1',
    'binding': data['binding'],
    'modelRevision': data['modelRevision'],
    'policyRevision': data['policy']['policyRevision'],
    'rawOutputSha256': hashlib.sha256(b'mock raw output').hexdigest(),
    'outcome': 'proposal', 'abstainReason': None,
    'attributes': {'category': 'tshirt', 'dominantColors': ['red', 'white'], 'pattern': 'printed',
                   'logoPresence': 'visible', 'neckline': 'crew', 'sleeves': 'short'},
    'candidateLogoTexts': ['FITMATCH'], 'ocrStatus': 'unverified', 'approvedForAutoApply': False,
    'evidence': {'attempts': 1, 'outputTokens': 96, 'durationMs': 12, 'gpuMiB': None},
}
if mode == 'invalid':
    result['approvedForAutoApply'] = True  # a model must never self-approve
if mode == 'abstain':
    result.update(outcome='abstained', abstainReason='ambiguous_target', attributes=None, candidateLogoTexts=[], ocrStatus='not_extracted')
out.write_text(json.dumps(result), encoding='utf8')
