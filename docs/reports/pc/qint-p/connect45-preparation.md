# CONNECT-PC-AI-45 — private enrollment reservation / disabled worker

Session PC-QINT-P-20261110-12,10/11/2026. Own baselineaef81b5; fetched operations
546ca647/PROC0043 and hosted branch6ec119a. The newer direct CONNECT45 handoff
supersedes the published CONNECT43 missing-admin status: Codex reports actual
canonical roles/schema/data/customizations +14Storageobjectbytes backup and92
offline checks complete, with actualPG17 restore proof ongoing. PC did not verify
that backup or perform cloud operations. Canonical remains not migrated, QwenOFF.

**Private preparation complete; config remains disabled and runtime NOT STARTED.**
The exact authorized origin is `https://fitmatch.minkoi.org`, expected backend
`gohczmqykjkrgdblgbog`, same appOrigin. Proposed worker label is
`pc-ai-qwen-connect45`; only capability is `garment.analyze`, pinned to existing
Qwen revision `ebb281ec70b05090aa6165b016eac8ec08e71b17`.

Fetched serving source7397b6a954dbe877e425abd09abd125398c271c4 and verified worker
SHA256 `ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6`.
The private config selects that immutable local worker and existing qwen-vl Python,
with direct worker_cli arguments `--input {input} --output {output} --policy` pointing
to the future reviewed operator approval. Production transport is unchanged.
Native33 (47PASS/9skip/0error), CPU31 and existing model/checkpoint pins are reused;
no suite/model/download/weight rehash was repeated.

The private config is a disabled **wrapper/plan**, not an installed runnable worker
config. Its inner config has pinned `gpuCoordinator {path,sha256}`, `gpuSlotOwner:
pc-ai` and canonical expectedBackend; no legacy gpuLock/gpuSlot/gpuGuard keys.
The production worker does not implement a generic enabled flag, so this wrapper
must never be passed directly to worker.py. An active config will be materialized
and hash-reviewed only after a separate backend-ready/activation handoff.

Bounded inventory found no existing worker token in process/user/machine environment
or matching reserved enrollment files. Created one new cryptographically random
32-byte token, encoded as fmw_ plus43 base64url characters. Raw token exists only
in the private PC env file. Work directory, private directory, token file, config
and reservation metadata have protected NTFS DACLs with one current-owner FullControl
allow rule and matching owner; no inherited/public/group rule. No global env was
installed. Reuse verification retained the same token/hash and did not rewrite
the secret file. The first ACL reapplication attempt lacked SeSecurityPrivilege;
verification showed the existing ACL was already correct. The idempotent helper
now verifies and retains that ACL, without elevation or permission widening.

Token SHA256 is supplied only through the task's local coordination/private
reservation receipt and return message, not this public package. No token value,
service key, password or private config is committed. Public code contains the
generation/ACL/reuse procedure, never the generated credential.

Private locations (nonsecret path metadata, machine root redacted):

- Token: `<GPU_ROOT>/worker-data/qwen-pilot/private/connect45-worker.env`.
- Disabled config: same private directory, `connect45-worker.disabled.json`.
- Reservation: same directory, `connect45-reservation.json`.
- Prepared start/stop commands: same directory, `connect45-start-stop.prepared.md`.
- Hash-only enrollment/checkpoint: coordination/qint-p-connect45-enrollment.json.

Read-only checks reused the exact worker's backend_binding and SharedGpuAdmission:
origin/canonical ref/policy-derived paths match. Coordinator policy789426d3 and
guard47331 remain pinned, same lock identity `(3699583840,2251799814103012)`.
The existing guard detected no surviving prior owned tree, but **full machine
quiescence is NOT PROVEN**: one live GPU-capable process is unreviewed. No activity
was inferred from its name and nothing was killed. Current slot is expired and
is not a pc-ai grant. No real lock was acquired/written; policy/slot/state/guard
were not changed. See [readiness](evidence/connect45/readiness.json) and
[validation](evidence/connect45/preparation-validation.json).

The prepared command uses existing qwen-vl Python, immutable worker, future exact
active-config path, and `--once` (at most one new claim), launched hidden with
stdout/stderr restricted to the private runtime directory. It gates disabled,
backend-ready and finite-slot flags before reading the credential. The token is
loaded into child environment only, never argv/log, then removed/restored in the
launcher. Proposed bounded settings are requestTimeout15s, retry3 with bounded
backoff, adapter timeout240s/drain30s and a360s observation window. These commands
were NOT executed. A venv launcher PID exit is not tree-drain proof. Normal stop
means no further dispatch/start, worker-owned drain/exit, native Job/process-handle
verification and coordinator handback. On timeout/unknown state, preserve evidence
and quarantine; no blind PID kill, lock deletion or slot release/renewal.

Remaining blockers: Codex actualPG17 restore/cutover/backend-ready handoff; scoped
hash enrollment and live operator approval; reviewed serving binding/input snapshot
and real app job; PC3D quiescence ACK and new finite pc-ai slot. No auth heartbeat,
claim, inference, runtime start or CUDA was sent/performed. The token reservation
is not enrollment or capability grant. Ready for review for private preparation;
live execution remains blocked until the explicit coordinated handoff.
