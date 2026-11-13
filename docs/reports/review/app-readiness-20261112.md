# FitMatch AI readiness — 12 November 2026

Assessment of the full intended product, not just the website layout. **55/100** is a weighted reviewer judgment, not a percentage of passing tests or an acceptance certificate. The real offline hoodie regression passed; the remaining app job is still pending. Full-product acceptance is not reached.

## Current release and evidence

The app is online at https://fitmatch.minkoi.org. The reviewed serving application source is `f58024703bf4ec8be365bee2f8b3e1bd2248fdec` (English UI47). Later `codex/connect-45` commits contain reports. The matching Qwen-enabled deployment `dpl_EUXbt1e5FKtTHu97xT584TrPAmuL` was promoted and its exact domain alias/public HTTP 200/English hero/header were verified. The scoped worker is disabled again while there is no authorized live execution window. This is not an always-on inference service.

The earlier UI47 release passed 121 unit tests, lint with no errors and one existing report warning, the production webpack build with real fonts, and the full V2 regression suite. Those checks included mock/CPU worker flows; they do not prove real model accuracy or personal 3D quality. No app source changed during today's report work, so those unchanged suites were not repeatedly run.

Canonical Supabase backup/restore and migration were previously executed and verified; see the infrastructure cutover evidence. Today's authenticated app could read its two existing wardrobe items. The first real Qwen job completed and was manually confirmed, but its hoodie category was visually wrong. The new private regression avoids that false proposal. The second owner job remains queued, attempt 0. Successful transport and saving do not establish general semantic accuracy.

## Direct browser review today

Read-only review used the existing signed-in session. No photo upload, job submission, quiz completion, Save, confirmation, deletion or account change occurred. Private photos and account details are not included in this report.

| Area | Observed behavior | Acceptance limit |
| --- | --- | --- |
| Landing | English copy; original photo-behind-heading composition; readable header and working navigation | Signed-in helper still says “Sign in to access…” and should be made neutral or state-aware |
| Wardrobe | Two saved items load; category/color controls and edit/delete actions are present | Existing names and material labels are legacy values, not verified by the new Qwen contract; saved hoodie metadata is preserved |
| Narrow phone | At 320 px, document width 314 px; item cards 282 px at x=16; no horizontal page overflow; mobile navigation opens/closes | Style chips available on desktop are absent in this narrow view; a compact filter drawer would improve parity |
| Prepare 3D | Clear front/side/back and height guidance; private upload explanation; offline processor message; progress area | No ready 3D results; visible capture inputs are not proof that body/video/face reconstruction meets quality goals |
| Studio | Honest experimental/empty state, disabled unavailable actions, separate top/bottom controls | Account has zero ready avatars/garments. Try-on, compare, saved full looks and lookbook output cannot be accepted from this session |
| Ideas / style | Style quiz entry and first step render; recommendations identify explainable rules and require owned clothes | No completed quiz or ready avatar in this session; no actual personalized outfit-to-Studio flow was tested |

The phone viewport override was reset and the user's tab was left on Wardrobe with the mobile dialog closed.

## QWEN-48 progress

1. Independent baseline CPU reproduction confirmed that `unknown` was always mapped to a proposal.
2. Mac candidate `70a36fa971b7c56dfeedc2bbeecac525be128cbb` introduces a local garment-type assessment before attribute mapping. It passed 10 portable tests and eight synthetic results were accepted by the actual app Zod validator.
3. PC candidate `3b7edbf7dace52a24da30a19440ba6f3fe074c43` adopts the same four runtime files, adds prompt separation coverage and adapts only successful injected analysis fixtures. Actual Windows log: 81 tests passed, no failures/errors/skips, no torch/model/CUDA import. All 31 public contract/fixture files remain unchanged.
4. Mac independently applied the PC patch, verified all seven file hashes and reran 11 portable assessment tests successfully. CPU review is accepted. Original PC runtime, weights, token, transport and confirmed rows remain preserved.
5. The private helper and its pins passed 91 actual Windows CPU tests including ten refusal/tamper tests. After source/guard review and a new finite coordinator slot, the **real existing hoodie image** returned `abstained/unsupported_category`, null attributes, no OCR candidates, one attempt, 19 output tokens and 85.250 seconds. Native guard/worker observations confirmed successful exits, empty Job and free canonical lock; the slot was withdrawn. This passes only this unsupported-photo regression. The old confirmed row/cache was preserved.
6. Actual heartbeat reached the canonical backend with HTTP 200 and the sole `garment.analyze` grant. The second app job has not been claimed. A private job-ID pin proposal at `183923bfd8733e87061f2b7b3565d61988530e94` has eight CPU tests and reviewed early refusal semantics; the PC now reports installation of the exact reviewed LF admission source, synchronized manifest/config pins, and 99/99 actual candidate CPU tests (91 compatibility plus eight job-scope), zero errors/skips and no torch import. The published installation receipt at `c8b33d743ec6458093e06362a8cf14e6ae3ad03c` was fetched and read back: all 98 source pins match, approvals remain disabled, backend preflight is pending and no heartbeat/claim/GPU occurred. This is not app-job execution evidence. Its published LF patch and Windows CRLF digest were explicitly reconciled. No inference is authorized from an unreviewed source/config.
7. The 3D coordinator previously stopped with a weekly usage limit and November 16 retry date. A fresh 04:30 UTC snapshot now shows the user resumed that chat and it is waiting on an approval during native PID rechecking; a new usable GPU slot is still not confirmed. No credits were purchased or reset, account/model changed, or occupied coordinator role silently taken over. The worker was disabled while waiting; the earlier Phase B GO is explicitly closed and the resumed coordinator was told to finish only CPU readiness, preserving approval requests for the user. A fresh coordinator window and final source-pinned readiness are still required for the one existing queued app photo. No reupload is needed.

