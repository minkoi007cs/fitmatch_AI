"""PC3D coordinator helper for QREV-BIND-02 (proposal for PC3D/Qwen ACK; never run by the app).

  write   Record the EXISTING canonical lock's file identity and the ACKed guard in
          <workspace>/coordination/gpu-coordinator.json and print its sha256. Never creates,
          replaces or locks gpu0.lock, never writes a slot, never touches the guard.
  verify  Load a worker config and run the exact worker binding checks (no lock acquired, no
          network, no adapter, no CUDA). Prints the derived canonical paths or the refusal.

The policy pins only identities and relative locations; it is not an admission grant. Slots stay
in gpu0-slot.json issued by the coordinator. Re-run `write` only if the coordinator deliberately
recreated the lock (which it never should while any worker may run).
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys


def load_worker():
    spec = importlib.util.spec_from_file_location('fitmatch_worker', Path(__file__).with_name('worker.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write(args, worker):
    workspace = Path(os.path.realpath(args.workspace))
    coordination = workspace / worker.COORDINATION_DIR
    lock = coordination / worker.CANONICAL_LOCK_NAME
    if not lock.is_file() or worker._is_link(lock):
        raise SystemExit('Canonical lock must already exist as a regular file: ' + str(lock))
    rel = args.guard_relative
    guard = workspace.joinpath(*rel.split('/'))
    guard_sha = hashlib.sha256(guard.read_bytes()).hexdigest()
    if args.expected_guard_sha256 and guard_sha != args.expected_guard_sha256.lower():
        raise SystemExit('Guard bytes differ from the ACKed revision')
    volume, file_id = worker.file_identity(os.stat(lock))
    policy = {
        'kind': worker.COORDINATOR_KIND, 'coordinator': 'pc-3d', 'owners': list(worker.SLOT_OWNERS),
        'lock': {'name': worker.CANONICAL_LOCK_NAME, 'volume': volume, 'fileId': file_id},
        'slot': {'name': worker.CANONICAL_SLOT_NAME},
        'guard': {'relativeToWorkspace': rel, 'sha256': guard_sha},
        'issuedAtUtc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
    }
    target = coordination / worker.COORDINATOR_FILE
    if target.exists() and not args.replace:
        raise SystemExit('Policy exists; pass --replace only after both PC chats agree to re-pin')
    data = (json.dumps(policy, indent=2) + '\n').encode()
    tmp = target.with_name(target.name + '.tmp')
    tmp.write_bytes(data)
    os.replace(tmp, target)
    print(json.dumps({'policy': str(target), 'sha256': hashlib.sha256(data).hexdigest(),
                      'lockIdentity': {'volume': volume, 'fileId': file_id}, 'guardSha256': guard_sha}, indent=2))


def verify(args, worker):
    config = json.loads(Path(args.config).read_text(encoding='utf8'))
    try:
        admission = worker.SharedGpuAdmission(config)
    except worker.AdmissionError as error:
        print(json.dumps({'admitted': False, 'refusal': str(error)}, indent=2))
        return 5
    print(json.dumps({'admitted': True, 'lock': str(admission.lock_path), 'slot': str(admission.slot_path),
                      'guard': str(admission.guard_path), 'lockIdentity': list(admission.lock_identity),
                      'owner': admission.owner, 'note': 'binding only; no lock acquired, slot not evaluated'}, indent=2))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    w = sub.add_parser('write')
    w.add_argument('--workspace', required=True, help='Fitmatch-GPU workspace root (contains coordination/)')
    w.add_argument('--guard-relative', default='fitmatch_AI/workers/windows/gpu_guard.py')
    w.add_argument('--expected-guard-sha256')
    w.add_argument('--replace', action='store_true')
    v = sub.add_parser('verify')
    v.add_argument('--config', required=True)
    args = parser.parse_args(argv)
    worker = load_worker()
    return write(args, worker) or 0 if args.command == 'write' else verify(args, worker)


if __name__ == '__main__':
    sys.exit(main())
