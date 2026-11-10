# FitMatch — audit tổng thể ngày 09/11/2026

Session `CX-APP-AUDIT-36`, task `AUDIT-36`, Codex reviewer. Phạm vi: đánh giá sản phẩm theo SPEC-01, source/contract, bằng chứng kiểm thử, PC/native, readiness backend và dependency. Không sửa implementation, không triển khai/migrate/chạy GPU. Kết luận first release: **NEEDS CHANGES**; full personal-avatar/tee/jeans/pilot **NOT VERIFIED**.

## 1. Kết luận và độ hoàn thiện

App đã vượt giai đoạn skeleton: luồng dữ liệu, Studio, wardrobe, capture, saved looks, queue và xử lý lỗi có implementation cùng kiểm thử HTTP/SQL/browser thực. Tuy nhiên đầu ra quan trọng nhất — avatar giống người dùng, editor thật và bộ áo thun + jeans cá nhân — chưa đạt nghiệm thu. Chưa thể coi đây là bản dùng thử trọn luồng với dữ liệu cá nhân thật.

**Ước lượng phát triển: khoảng 52%, khoảng bất định 45–60%.** Đây là rubric chủ quan phục vụ kế hoạch, kế thừa trọng số audit06/11; không phải phần trăm test PASS, điểm bảo mật, dự báo ngày xong hay xác suất thành công. Animation và category sau first release không thuộc mẫu số. App/control-plane tiến bộ rõ; chất lượng avatar/garment giữ điểm thấp vì thiếu bằng chứng đạt, không cộng theo số report.

| Mảng | Trọng số | Ước lượng trong mảng | Đóng góp | Cơ sở |
|---|---:|---:|---:|---|
| App flow/wardrobe/capture/Studio/looks |25|90%|22.50|Hai slot, saved snapshots, URL recovery, offline/capture và synthetic E2E; thiếu pilot thật/QA thiết bị thật |
| Avatar cá nhân + editor |25|15%|3.75|Có body fit/capture/CPU texture spike; likeness FAIL/chưa duyệt, editor chưa có engine |
| Áo thun + jeans cá nhân |20|35%|7.00|Template, UV/export/format/render groundwork; chưa bộ đồ cá nhân được duyệt cùng avatar |
| Gợi ý owned inventory + AI hỗ trợ |10|75%|7.50|rules-v1 top+jeans; Qwen human-review path kiểm synthetic, native refusal tốt hơn; chưa real app inference/quality corpus đủ |
| Reliability/security/privacy |10|85%|8.50|Nhiều race/recovery/owner/privacy cases đã đóng bằng local tests; hosted recovery/storage/PC lifecycle chưa hoàn tất |
| Remote pilot/vận hành |10|30%|3.00|Native Windows và disabled preflight tiến bộ; thiếu cutover/HTTPS/enrollment/2-account/full real run |
| Tổng |100||52.25|Làm tròn52%; audit trước45.75→46% |

Đánh giá riêng lớp app/control-plane có thể coi khoảng85–90% về implementation cho pilot. Không áp dụng tỷ lệ này cho toàn sản phẩm hoặc độ sẵn sàng production. Phần còn lại chứa nhiều rủi ro nghiên cứu, nên52% không đồng nghĩa còn một nửa thời gian.

## 2. Revision và cách kiểm chứng

- Root hiện tại `main/1ef8f2549633271d6310dc0701b323e46962413d` đang dirty từ trước; đây là checkout điều phối/source cũ, không phải app candidate mới. Không ghi đè source/dirty work.
- Source audit: clean detached checkout `/private/tmp/fitmatch-app-close-review-20261109`, exact `499ead01e7f9274ddf310ab346fda4c2464588bd`; `next16.4.5`, React19.2.4 theo package.json/lock của dự án. Đây là nhận diện revision, không phải khuyến nghị version.
- GitHub `git ls-remote` mới trong phiên xác nhận exact app branch trên vẫn499ead0; operations `59d2523938729d19386585992da8e4521853cf64`; PR9 `aef81b5bb0f981bcfec1558e5bbc1b61c5d75f6b`; PR10 `cc7b3b2eb57736cad10f9502e1c59e768f7d9174`. Không thấy delta mới tại các ref này; không suy ra trạng thái uncommitted trên máy khác.
- Đọc đầy đủ onboarding, SPEC-01, report app-close/native/readiness/canonical, đối chiếu source Studio/cloud/capture/draft/recommendation/analysis/worker và cutover plan.
- Đọc lại raw logs independent cùng candidate ở `/private/tmp/fitmatch-close32-{unit,lint,python,build,legacy,http}.log`:114unit PASS, Python56OK trên Mac, lint/default Turbopack build PASS, official PG17 legacy/fresh compatibility PASS, full test:v2 HTTP/SQL/browser/worker PASS. Đây là **bằng chứng lượt independent trước được tái kiểm đọc**, không khai đã chạy lại cả suite trong audit này. Npm unit có gọi Python; không cộng hai số thành170test độc lập.
- Fresh offline source repro xác nhận lỗi manifest ở mục4; fresh online npm audit ở mục5. Không lặp suite không đổi chỉ để tăng test count.
- Hai compact live PC snapshots hiện lỗi host unavailable. Bằng chứng PC dùng đúng published reports/log review gần nhất; không suy PC đã tắt/idle hay task đã hoàn tất thêm.
- Không mở artifact GLB/ảnh cá nhân riêng tư và không visual-test UI mới trong phiên này. Không có fresh cloud SQL, real Qwen run, benchmark viewer hay penetration test. Cloud state dẫn từ read-only inventory ngày09/11 đã lưu, không giả là query mới.

