# CAT54 — clothing recognition and worker status

The application now supports a versioned analysis policy for T-shirts, shirts, hoodies, jackets, sweaters and jeans. The real GPU retest is still pending at this checkpoint; schema acceptance is not evidence of model accuracy.

## Cause and change

The previous prompt, result schema, confirmation request and database confirmation allowlist supported only T-shirts and jeans. The old jacket sample therefore abstained under the intended old policy. Its raw model text was not retained, so the historical digest cannot establish which category the model actually emitted.

New requests use `qint.2`, separating their dedupe identity from old `qint.1` results. Legacy result validation retains the original vocabulary. New categories map to existing Wardrobe values without coercing hoodies or jackets into T-shirts. Human confirmation remains necessary; no material guess or new 3D capability was added. Uncertain, unreadable, ambiguous and unsupported inputs can still abstain.

The app now distinguishes a disabled owner worker (“AI processing is paused”) from an enabled worker without a fresh connection. The previous “PC offline” message incorrectly covered both cases. This is a truthful status correction, not a claim that unattended GPU processing runs continuously.

## Implemented and checked

- App source: `e6541f4f129b2fec16eedf1d275db8f612387eeb`, branch `codex/qwen-category-54`.
- Production deployment: `dpl_CHapZxpSRzga6oAnyRGENYjMAvGE`; READY and independently verified on https://fitmatch.minkoi.org.
- The existing production analysis flag is enabled persistently. Worker grants and finite GPU admission remain separate.
- Database migration `20261116153215_qwen_top_categories` changes only the confirmation function's category allowlist. Owner/source/digest/replay checks, invoker execution and existing function grants remain unchanged.
- Fresh private public-schema/data backup: 518,813 bytes; custom archive catalog verified. The existing restored PostgreSQL 17 environment was cloned for local confirmation tests. Synthetic category confirmations and negative owner/digest/source/allowlist cases passed and rolled back. This is not a new backup of all Storage object bytes.
- Full app unit run: 125 passed. Later focused schema/read/status/UI checks: 19 passed, including four server-rendered UI regressions. Build passed after the latest runtime changes. Generated contract drift check passed for 52 artifacts. Lint has no errors and one unchanged warning in historical report code.
- PC candidate source review: `04babb755613069eb31627a624dcf51b9adc5109`, exact contract snapshot `1cef14d6fc866b21ade675fb425b383be3dcd6ed`. All 22 new category/mapper/CLI CPU tests passed. The broader PC run had 176 passed, zero failures/errors and one pre-existing Windows symlink case Not run (WinError1314); its strict zero-skip harness returned 1. It is not reported as a full-suite pass.

## Current real-test input

The historical jacket item was removed from the app and is not restored. The later jeans request is separate. The current owned beige hoodie remains visible in Wardrobe with its previously confirmed T-shirt metadata.

Codex used the owner's authenticated browser session to press “Analyze with updated AI” on that hoodie. The app created a new `qint.2` analysis, confirmed independently in the canonical database. The old confirmed result and wardrobe metadata are preserved while the new proposal is pending. No deleted or canceled job was reused.

The isolated PC runtime and helpers are being bound to this new job. A new finite GPU window, actual model result, independent server verification and native closeout are required before the recognition fix can be called verified on the image.

## Runtime review and current execution boundary

Root reviewed the PC helper source and complete literal diffs at `3b9138914e404c0f55b148262a5a68e643f6710a`. The new runtime has 111 verified source entries in a separate directory; the original 98-source runtime and earlier results remain intact. The observer, strict JSON/binding checks, timestamp parsing, bounded HTTP, one-start marker, native process tracking and disabled-approval restoration retain the reviewed implementations. The 29 inherited helper fixtures passed before final path/hash-only substitutions.

The coordinator and W008 PowerShell wrapper/publisher were implemented in new paths and reviewed in full. Only job/app/path/pin/count constants changed; the shared guard, transport and private audit rules remain unchanged. PowerShell parsing reported zero errors and Python nonliteral AST was unchanged. Bounds remain a 600-second slot, 240-second engine, 30-second drain and 330-second observation with at least 360 seconds remaining before launch.

Codex on the PC now requires a fresh execution approval for the concrete W008 wrapper. It reports waitingOnApproval; no new READY, heartbeat, slot or model inference is established. The server worker and local execution authorization remain disabled. The earlier W007 approval is not reused. No recognition-success claim is made until the actual result is stored and reviewed.

## W008 pre-admission stop

The owner approval reached the PC and W008 emitted actual READY. A fresh heartbeat returned HTTP 200. The coordinator then refused source_pin_mismatch before slot allocation: the 111-entry candidate includes its exact contract Markdown document, while the older coordinator only admitted .py/.json source entries. The document's actual hash matched its expected hash; its 10,118-byte size was within the bound. The integration review missed this file-type mismatch.

No allocation-attempt, applied-slot or issued receipt was created, and the previous closed slot bytes remained unchanged. No model or worker was started. The worker was disabled again and the separate jeans job's temporary eligibility delay was restored to its original value without cancellation or an attempt.

The coordinator owner is preparing a focused correction for that one canonical document path and its hard-pinned hash, retaining the actual manifest hash/size/path checks. A new W009 metadata window preserves all failed W008 evidence and avoids reusing its heartbeat attempt marker. Recognition remains unverified pending the actual model run.

## November 17 execution handoff

The corrected coordinator and full W008-to-W009 wrapper/publisher diffs were reviewed. Only the canonical contract document with its fixed digest is admitted; path containment, source digest, size limits and native checks remain. Nine focused CPU checks passed. Existing successful packaging was reused, with zero PowerShell parse errors; tests were not repeated. Current coordinator/wrapper/publisher digests begin f956e884, cc132bbf and e4ff0c13.

Fresh PC readiness reported approximately 7.9 GiB available RAM and 11.5 GiB free VRAM, no leftover model processes and matching runtime pins. The production alias still resolves to dpl_CHapZxpSRzga6oAnyRGENYjMAvGE. Both queued jobs remain attempt zero with their original eligibility.

One normal W009 wrapper execution was dispatched. The PC reports waitingOnApproval in the existing 3d model chat; there is no actual W009 READY or model inference yet. Platform Allow must be completed by the owner. Backend enable and the single-image heartbeat/worker execution remain conditional on actual fresh READY. The hoodie recognition fix is deployed but has not yet been verified on the image.
