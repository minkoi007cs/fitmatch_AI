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