## 3. Tiến độ thực chất theo module

| Module | Đã có bằng chứng | Phần chưa đủ |
|---|---|---|
| Auth/tài khoản | PKCE/state, owner bridge, refresh concurrency, logout, identity linking và legacy-preservation tests | Hosted auth trigger compatibility chưa được áp dụng canonical; cần kiểm signup thật sau cutover |
| Wardrobe | CRUD/ảnh private, validation/quota/pagination; category/owner; analysis review UI | Chất lượng ảnh đồ thật/mobile thật; pipeline canonical garment ngoài fixture |
| Capture/avatar draft | Ảnh nhiều góc, video+face+số đo envelope; draft dùng tạm; giữ/xóa nguồn | Video hiện check container/size, decode/codec/duration/frame-quality thuộc adapter chưa được chứng minh full; không có multiview-fusion evidence |
| Studio | Viewer3D thật, orbit/zoom/auto-orbit, top/bottom độc lập, late-result không đổi selection, compare | Real body/top/jeans alignment/collision/appearance; chưa số đo FPS/load/switch theo acceptance |
| Save/reopen | Ghim avatar/fitting/version/hash/camera; mở lại không tạo job; URL re-sign cùng asset | Remote2account/PCoffline/readyasset tests trên hosted stack và thiết bị thật |
| Lookbook | Chụp PNG chính scene Three.js, chọn góc/nền; không phát sinh hình học mới | Chất lượng kết quả bị giới hạn bởi avatar/garment; chưa photoreal acceptance |
| Gợi ý phối đồ | rules-v1 chọn item sở hữu, quiz/occasion/feedback, tối đa3bộ; thiếu jeans thì ghi top-only | Chưa có đánh giá hữu ích bởi2người; không phải model học gu; Qwen không phải engine dựng3D |
| Qwen analysis | Immutable snapshot→queue→worker→proposal→human confirm; quota/dedupe/cleanup/owner/fencing | Real licensed image→PCQwen→HTTPSapp chưa chạy; OCR/semantic quality chưa được coi đạt |
| Queue/worker | Durable recovery, lost replies, lease/fencing, scopes, binding, GPU exclusion, Windows containment evidence | Hosted end-to-end/restart/OOM/offline/drain thật; chỉ bật capability được adapter chứng minh |
| Privacy | Durable cleanup intent/retry và pending UI, cancel phụ thuộc, giữ derived assets | Real Storage failure/recovery và PC temp/cache/source retention; account-delete lifecycle chưa full proof |

Các lỗi audit06/11 không còn nên liệt kê chung là “chưa sửa”: source-deletion retry (`CL-PRIV-01`), signedURL recovery (`CL-URL-01`), avatar hash snapshot (`LOOK-01`), analysis snapshot cleanup race, runner arbitrary-target guard, Windows copy-before-lock fixture và analysis read-skew đã có source/evidence đóng ở phạm vi local/focused tương ứng. Hosted applicability là gate khác.

## 4. Findings và blocker theo ưu tiên

### P1 — Chất lượng avatar và editor chưa đáp ứng mục tiêu chính

PC-CPU-FACE-31 đã tiến được từ mesh không texture sang GLB có texture nhúng; report ghi explicit visual-quality FAIL/identityAcceptedfalse, mắt/môi lệch. Official format validator0errors/0warnings chỉ kiểm format. Reviewer chưa xem ảnh riêng tư để tự chấm likeness. Tóc/da/góc khuất và hình học cá nhân còn thiếu evidence.

