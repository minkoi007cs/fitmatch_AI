# Project audit and acceptance — 06 November 2026

Session CX-PROJECT-AUDIT-16. Application7be869c; operationsb23f071. Evidence: exact app source/diffs and existing independent logs; PR4df8087a and PR590184b1 sanitized reports read this session; live PC snapshot; npm audit snapshot. No application source changed in this audit. This is an engineering acceptance review, not an exhaustive penetration test or visual acceptance of PC artifacts we have not opened.

## Decision

First-release acceptance: **NEEDS CHANGES**. G1–G3 remain NOT VERIFIED for real personal-avatar/full-garment/remote pilot. App fixture flow is substantially implemented and tested. Engines remain disabled; do not merge/deploy or declare readiness from test counts.

## Estimated development completion: 46/100 (rough range40–50)

This is an explicitly subjective, weighted planning estimate against the agreed first release; not measured quality, probability of success, percent tests passed, or remaining calendar time. Scores grant credit for implementation and partial evidence; unverified personal output receives little credit. Animation/later categories are excluded from first-release denominator, but remain future scope.

| Workstream | Weight | Estimated completion | Contribution | Basis / missing |
|---|---:|---:|---:|---|
| App flow/wardrobe/capture/Studio/looks |25|80%|20.00|Synthetic E2E works; URL refresh, privacy recovery, real mobile/pilot remain |
| Personal avatar and editor |25|15%|3.75|Capture/body-fit groundwork; no accepted face likeness, real slider/text engine or timed full run |
| Personal tee+jeans reconstruction/fitting |20|35%|7.00|Reference templates/export/UV/render; no personal clothing proof, local strain high |
| Owned recommendations / AI support |10|65%|6.50|rules-v1 implemented; Qwen runtime measured, OCR still wrong and not integrated |
| Reliability/security/privacy |10|65%|6.50|Recovery/ownership/local DB tests; cloud storage/PC deletion/revision gaps |
| Remote pilot / 24x7 operation |10|20%|2.00|Outbound worker foundation/native reports; no two-account HTTPS real run or endurance evidence |
| Total |100||45.75|Rounded46%; revise only with new evidence |

## Evidence and audit findings

- Independent app evidence on7be:48unit,lint/build,6PostgreSQLblocks,13HTTP/browserblocks,20schemafiles. Python18 on Mac. Native Windows unmodified suite reported17pass/1error due venv launcher PID; proposal18pass is not upstream PASS.
- P1 PRIV-01 (static source finding; failure injection assigned to Claude): source-retention RPC returns object paths only for not-yet-deleted rows. API commits tombstones then best-effort storage.remove. If remove fails, retry delete returns no paths, UI hides deletion controls once source_retention=deleted. Dry-run GC lists candidates but no collector executes. Thus source may remain physically stored indefinitely despite request. Tombstones prevent logical reuse, not physical deletion. Add durable retry work, idempotent reattempt and truthful pending UI; do not delete derived outputs/looks. Confirm via injected storage failure/recovery tests.
- P1 QUAL-01: no reviewed personal face/body/garment pipeline/editor. Videos accepted by app do not prove multiview fusion.15–30minute target unmeasured. Template body is untextured, not identity proof.
- P1 OPS-01: native failure/proposal needs Mac review; exact shared-lock path must be configured (worker default ProgramData differs from setup lock). No live integration acceptance for full v1-r2/video/bottom inference. Do not nest a lock-owning worker under a guard taking the same lock.
- P2 CACHE-01: exhausted fitting regeneration now implemented/tested. Engine-revision pinning/cache regeneration policy remains MAC-14C; no automatic wardrobe-wide invalidation.
- P2 URL-01: modelBytes fails on non-OK signed URL and asks manual reopen; no bounded same-version URL refresh. Preserve original model identity/hash/size and abort stale selection; do not infer again.
- P2 LOOK-01: reopening validates downloaded bytes against current asset metadata and expected fitting hashes; avatar snapshot hash is not compared in openCloud. Immutable model assumption reduces normal risk, but whole-look snapshot enforcement should include avatar and explicit fitting IDs. Existing terminal-only regeneration does not supersede successful fitting outputs; do not claim an observed saved-look corruption bug.
- P2 INPUT-01: video checks container only; duration/codec/usable frames rely on engine and have no real input validation evidence. Retention defaults/failed jobs/account deletion and PC job-folder lifecycle remain incomplete.
- P2 DEP-01: npm audit snapshot reports8moderate,0high/critical, concentrated ESLint/TypeScript/minimatch tooling tree. Fix suggestions include a Next lint-config downgrade, so do not apply audit fix --force. Review upstream-compatible changes separately. This snapshot is not a complete supply-chain/security attestation.

## PC report review (not independent artifact rerun)

PR4: reference006 threeGLB2,142,956bytes,8views,Khronos0/0 and seam closure reported. Max local strain72.491%,p95=5.936%,89edges>20%; physical/material quality NEEDS CHANGES despite zero format errors. Artifacts remain private PC local; reviewer has not opened GLB/images. Adapter conformance is explicit disabled3JPEG subset, not all engine kinds.4native probes reported with actual interpreter PID tracking.

PR5: same713BF16tensor payloads re-sharded without download; process peak working set3.920→1.746GiB,detail hostavailable floor3.124GiB reported. Different starting pressure/sample counts prevent throughput/SLA comparison.14CPUtests,2guardedGPUruns; DELO→DEL remains incorrect. Fixture labels cover2public references only. OCR stays unverified/autoapply off. No resident Qwen service. Both owners ACK shared lock/guardhash.

## Release evidence still required

1. Authorized personal video/face/height and own tee+jeans front/back; mark missing as needs_input.
2. Real textured body/top/bottom in one frame, close-up face and garment source/render comparisons; owner likeness approval.
3. Editor capability manifest + one effective face edit, body edit and typed intent preview/undo/version handling.
4. Native worker/adapter conformance for actually supported kinds, no capabilities enabled from disabled-validator pass.
5. Real test Supabase/private storage/HTTPS, two owners, offline/restart/cancel/retention,1GPU serialization and ready-asset reuse.
6. Measured full pipeline timing/RAM/VRAM, repeated runs and actual viewer performance. No public24x7SLA yet.

## Assignments

PC3D: finish code/evidence handoff and Windows proposal, investigate seam-strain without arbitrary garment scaling, prioritize actual avatar/garment capability feasibility and input checklist. Qwen: stop chasing same2fixture OCR; larger licensed CPU fixtures/robust validation + resource failure tests, GPU only necessary measured cases under sharedguard. Claude: independent review Codexdelta; implement PRIV-01 and URL-01, then snapshot enforcement and pilot runbook; cache enginepolicy proposal before schema change. Detailed prompt in docs/handoffs/prompt-claude-post-audit-20261106.md. Codex retains review/coordination, no simultaneous edits in assigned files.