## Score out of 100

| Criterion | Weight | Awarded | Basis |
| --- | ---: | ---: | --- |
| Hosted foundation, authentication and private database/storage | 15 | 13 | Online release, verified backup/restore/migrations and tested access boundaries |
| English UI, navigation and responsive experience | 15 | 12 | Direct desktop/phone review; remaining first-use copy/filter parity issues |
| Wardrobe capture, persistence and metadata review | 10 | 7 | Existing items/save flow work; metadata provenance and correction remain weak |
| Qwen analysis and human review | 15 | 8 | Real offline regression and strict contract; genuine positive-category coverage and second app result incomplete |
| PC integration, recovery and operation | 10 | 7 | Real heartbeat/one prior end-to-end save and guarded drain; manual windows, reconnect/quota and unattended-service gaps |
| Personal avatar, face/body/hair quality | 15 | 3 | Actual partial body fit exists; likeness failed and hair reconstruction absent |
| Real garment reconstruction and fitting | 10 | 2 | Separate template engineering exists; real photo-to-T-shirt/jeans pipeline not built/accepted |
| Editing, full-look switching, comparison and saved render | 10 | 3 | App controls and fixture renderer exist; personal end-to-end engine/results are not accepted |
| **Total** | **100** | **55** | **Controlled prototype, not full first-release acceptance** |

The score does not rise simply because a model file exists. The main deductions concern the product's central promise: a convincing personal avatar wearing actual separate clothes, editable and reopened correctly.

## First Blender reference trial

After the owner supplied a four-view reference, a separate private local CPU Blender prototype was exported as `.blend` and embedded static GLB2. Both files were reopened; the GLB was imported into Blender and rendered again. Geometry was derived from the original low-resolution sheet using silhouettes and an explicit rounded-section prior, with source-projected colors. It is one closed mesh, not a rigged avatar or separate garment.

Height 1.80 m is only a display assumption. Facial depth/likeness and texture seams are not accepted. The edited extracted images contain regenerated image-tool details and were excluded from geometry truth. Source, images, model and previews remain in private ignored assets; no personal image or 3D artifact is published in this report. This trial is not connected to the production PC engine.

## Work required before acceptance

| Priority | Work | Owner / evidence required |
| --- | --- | --- |
| Done, scoped | Private real hoodie regression using the reviewed analysis backend and unchanged native guard | One real unsupported photo abstained correctly; actual timing/tokens/drain verified; no server rewrite |
| Immediate | Complete the already queued photo on the live app | Codex hosting + PC AI; one finite window, successful result stored for human review, no automatic confirmation |
| High | Prove supported-category accuracy and stable unattended operation | PC AI + coordinator; genuine T-shirt/jeans controls, resource/timeout/reconnect behavior and reviewed queue/admission lifecycle |
| High | Complete a real avatar + T-shirt + jeans outfit and inspect views | PC-ACCEPT-49 reports face alignment quality failure, missing hair/edit inference and no enabled real 3D engine; file/fixture checks alone do not close these gates |
| High | Finish personal editing and render acceptance | Actual face/body/hair edits, top/bottom switching, compare and lookbook output; controls alone are insufficient |
| Medium | Finish first-use guidance and metadata provenance | Explain supported AI categories, repair misleading signed-in copy, make manual correction clear, retain user-confirmed values |
| Medium | Complete mobile and privacy pilot checks | Capture/retry/delete/retention and narrow-screen filtering using authorized test data |

Current status: the hosted application and data foundation support a controlled web/wardrobe trial. The full personal 3D experience, broader Qwen quality and continuous operation remain acceptance gates. For the next Blender iteration, use clearer individual views and measured height; for real garment fitting, matching T-shirt/jeans front/back photos and dimensions are still needed. Existing engineering and compiler/administrator pauses remain explicit in the PC acceptance report.