`src/components/v2/AvatarDraft.tsx:147` thông báo rõ slider/lời chưa bật vì máy xử lý chưa có công cụ chỉnh. Capture/schema/edit-intent không thay editor engine. Thiếu ít nhất một face edit có tác dụng thật và preview/confirm/undo/version; body/hair/skin cũng chưa nghiệm thu. Target15–30phút chưa được đo cho full pipeline.

Owner tiếp: PC3D engine/capability; app owner nối đúng edit semantics sau capability agreement; chủ dự án duyệt likeness. Cần ảnh nguồn/render front/side/back/cận mặt, ghi vùng suy đoán/chỉnh tay, timing/RAM/VRAM thật.

### P1 — Chưa có full look cá nhân được duyệt

Template body/top/bottom và test synthetic không chứng minh áo thun/jeans của chính người dùng giữ màu/logo/form. Báo cáo template cũ còn max local strain72.491%; chưa có bằng chứng sửa chất lượng thực tế để đóng finding này. Cần cùng một avatar, áo và quần tách riêng, 360°, scale/pose nhất quán, không xuyên rõ, đổi từng slot và giữ món còn lại. Không dùng quần preset để chốt U09/U10.

### P1 — Canonical backend chưa phục vụ được app V2 như candidate

Inventory gần nhất: canonical `fitmatch-ai/gohczmqykjkrgdblgbog` chưa có bảngV2/history; auth trigger gọi `public.users` không tồn tại; legacy outfit cần style_category. Candidate đã có compatibility SQL/route và officialPG17 synthetic proof, nhưng cloud chưa áp dụng. Chọn đúng URL/backend và OAuth đã sửa không tự hoàn tất deployment/schema.

Cutover plan có12SQLsteps (11absent +1compat), skip base schema và verify-only identity. Cần private DB+Storage backup, restore proof, compare nghiệp vụ/ownerFK/identity/refresh/object bytes, exact execution review, rồi migrate có kiểm soát. APP-RECOVERY-32 đang thuộc Claude theo handoff; chưa có final package được review trong snapshot hiện tại. Không replay schema.sql vào DB có dữ liệu.

### P1 — Real Qwen và remote pilot chưa tích hợp

PCAI published native log:56run/47PASS/9skip/0error/exit0, reviewer trước đã đọc/hashcheck;5POSIX+4symlink privilege skips không PASS. PC3D báo cùng kết quả nhưng ref/log mới chưa publish tại thời điểm đọc. Disabled preflight3refusal cases chứng minh từ chối an toàn, không chứng minh inference.

Thiếu reviewed HTTPS serving revision, scoped worker enrollment, input thuộc account, operator approval và finite pc-ai slot sau backend/recovery gates. Một OS lock byte0 và owned-tree drain/model-unload phải giữ tới lúc nhả GPU; Qwen và3D không chạy nặng cùng lúc. Sau realQwen vẫn còn gate cá nhân3D và2accountpilot.

### P2 — BUG MỚI: bundle import nhận category kế thừa từ Object.prototype

`src/lib/studio/bundle.ts:20` dùng `g.category in CATEGORY_SLOT`; toán tử `in` nhận cả inherited keys. Fresh repro bằng chính parseBundle tại499ead0:

| category | Kết quả parse | Kiểu slot trả từ CATEGORY_SLOT |
|---|---|---|
| t-shirt | accepted | string |
| __proto__ | accepted sai | object |
| constructor | accepted sai | function |
| toString | accepted sai | function |

`src/components/studio/Studio.tsx:182` đưa giá trị này thẳng vào slot dù type mong top/bottom. Đây là validator/state correctness bug ở manifest nhập tay/local restore; chưa chứng minh account bypass, code execution hay crash. Cloud categoryOf đã dùng Object.hasOwn, nhưng parseBundle chưa đồng nhất.

Repro tối giản, không mạng/credential/GPU:

```js
parseBundle({version:1, avatar:{id:"a",name:"Avatar",file:"a.glb"},
  garments:[{id:"g",name:"Garment",file:"g.glb",category:"__proto__",avatarId:"a"}]});
```

Giao app owner sửa bằng own-key/enum validation và vài negative cases cho import+restore; không sửa file của owner trong lượt review này.

### P2 — Hiệu năng và vận hành còn thiếu phép đo nghiệm thu

Chưa có full avatar timing cold/warm ≥3lượt, peakRAM/VRAM/OOM/retry cùng input; chưa đủ benchmark≥30switch để đánh giá p95; thiếu viewerFPS/assetdownload/decode/render trên thiết bị ghi rõ. Body-fit vài chục giây không đại diện full textured-avatar/garment pipeline. Full video upload150MB được server download/buffer để kiểm signature; cần kiểm memory/timeout thật trên host đã chọn, hiện chỉ là rủi ro cần đo, không kết luận đã OOM.

