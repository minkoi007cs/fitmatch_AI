# PC-CONF-01 — adapter conformance and error mapping R1

Session **PC-20261105-CONF01-03**, H-PAIR-007, 2026-11-05 America/New_York. Existing PC/GPU owner, CPU-only. **Ready for review within this limited task; not engine readiness.** Keep PC-03 Blocked by the owner-directed MSVC pause, full PC-05 incomplete, checkpoint004 unchanged and engines empty.

## Receipt, scope and actual revisions

Read full AGENTS.md → agent.md → roadmap.md → process.md at operations **5793e01c93391b5b304f6be1203e9cba74c86b58**, PROC-0007, then pc-claude-next-20261105.md and the versioned V2 contract/worker snapshot. DraftPR1 was open/draft/unmerged at head4ee404d476d1e733e7d1b8d30a171abd9a646615. GPU branch `codex/pc-gpu-pipeline` was clean at **acb4719d61eac73e99aa53469f27201c2bb6c939**; existing adapter implementation was29725dac43d0a49710fee63fc3c36a6f3353b2e7. Local PC journal recorded this task before editing.

Only added targeted conformance tests and a minimal UUID identity fix, local commit **37213bc7907901b95c4049276b09ca4eaede5822**. No model/env download, inference, rasterizer/compiler build, UAC, live credentials, transport/server/SQL edit, driver/restart or product-feature scope. PC source stays local; this PR contains reports and sanitized metadata only. The source is available on the existing PC checkout and local Git commits; reviewers elsewhere have not thereby received/executed it. Do not turn these results into a gate PASS.

## Exact local adapter interface

Operator-authored argv: `python workers/windows/adapters/sith_avatar.py --input <input.json> --output <output.glb>`. No job-provided executable/command or shell. The optional `--inspect-input` is a diagnostic invocation, **never an engine command to advertise**.

The local JSON is the snapshot worker's adapter manifest, not the network lease envelope. Required top-level fields, with no extras:

| Field | Actual checks / limits |
| --- | --- |
| protocolVersion | Integer1; Boolean true is rejected. Route baseline remains `/api/v2/worker` |
| kind | Only avatar.reconstruct boundary; engine execution is disabled |
| jobId | Parseable UUID; no owner/lease authorization is performed by adapter |
| avatarVersionId, garmentVersionId | Required fields, either null or parseable UUID; server/transport owns semantic version binding |
| params | Exactly heightCm, finite int/float100–230; bool/extra params rejected |
| assets | Exactly3 distinct roles, set front/side/back; input order is not enforced by this adapter |
| assets entry | Exactly role, assetId, localPath. IDs compare canonical UUID identity after this fix; files/roles must also be distinct |
| modelRevision | Exactly model/revision, each nonempty string of at most160 characters. Shape check only: no revision is accepted for actual engine execution |
| outputContract | Required format=glb-v2, units=meters, up=+Y, front=+Z, embeddedTextures=true, integer maxFileBytes20–41943040. Optional content is a1–80 character string; semantic content values need the accepted contract revision |
| outputPath | Absolute local .glb destination; must equal resolved CLI output path and not exist |

Manifest maximum256KiB. Its resolved parent is the private job-directory boundary. Photo localPath must be absolute, resolve inside that directory, be a distinct regular .jpg/.jpeg/.png file of8bytes–12MiB with JPEG/PNG signature. CLI output is resolved to an absolute path and must remain in the same job directory. No file or directory is created by adapter; the transport owns job-directory creation. CLI-relative output may resolve correctly, but deployment commands should use absolute argv as the runbook requires.

This preflight checks file/header/schema only, not full photo decoding, provenance, image quality, semantic height, owner/version identity or calibrated coordinates. It consumes **no images for inference**. The planned SiTH conditioning is front-only; side/back are not fused. Existing demo RGBA/keypoints do not establish normalized JPEG preprocessing for real inputs.

## Trust boundary and credentials

In the historical snapshot, transport downloads and verifies bytes/SHA-256 of normalized input. It then passes only role/assetId/localPath to the adapter; URLs, download hashes, byte counts, worker token and lease envelope are not manifest fields. Adapter does not reverify download hashes or call server authentication. Server and transport remain authoritative for owner, assignment, lease, cancel/revoke, input identity and staging/finalization. Any new hash/error schema requires both owners to agree a pinned revision; do not silently insert fields into this strict manifest.

