"""Restore public source snapshots into a fresh directory; never overwrites an existing checkout."""
import hashlib
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parent
target = Path(sys.argv[1]).absolute()
if target.exists(): raise SystemExit('Destination must not exist')
manifest = json.loads((root/'source-manifest.json').read_text())
for item in manifest['files']:
    path = root/'sources'/item['snapshot']
    if hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        raise SystemExit('Snapshot hash mismatch')
target.mkdir()
for item in manifest['files']:
    relative = Path(item['restore_to'])
    if relative.is_absolute() or '..' in relative.parts: raise SystemExit('Unsafe manifest')
    output = target/relative
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_bytes((root/'sources'/item['snapshot']).read_bytes())
print(json.dumps({'restored':len(manifest['files']),'models_images_env_included':False}))