Thiếu endurance/PC reboot/offline/recovery, disk/log budget, cache/source cleanup và2người gửi job thật cùng lúc. Không hứa24/7SLA hoặc15–30phút từ unit tests.

### P2 — Tài liệu trạng thái có drift

App `docs/mac-completion-plan.md` vẫn để URL recovery/privacy Planned dù source/test đã triển khai. Process giữ task board lịch sử với nhiều trạng thái cũ; phần Current/L-083 chính xác hơn nhưng khó đọc. Nguy cơ agent mới giao lại việc đã xong. Đề xuất owner đồng bộ current matrix ngắn gồm code-complete/local-verified/native-published/hosted-verified/quality-approved; giữ toàn bộ lịch sử. Không thay roadmap gate để hợp thức hóa progress.

## 5. Dependency và phạm vi bảo mật

Fresh `npm audit --json` online exit1: **7moderate,0high,0critical**, tập trung nhánh TypeScript ESLint và minimatch; đây là7affected package entries có quan hệ bắc cầu, không phải7lỗ hổng độc lập ở app runtime. Advisory minimatch: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Không chỉnh dependency/audit fix trong scope audit. Cần cập nhật tương thích và lint/build lại khi app owner nhận task.

Lượt `npm audit --offline` trả0 nhưng thiếu advisory network; không dùng làm chứng minh sạch. Lượt online sandbox ban đầu lỗi DNS, retry được cấp quyền mạng mới cho kết quả trên. Không tìm thấy high/critical trong snapshot này không phải cam kết app an toàn tuyệt đối.

Shared canonical database có finding inventory trước:27public tables ngoài FitMatch thiếuRLS/có anon privileges. Không sửa ứng dụng khác trong audit này, nhưng trước publicpilot phải xác định phạm vi dữ liệu chịu ảnh hưởng và chủ sở hữu xử lý. Owner isolation/private buckets trong local FitMatch tests không phủ cấu hình mọi bảng trong hosted project.

## 6. Việc tiếp theo nên ưu tiên

1. **Claude hoàn tất APP-RECOVERY-32 hiện hữu**, giao exact bundle/hash/runbook/rehearsal; Codex review rồi mới bước private canonical backup/restore và cutover có quyền. Không viết lại UI/worker đã có.
2. **PC3D publish native/readiness log đang có**, reuse artifact; PCAI giữ disabled config. Hoàn tất exact backend/HTTPS/enrollment readiness rồi chạy một ảnh đồ owned qua Qwen thật, đo và review human-confirm, GPU serialize.
3. **Ưu tiên spike chất lượng avatar + thun/jeans thật**, hiện là rủi ro sản phẩm lớn nhất. Front/side/back/cận mặt, color/logo/form, collision, thời gian và tài nguyên. Làm quality work song hành các bước tích hợp độc lập; không trì hoãn vô hạn sau thêm framework backend.
4. **Editor thật theo capability**, một face slider và một typed intent tác động mesh/parameter, version/preview/undo; chỉ mở UI đã có engine. Chưa engine thì ghi thiếu.
5. **App owner sửa P2 manifest/category + đồng bộ status docs + dependency tooling**, scope nhỏ, regression đúng lỗi; không takeover APP-RECOVERY đang occupied.
6. **Chạy pilot2account từ mạng ngoài**, mobilecapture→wardrobe→PCjob→avatar/thun/jeans→swap→save/reopen→lookbook; offline/restart/retention/cross-owner và measured load/switch. Chủ dự án duyệt riêng likeness và đồ.

Không ưu tiên animation/category mới trước bản tĩnh đạt. Không cần thêm model/chạy lại fitting chỉ để tạo hoạt động. Một lần Qwen thật thành công sẽ đóng một gate tích hợp, chưa đóng first release.

## 7. Handoff

AUDIT-36 hoàn tất báo cáo và fresh repro/dependency/ref checks; source giữ nguyên499ead0 sạch. Chỉ report này và append process được sửa. App implementation vẫn Claude APP-RECOVERY-32; PC giữ engines/adapters/coordinator. Findings mới giao dạng đề xuất review, chưa dispatch hoặc nhận scope implementation. Không merge/push/deploy/cloudDDL/enrollment/GPU trong phiên. Báo cáo lưu local, chưa publish sang GitHub/PC. Bước tiếp: nhận finalrecovery/native bundle, review đúng revision; app owner nhận manifest fix riêng. Release NEEDS CHANGES, likeness/fullrealpilot NOT VERIFIED.