The adapter rejects nonempty known Fitmatch token-family environment variables and Supabase service-role/secret keys with INVALID_INPUT. This is a guard, **not proof that the parent removed credentials before launch**, and not a universal secret detector. Conformance subprocesses used an allowlisted OS environment; the credential case injected only a synthetic sentinel and verified it was not echoed. Real credentials were never supplied. Claude's transport must still strip all credentials, including future token variables, before creating subprocesses.

## Actual stdout, stderr and exit behavior

For a structurally valid manifest in normal mode, stdout is empty, stderr is a single compact JSON object and exit is **78**:

```json
{"success":false,"code":"MODEL_UNAVAILABLE","reason":"SiTH adapter is disabled; no inference or GLB was produced"}
```

Manifest/schema/file/known-credential failures return **2**, stdout empty, and compact stderr JSON with success=false, code=INVALID_INPUT and a fixed redacted reason. For example malformed JSON reports `Invalid manifest JSON`; filesystem errors use a generic fixed message. User values, credentials, paths and image contents are not included in these reasons.

**Exit2 alone is ambiguous:** missing required CLI arguments are handled by argparse, with usage text on stderr and no adapter JSON. Such usage text may include an operator-local script path; parent must not forward raw stderr to public logs/UI. `--inspect-input` returns0 and a JSON receipt on stdout, empty stderr, engineAvailable=false, inferencePerformed=false, no capabilities and no output. Exit0 from inspection must never be treated as a successful engine/artifact.

No exit code for OOM, reconstruction failure or export failure is implemented or executed by this disabled adapter. No proposed exit3/4/5 contract was adopted.

## Mapping proposal for Claude — not integrated or jointly accepted

This table is a **proposal** for the R1 transport owner based on the actual local observations; PC did not edit the transport or server. Pin both revisions and add transport fixture tests before claiming compatibility.

| Observed signal / future condition | Proposed protocol result | Evidence status |
| --- | --- | --- |
| Exit78 plus valid error JSON code MODEL_UNAVAILABLE | MODEL_UNAVAILABLE; no output upload/complete | CLI signal executed; mapping proposed |
| Exit2 plus valid error JSON code INVALID_INPUT | INVALID_INPUT; no output upload/complete | CLI signal executed; mapping proposed |
| Exit2 with argparse usage/non-JSON, unknown exit, malformed/oversized error record or code/exit mismatch | INFERENCE_FAILED, with private operator diagnostic; never echo raw stderr | Usage signal executed; other conditions Not run |
| Exit0 inspection receipt with no output | Not success/readiness. A misconfigured engine command must fail artifact checks; propose EXPORT_FAILED for missing/invalid engine output | Inspection signal executed; parent artifact mapping proposed |
| Future explicit export error, or exit0 followed by failed GLB/header/structural gate | EXPORT_FAILED; future execution contract and transport fixture still required | Not run as adapter/transport failure |
| Future typed CUDA OOM with an agreed bounded structured error contract | OOM; no local OOM exit number assigned | Not run |
| Parent-enforced timeout | INFERENCE_FAILED with private timeout classification under current protocol. Do not infer OOM from a killed process | Not run |
| Parent cancellation, lease loss or revoked authorization | Follow authoritative cancel/fencing/recovery policy; do not publish output or blindly post fail using a lost assignment | Not run |

The first four parent-facing signals were exercised locally; the parent mapping itself is not implemented here. Export/OOM/timeout/cancel policies are proposals/Not run. Parse one bounded UTF-8 error object, require success=false and a known code matching the agreed exit behavior, otherwise use a conservative fallback. Do not regex-match arbitrary tracebacks or accept job-provided error-to-command mappings. Success still requires an actual output file and independent validation. Recovery after upload/finalize/complete uncertainty remains Claude's separate R1 responsibility.

The historical snapshot currently turns all nonzero adapter exits into INFERENCE_FAILED. Therefore it would misclassify this real exit78 without the R1 mapping change. This report does not say that a newer unreceived worker has already been fixed.

## Targeted CPU verification and reproduced correction

Coverage gaps justified new checks; the old21-test suite was **not rerun wholesale**. Parent fixture generation/GLB checks use the existing geometry environment; real adapter CLI subprocesses use existing SiTH Python3.10, with no Torch/model imports. Fixtures are temporary synthetic JPEGs and a two-triangle textured plane, not personal photos or avatars.

1. Before fix:12 enumerated cases,10 passed,1 failure,1 skipped, runner exit1. A braced and an unbraced UUID representing the same asset identity passed the raw-string duplicate check, so the disabled adapter returned78 rather than INVALID_INPUT. Engine stayed disabled; no inference or output occurred.
2. Minimal fix canonicalizes UUID identity for the duplicate-ID set. Exit78, schema, engine disablement and transport are unchanged.
3. After fix: **11 passed,0 failed,1 skipped**, runner exit0,0.728s. The skipped symlink case is **Not run**: Windows file-link creation returned winerror1314. No UAC/elevation or alternative bypass was attempted. Ordinary existing-file path escape was executed and rejected.
4. Two existing targeted identity/valid-manifest regressions passed, exit0,0.045s. No fresh claim about the complete historical21 suite is made.

The new checks include actual CLI malformed JSON, disabled/inspect distinction, semantic duplicate IDs, duplicate role, output overwrite protection, existing outside-job photo, dummy multitoken refusal and argparse usage; plus a nondegenerate UV/embedded-image fixture that reloads with the expected pixels, invalid material index, image MIME mismatch and corrupted embedded-image bytes rejected by the decoder. Assertions make the runner exit1 on failure; the initial failing UUID case demonstrated that behavior.

Local commands, from the GPU checkout (absolute workspace prefix intentionally omitted in public docs):

```powershell
& '<workspace>/envs/garmentcode/Scripts/python.exe' workers/windows/test_adapter_conformance_r1.py --adapter-python '<workspace>/envs/sith/Scripts/python.exe' --report '<workspace>/reports/pc-conf01-final.json'
$env:PYTHONPATH='workers/windows'
& '<workspace>/envs/garmentcode/Scripts/python.exe' -m unittest test_sith_adapter.DisabledAdapterTests.test_rejects_duplicate_roles_and_assets test_sith_adapter.DisabledAdapterTests.test_preflight_is_not_engine_readiness_or_multiview -v
```

Raw repro/final/regression logs and JSON remain outside Git under reports/pc-conf01-*. The [existing evidence file](PC-20261105-OPS004-02-evidence.json) now appends exact source/log hashes, case names, observed exits and skip status for this session. Those hashes identify local evidence, not independent reviewer execution.

## Validator scope, limits and encoding correction

Header-only transport validation checks magic/version/file length, not decoded images or UV/material references. The existing generic local inspector also checks embedded buffer/view bounds, static triangle restrictions and compression exclusions. Optional require_texture additionally checks base-colour texture references, matching UV attribute presence, embedded PNG/JPEG MIME and image decoding. It is **not** a full glTF accessor/reachability/numerical-validity validator; production still needs Khronos validation plus independent reload/render. A UV attribute's presence does not prove useful/nondegenerate mapping on arbitrary assets. The positive fixture's UV/pixels were checked separately by Trimesh reload.

Neither gate proves metres/+Y/+Z, calibrated shared origin, likeness, logo/colour fidelity, garment-only content, clean-body separation, normals/holes/self-intersection or drape fit. Existing collision/debug GLB has no texture and normalized units; it remains a diagnostic, not an avatar capability. No new body/garment output was produced. The local exporter cap **40,000,000bytes** remains stricter than snapshot transport40MiB/41,943,040bytes; no unilateral wire/cap change.

Repaired three punctuation locations in two PR1 Markdown files: the em dash in the report title and arrows in the report/delta. Cause was a default Windows-1252 read of UTF-8 text during the prior report update. A strict inverse decoding restored UTF-8, and the reviewed diff changed punctuation only before the new conformance append. All subsequent reads/writes use explicit UTF-8; roundtrip and mojibake/private-data scans are checked before publication. Original measurements/history are preserved.

PC-CONF-01 is **Ready for review**, with the symlink check explicitly Not run. Claude can consume this report/PR proposal; PC does not message or modify another owner automatically. Wait for Codex review of the bounded CPU handoff; no additional task, capability, compiler or inference is started. No claim of a textured avatar or completed avatar/garment pipeline.
