# FitMatch — roadmap sản phẩm và phát triển

> **Phạm vi hiện hành sau phỏng vấn — SPEC-01 / PROC-0008:** đọc [27 quyết định sản phẩm và đánh giá hướng đi](./docs/product-requirements-2026-11-05.md). Bản đầu là trọn luồng **avatar cá nhân + áo thun + jeans**, face/body/hair edits bằng thanh kéo và lời, wardrobe nền/mobile capture, AI từ đồ thật và lookbook render3D. Những mục shirt-only cũ bên dưới chỉ là spike kỹ thuật, không đủ nghiệm thu first release. Yêu cầu mới này ưu tiên hơn snapshot/prompt cũ; PC-CONF và Claude R1 tiếp tục trong scope đã giao, chưa tự mở nhiệm vụ DISC hoặc gỡ MSVC pause.


Cập nhật: 05/11/2026, America/New_York. Trạng thái: yêu cầu đã được phỏng vấn lại và chốt trong SPEC-01; pipeline full real avatar/top/jeans/edit chưa nghiệm thu. Tiến độ chỉ đọc process mới nhất, không suy từ ngày kế hoạch.

## 0. Cách đọc và nguồn sự thật

Đây là roadmap hiện hành tại thư mục gốc, tập hợp kế hoạch đã chốt và hướng phát triển. Đọc [agent.md](./agent.md) → toàn bộ file này → toàn bộ [process.md](./process.md) trước khi nhận/sửa việc. `process.md` giữ trạng thái, người đang làm và lịch sử; không suy ra tiến độ từ checklist roadmap. `agent.md` giữ quy tắc và phạm vi sở hữu.

Yêu cầu mới trực tiếp từ chủ dự án ưu tiên hơn tài liệu; AI nhận yêu cầu phải cập nhật đúng file và ghi decision trong process. Roadmap thay thế bản kế hoạch ngày 05/11 trong `docs/` làm nguồn hiện hành. Tài liệu nghiên cứu, audit và prompt là tài liệu hỗ trợ, không được âm thầm ghi đè quyết định tại đây.

## 1. Quyết định hiện tại

- Người dùng thực tế: chủ dự án và giáo viên, hai người; chưa có yêu cầu phục vụ công cộng.
- Phần cứng đã được người dùng xác nhận: PC có RTX 3060 12GB. Theo report PC ở chat khác: Windows, RAM16GB, driver610.88, Python3.10.22/torch2.1.0+cu121; reviewer chưa kiểm PC trực tiếp. CPU/SSD/mạng và trạng thái toolchain hiện tại cần inventory delta.
- Mục tiêu ưu tiên: avatar cá nhân giống người thật nhất có thể, đặc biệt mặt, dáng, da/tóc; quần áo giữ màu, logo và form. Đẹp và giống là hai tiêu chí riêng.
- Bản đầu: người đứng yên, front camera mặc định/orbit/zoom/auto-orbit tùy chọn; body, top và jeans tách riêng. Chọn slot độc lập, lưu/mở lại cả bộ; giày và đồ mặc ban đầu dùng preset ghi nhãn.
- Sau khi bản tĩnh ổn định: người thở/chuyển trọng tâm/đầu nhẹ, áo chuyển động tương ứng; không làm đi bộ, nói chuyện hoặc pose tự do trong đợt này.
- Một áo thun riêng chỉ là technical spike. First-release vertical slice cần **áo thun + jeans**; tiếp theo sơ mi, quần vải/tây và short. Không tự cắt jeans khỏi bản đầu đã được xác nhận.
- Tận dụng PC hiện có, một tác vụ GPU nặng tại một thời điểm. Không tự mua GPU, thuê cloud hoặc chuyển sang API trả phí.
- Không thay tính năng 3D bằng ảnh 2D, mannequin chung hoặc mesh người mặc áo liền khối. Demo/fixture được phép dùng để phát triển, phải ghi rõ nguồn và chưa phải avatar của người dùng.

Tài liệu này ưu tiên khi khác kế hoạch ngày 04/11. Chi tiết UI/pipeline còn phù hợp tiếp tục dùng từ [kế hoạch trước](./docs/3d-upgrade-plan.md). Nghiên cứu repo ở `/Users/khoihoang/Documents/fitmatch_AI-research/RESEARCH.md` là khảo sát cũ chưa benchmark, không phải engine đã chọn. Brief audit `claude-implementation-brief.md` là nhiệm vụ riêng; không giao lại toàn bộ audit trong đợt 3D, nhưng phải xử lý các lỗi an toàn/dữ liệu trực tiếp chặn luồng mới.

## 2. Vai trò và cách phối hợp

| Vai trò | Sở hữu | Không tự kết luận |
|---|---|---|
| Agent trên PC | Inventory, môi trường CUDA, benchmark model, body/appearance, áo/texture/drape, export, worker và vận hành Windows | App production đã hoạt động, avatar đạt độ giống, engine vừa 12GB khi chưa đo |
| Claude | App Next.js, schema/migration bổ sung, queue/API/worker authentication, storage, viewer/UI, regression và tích hợp | Fixture chứng minh model thật, mô hình static tự tương thích animation |
| Codex — chuyên gia đánh giá | Review contract, code/diff, bằng chứng 3D, độ chân thực, tài nguyên, lỗi tích hợp; ra kết luận kỹ thuật từng gate | Tự chấp nhận thay đổi mục tiêu/chất lượng/ngân sách thay chủ dự án |
| Chủ dự án và giáo viên | Cung cấp ảnh được phép dùng, xem mẫu thật và xác nhận độ giống/chất lượng trình bày | — |

Không tự spawn agent/chat khác. Người dùng chuyển hai prompt cho hai bên và gửi lại báo cáo/artifact ở chat này. Mac đã có owner hiện hữu đang active; Claude mới chỉ review tới khi có handoff, không nhận implementation song song. Người đánh giá đọc kết quả thật; chưa nhận artifact thì ghi chưa kiểm chứng, không PASS theo mô tả của bên triển khai.

Mỗi bên tạo nhánh/worktree riêng từ baseline đã ghi nhận, kiểm tra remote có sẵn trước khi chọn; không reset, stash hay ghi đè checkout đang bẩn. PC sở hữu engine adapters/toolchain/exporter và report; Mac owner hiện hữu giữ `src/`, migration/app tests cùng transport `scripts/worker/`. Claude tiếp quản phần đã bàn giao rõ, trước đó review độc lập. Contract đề xuất `docs/handoffs/worker-contract-v1.md` không khớp code V2 mới được tìm thấy; dùng `/api/v2/worker` hiện thực làm baseline review theo H-RESUME-002, không dựng prefix thứ hai. Thay đổi wire phải ghi proposal, cả hai bên xác nhận phiên bản trước tích hợp. Không push/merge/deploy/migrate production trong đợt giao việc này.

## 3. Kiến trúc và dữ liệu

```text
Browser ── authenticated API ── DB + durable job queue
   │               │                      ▲
   └── private assets/signed URLs          │ outbound HTTPS
                                    PC GPU worker
```

PC chủ động claim job; không public CUDA/Python API hay mở inbound port trên router. App chỉ điều phối; PyTorch, reconstruction và drape chạy ngoài request Next.js. PC offline thì job đợi, asset ready vẫn xem được.

Viewer tải body/áo tối ưu và render trên GPU của thiết bị người xem; GPU PC dùng lúc tạo/chuẩn bị asset. Avatar không cần chuyển động vẫn có thể orbit camera. Job tạo AI khác dùng cùng GPU phải xếp hàng, không giữ model text/vision chiếm hết VRAM khi dựng 3D.

Entity bổ sung: `avatars`, `avatar_versions`, `garment_views`, `garment_assets`, `prepared_fittings`, `processing_jobs`, `worker_registry`, `asset_references`, `saved_looks` hoặc mở rộng outfits tương thích. Mọi record có owner, version, status; input job là snapshot bất biến, không đọc nhầm active avatar mới khi job cũ hoàn tất. Migration additive, bảo toàn wardrobe/outfit hiện tại và auth gate.

Ảnh/body/face/asset nằm ở private storage. Browser không có service-role/worker secret. Worker credential chỉ cho phép nhiệm vụ được giao; heartbeat riêng không cấp quyền đọc toàn bộ storage. Xóa input/phiên bản tạo tombstone, completion cũ không được phục hồi dữ liệu đã xóa. Cleanup kiểm tra tham chiếu và grace period; đợt đầu chỉ dry-run.

## 4. Hướng kỹ thuật được đề xuất, chưa khóa engine

### Avatar chân thực, tĩnh trước — cập nhật capture/editor theo SPEC-01

1. Capture có hướng dẫn từ video quanh người + ảnh mặt + số đo được người dùng chấp nhận. Engine phải báo frame/góc nào thực sự dùng; không gọi single-frame pipeline là multiview fusion. Ánh sáng đều, không filter, quần áo ôm vừa; không yêu cầu khỏa thân. Auto tạo draft rồi cho chỉnh bằng slider và lời, ưu tiên mặt→dáng→tóc/da. Target15–30phút cần đo, chưa SLA.
2. Tách silhouette/body fitting và appearance. Body collision không chứa lớp áo cũ. Không coi vùng cơ thể bị che là đã biết chính xác.
3. Thử baseline body tham số + texture/đầu cá nhân; benchmark thêm ECON/SiTH theo nghiên cứu có sẵn nếu quyền dùng, dependency và VRAM phù hợp. Mesh clothed từ các repo này chỉ là baseline so sánh, không tự là body sạch thay áo được.
4. Xử lý mặt/tóc/UV riêng khi cần; cho phép chỉnh thủ công ở pilot nếu ghi rõ thao tác và thời gian. Không quảng bá là tự động hoàn toàn.
5. QA front/side/back, ảnh cận mặt và turntable; xuất body/áo riêng, chuẩn hóa scale/orientation và lưu asset nguồn độ phân giải cao để xử lý lại.

Nếu ảnh nhiều góc không được engine sử dụng, phải nói rõ ảnh nào thực sự được dùng và phần nào do AI đoán. Không nói đã multi-view fusion chỉ vì UI nhận nhiều ảnh.

### Áo

Ưu tiên template/rập có kiểm soát cho một áo thun, texture từ ảnh trước/sau/chi tiết, rồi drape trên body. GarmentCode là ứng viên baseline, không phải model hiểu mọi ảnh áo. ChatGarment/ReWeaver chỉ mở nhánh thử nghiệm sau baseline nếu tài nguyên/quyền dùng phù hợp; không bắt buộc chạy tất cả repo.

Giữ kích thước áo canonical; không tự may đo theo mỗi body rồi tuyên bố áo vừa. Muốn kích thước thật cần số đo/vật chuẩn, không suy ra chắc chắn từ ảnh hay nhãn size. Bản đầu đánh giá diện mạo, không chứng nhận fit/chật/rộng.

### Chuẩn bị cho chuyển động về sau

- Body và áo tách riêng, topology quanh vai/nách/cổ phù hợp, có UV và nguồn mesh trước decimation. Rig tham số chỉ là nền tảng, vẫn cần kiểm skinning deformation.
- Lưu bind/rest pose, skeleton definition/version khi có, hệ trục, đơn vị, body/collision version và material parameters. Asset tĩnh được phép chưa rig nhưng phải ghi `animation_ready: false`; không coi giữ mesh là chứng minh animation hoạt động.
- Sau gate tĩnh, thử một clip idle chung: thở, trọng tâm, đầu nhẹ; chân cố định. Kiểm vùng mặt/vai/nách và không cho cơ thể trượt chân.
- Mỗi áo/avatar/clip phải chuẩn bị chuyển động tương ứng. Skinning cho biến dạng chính; vải đung đưa có thể dùng mô phỏng offline/bake. Không giả định bake vải tùy ý xuất được bằng GLB tiêu chuẩn: chọn skeleton phụ/morph hoặc vertex-cache custom sau spike dung lượng và viewer.
- Body/áo phát đồng bộ cùng thời gian, kiểm mọi frame và đường nối loop. Khi đổi áo phải theo cùng phase hoặc reset đồng bộ; không có animation đúng thì hiển thị static có nhãn, không ghép clip sai.
- Giữ bản tĩnh để fallback; điều khiển pause và reduced motion. Chưa dùng mô phỏng vải live làm điều kiện bản đầu.

## 5. Các gói thực hiện và gate

| Gate | PC làm | Claude làm | Bằng chứng để Codex review |
|---|---|---|---|
| G0 — nền tảng | Đo cấu hình thật, driver/CUDA/WSL, disk/RAM; chốt env và model license; kiểm nguồn ảnh | Ghi baseline, đọc AGENTS/CLAUDE và Next docs; chốt contract, schema/queue thiết kế | Inventory không secret, commit/env manifests, đề xuất engine và đầu vào thiếu |
| G1 — khả thi 3D | Một body + áo template tách biệt, một thử nghiệm body/appearance từ ảnh người thật; export v1 | Viewer tối giản đọc manifest, upload/download private assets, adapter fixture có nhãn | GLB/texture thật, turntable, ảnh đối chiếu, raw logs RAM/VRAM/thời gian; không chỉ screenshot mock |
| G2 — luồng thật theo SPEC-01 | Avatar cá nhân + top thun + jeans từ ảnh, texture/fitting; editor spike và adapter | Capture linh hoạt → job → draft/edit → chọn slot top/bottom → save/reopen; wardrobe độc lập trước avatar | Một full-look thật trên3060, owner/version đúng; thun-only chỉ partial, video/editor/latency phải có evidence |
| G3 — bản tĩnh ổn định | Restart/offline/OOM recovery, benchmark lặp, render QA | Lease/fencing/idempotency, A→B→A, owner isolation, cache/URL refresh, UI và regressions | Hai account, artifact/screenshot/video, test DB/API thật và latency thực; chủ dự án duyệt độ giống |
| G4 — category sau bản đầu | Sơ mi, quần vải/tây rồi short trên pipeline đã đạt | Mở category/QA và needs_input | Không chặn first release thun+jeans; không bỏ các loại đã được yêu cầu |
| G5 — idle có vải | Rig, clip idle và áo bake tương ứng; benchmark codec/size | Animation playback đồng bộ, pause/reduced motion, swap theo phase, static fallback | Clip vòng lặp đủ thấy điểm nối, góc trước/bên/sau, không xuyên rõ/giật/trượt chân; bộ nhớ/tải đo thật |

G0/G1 có thể làm song song với skeleton app. Không xây toàn bộ UI trước khi có một asset thật dùng được. G2/G3 phải hoàn thành trước G5; G4 và thời điểm thêm sơ mi có thể điều chỉnh sau bản thun, không tự đưa vào gate đầu tiên. Thực thi đợt đầu dừng để review tại G1; các phần độc lập có thể hoàn thiện cục bộ nhưng không tự bỏ qua gate.

Không ấn định ngày xong hay thời gian dựng avatar trước G1. Sau G1 mỗi bên ước lượng theo kết quả thật, tách thời gian máy, thao tác thủ công và công phát triển.

## 6. Tiêu chí nghiệm thu

### Hình ảnh và chức năng

- Một người được phép dùng ảnh, tối thiểu một áo thun thật. Capture gồm nhiều góc và ảnh người mặc đúng áo để đối chiếu nếu có. Bộ thử rộng hơn dùng hai người hiện tại nếu đồng ý, không tự yêu cầu người thứ ba.
- Contact sheet: ảnh nguồn và render front/side/back/cận mặt cùng kích thước, ánh sáng trung tính; không dùng filter che khuyết điểm. Ghi phần quan sát/suy đoán/chỉnh tay.
- Chủ dự án/giáo viên duyệt riêng: độ giống mặt, silhouette, tóc/da, màu/logo/form áo. Chưa chốt thang số nên không tự tạo điểm PASS. Nếu chưa đủ giống, ghi fail/partial và sửa phần cụ thể.
- Xoay đủ 360°, body và áo độc lập, không dính áo cũ, không xuyên người rõ. Không chấp nhận chỉ video quay render để thay viewer 3D.
- Thay áo/lưu/mở lại asset ready không gọi AI lại. Save snapshot đúng version và selection tại thời điểm bấm.

### Hiệu năng và độ tin cậy

- Mục tiêu ban đầu, chưa phải kết quả: ≥30 FPS trên thiết bị viewer được ghi rõ; warm switch p95 ≤1s sau preload; cold load p95 ≤3s chỉ khi kích thước asset và mạng thử phù hợp.
- Ghi network download/decode/render riêng. Nếu số mẫu quá ít, báo từng mẫu/median/min/max và đánh dấu p95 chưa đủ cơ sở; đề xuất ≥30 thao tác switch cho mỗi trường hợp khi kiểm hiệu năng UI.
- Dựng avatar/áo: đo cold và warm, peak VRAM/RAM, wall time, stage time, lần OOM/retry; ít nhất ba lượt với cùng input để đánh giá độ ổn định ban đầu, không suy rộng thành SLA.
- Hai người gửi cùng lúc: job GPU nặng xếp tuần tự, không treo app; process crash/PC offline/reboot không mất job; stale completion không ghi đè version mới.
- Cross-owner bị chặn ở API/DB/storage; worker chỉ tải input được cấp. URL hết hạn được ký lại mà không dựng lại.
- Lint/build và regression auth/wardrobe/outfit/quiz phù hợp phần sửa. Checkout gốc cũ chỉ có dev/build/lint; worktree Mac Studio đã có unit/HTTP/Studio/V2 DB/browser scripts. Kiểm package.json đúng worktree, tái sử dụng và bổ sung regression theo gap, không làm lại test infrastructure hoặc báo PASS script chưa chạy.

## 7. Vận hành PC 24/7

Inventory trước, không mặc định RAM đã đủ. Khuyến nghị cân nhắc 32GB RAM hoặc hơn dựa số đo, không tự mua/nâng cấp. Dependency engine tách env và pin phiên bản; không cài CUDA/toolchain ngẫu nhiên toàn hệ thống.

Worker có startup hướng dẫn Windows/WSL phù hợp máy thật, heartbeat, job lease, backoff, timeout, log rotation, disk budget và stop/pause. Không sleep toàn máy khi worker đang chạy; đổi power/startup/reboot bằng thao tác rõ và ghi lại, không tự reboot giữa công việc. Theo dõi nhiệt độ/công suất/VRAM, không tự overclock hay đổi power limit.

Artifact ghi hash/size, đường dẫn an toàn và version; log không chứa ảnh base64, token, signed URL hay thông tin định danh không cần thiết. Upload/finalize theo contract; tiến trình chết giữa upload để lại tạm chứ không publish ready.

## 8. Đầu ra và mẫu báo cáo

Hai prompt tiếp nối: [PC](./docs/handoffs/prompt-pc-3d.md), [Mac/Claude](./docs/handoffs/prompt-claude-3d.md). Đọc [H-RESUME-002](./docs/handoffs/reassignment-2026-11-05.md) và [snapshot wire V2](./docs/handoffs/resume-snapshot-20261105/docs/worker-api-contract-v1.md). [Bản đề xuất cũ](./docs/handoffs/worker-contract-v1.md) chỉ giữ requirement/gap reference, không phải giao thức triển khai thứ hai.

Mỗi báo cáo gồm:

1. Baseline SHA/branch, phạm vi thay đổi và commit nếu có; file thực tế, không chỉ tóm tắt.
2. Gate đang làm; Done / Partial / Blocked / Not run theo hạng mục.
3. Lệnh đã chạy, exit status, raw logs và môi trường; secret được loại bỏ.
4. Artifact manifest/hash, ảnh/video/mẫu 3D mở được và cách tái hiện.
5. Chỉ số đo được, giới hạn/chỉnh tay/lỗi; phân biệt fixture với run model thật.
6. Contract compatibility và đề xuất đổi nếu có; việc còn thiếu và bước tiếp theo.

Codex review trả: kết luận PASS / NEEDS CHANGES / NOT VERIFIED cho gate; lỗi chặn theo mức ưu tiên; bằng chứng thiếu; yêu cầu sửa cụ thể cho từng bên. Model chọn engine chỉ thành quyết định sau khi có bằng chứng phần cứng + chất lượng + quyền dùng. Chất lượng diện mạo cuối cùng cần chủ dự án xem và xác nhận.

## 9. Danh mục sản phẩm và UX — áp dụng slot/capture/editor mới từ SPEC-01

| Module | Kết quả cần có | Giai đoạn |
|---|---|---|
| My Avatar | Capture có hướng dẫn, review ảnh từng góc, chiều cao, chất lượng ảnh, tạo/version/active avatar, sửa đầu vào/xóa | G1–G3 |
| Wardrobe | Ảnh front/back/detail, loại áo, thông tin form/màu, tìm/lọc/favorite, tình trạng 3D, preview và tạo lại version | G2–G4 |
| Fitting Studio | Avatar trung tâm, orbit/zoom/front/side/back/reset, swap áo, tải/preload, compare A/B cùng camera/ánh sáng | G1–G3 |
| Saved Looks | Snapshot avatar/garment/material/fitting version, camera/thumbnail, mở lại không chạy AI, đổi tên/xóa | G2–G3 |
| Outfits | Gợi ý dùng item IDs thực trong wardrobe và chuyển đúng selection sang Studio; phân biệt đồ gợi ý chưa có | Sau vertical slice, trước hoàn thiện pilot |
| Style Profile | Quiz/preference hiện hữu; tùy chọn, không chặn Studio | Bảo toàn xuyên suốt |
| Activity | Job queued/running/needs_input/error/offline, reload giữ tiến trình, retry an toàn | G2–G3 |
| Settings | Retention/ảnh cá nhân/xóa avatar, tài khoản/ngôn ngữ; pause/reduced motion khi có animation | G3, G5 |
| Worker Console | Quyền quản trị riêng, heartbeat/queue/lease, stage/time/RAM/VRAM, pause/resume và lỗi | G2–G3 |

Studio ưu tiên desktop: app shell tối và accent cam đất hiện hữu, viewer nền trung tính sáng, ánh sáng không nhuộm màu áo. Trái là wardrobe, giữa là người 3D, phải là look/compare/save/nguồn ảnh. Thu inspector thành drawer ở màn hình hẹp; mobile ưu tiên capture/upload/xem cơ bản. Không đưa CUDA/model internals vào luồng người dùng.

Onboarding: tạo avatar → thêm áo → mặc thử. Người chưa có dữ liệu có thể xem demo ghi nhãn. Upload hoặc tạo thất bại giữ phiên bản cũ; cho sửa riêng góc ảnh lỗi; job tiếp tục khi rời trang. Các trạng thái không chỉ phân biệt bằng màu, có hỗ trợ bàn phím/focus. Không giả ETA, không che thời gian chuẩn bị bằng lời hứa thay ngay.

## 10. Work packages có ID ổn định

ID dùng xuyên suốt trong process, report và review. Đây là thứ tự phụ thuộc, không phải xác nhận đã nhận việc. Người phụ trách thực tế và trạng thái chỉ xem `process.md`.

| ID | Phạm vi/đầu ra | Vai trò | Phụ thuộc |
|---|---|---|---|
| DOC-01 | Roadmap/process/rules và prompt phối hợp | Codex | Yêu cầu chủ dự án |
| DOC-02 | Reconcile checkpoint PC/worktree Mac, giao lại việc và protocol gap matrix | Codex | Kiểm chat/worktree thực tế |
| OPS-01 | Sao lưu/dọn nhánh local cũ đã tích hợp, giữ worktree và bộ điều hành | Codex | Chủ dự án giao cleanup rõ, kiểm ancestry/backup |
| OPS-02 | Publish docs/handoff GitHub và quy trình đồng bộ hai máy | Codex | Chủ dự án cho phép push tài liệu, kiểm secrets/diff/remote |
| SPEC-01 | Chốt27quyết định sau phỏng vấn, đánh giá và đổi acceptance first release | Codex | Câu trả lời trực tiếp chủ dự án |
| PC-00 | Inventory PC và xác định tài nguyên/môi trường | PC | Đọc tài liệu |
| PC-01 | Env pinned, checkpoint/license manifest, lệnh tái hiện | PC | PC-00 |
| PC-02 | Body + áo template riêng, drape/export/manifest fixture | PC | PC-01 |
| PC-03 | Thử avatar cá nhân từ ảnh, body/appearance, QA và benchmark | PC | PC-01, ảnh được phép dùng |
| APP-00 | Baseline/worktree, đọc Next docs, machine-readable contract schemas | Claude | Đọc tài liệu |
| APP-01 | Migration additive, owner/private assets và queue/worker API | Claude | APP-00, contract v1 |
| APP-02 | Viewer static tối giản đọc manifest, fixture có nhãn | Claude | APP-00, manifest/fixture |
| REV-01 | Review G0/G1, chốt engine khả thi hoặc yêu cầu sửa | Codex | PC-00…03, APP-00…02 theo bằng chứng |
| PC-04 | Áo thun từ ảnh: texture/logo/form và prepared fitting | PC | REV-01 đạt, dữ liệu áo |
| PC-05 | Worker adapter thật, upload/finalize, startup/recovery | PC | Contract schema, APP-01; spike độc lập được làm sớm |
| APP-03 | Capture/avatar/wardrobe/activity, job progress, lỗi/offline | Claude | APP-01…02; skeleton được làm sớm |
| APP-04 | Swap/cache/version/compare/save/reopen, nguồn wardrobe thật | Claude | APP-03, prepared fitting |
| INT-01 | PC worker → server → storage → viewer thật | PC + Claude | PC-04…05, APP-01…04 |
| QA-01 | Hai account, queue race/retry/lease, offline, privacy, UX/performance | PC + Claude | INT-01 |
| REV-02 | Review G2/G3 và chủ dự án duyệt độ giống, bản thun ổn định | Codex + chủ dự án | QA-01 |
| GAR-03 | Sơ mi: cổ/nút/tay/form/texture và review mẫu thật | PC + Claude | Bản thun đạt; thứ tự so với idle có thể điều chỉnh công khai |
| ANIM-01 | Spike rig/skinning/idle và định dạng cloth bake, source assets | PC | REV-02, lựa chọn codec và viewer thống nhất |
| ANIM-02 | Playback người/áo đồng bộ, swap phase, pause/reduced motion | Claude | ANIM-01, manifest animation mới được review |
| REV-03 | Review G5: likeness/deformation/loop/collision/performance | Codex + chủ dự án | ANIM-01…02 |

Những gói có nhiều vai trò phải tách subtask/owner cụ thể trong process trước khi sửa file; không xem tên hai vai trò là quyền sửa chồng lấn. Không tự nhận việc đang Assigned/In progress của bên khác.

## 11. Hướng phát triển sau pilot, chưa cam kết triển khai

- Nâng chất lượng mặt/tóc/texture và automation theo lỗi quan sát được; giảm thao tác tay bằng benchmark đối chiếu, không làm mất độ giống.
- Mở category quần/váy/hoodie/jacket/giày và layering khi collision/garment representation đủ; không suy ra một template áp dụng được mọi đồ.
- Pose đa dạng, animation nâng cao hoặc cloth live chỉ sau idle có vải đạt; cần ngân sách hiệu năng và QA riêng.
- Nhiều worker/cloud burst, public beta/thương mại hóa chỉ khi có yêu cầu, benchmark tải, quyền dùng thương mại và ngân sách được chốt. Không biến PC tại nhà thành dịch vụ SLA khi chưa có cơ chế dự phòng.
- Fit/size thật, áp lực vải, AR/video try-on là nhánh riêng đòi hỏi dữ liệu/độ chính xác mới; không quảng bá sẵn từ kết quả render đẹp.
- Tính năng text/vision/phối đồ hiện có giữ hoạt động; local model thay provider chỉ sau benchmark chất lượng/schema và tài nguyên, không tự coi tên model đề xuất trong chat là quyết định tích hợp.

## 12. Rủi ro, quyết định còn mở và cách cập nhật

| Vấn đề | Cách giải quyết/điều kiện chốt |
|---|---|
| PC có report RAM16GB/Windows/env, CPU/disk/mạng và toolchain cần delta | PC-00 tiếp nối checkpoint004, không làm lại phần có evidence |
| Engine avatar/áo, checkpoint/body license | PC-01…03 + REV-01; nghiên cứu cũ chưa đủ |
| Face/hair/texture không giống | Contact sheet + chủ dự án review, chọn capture/engine/manual correction cụ thể |
| 12GB OOM hoặc dependency không hỗ trợ | Tách stage, giảm batch, thử offload có số đo; báo giới hạn, không tự mua/thuê |
| Áo xuyên body hoặc sai màu/logo/form | Body collision riêng, canonical garment, texture projection và QA góc khuất |
| Animation vải tốn dung lượng hoặc không hỗ trợ GLB | ANIM-01 đo codec/size/playback trước khi chốt manifest mới |
| Thời gian chờ chấp nhận được chưa chốt | Đo G1 rồi hỏi mức chấp nhận trên kết quả cụ thể, chưa hứa ETA |
| Dữ liệu riêng tư/lẫn version/late completion | Private storage, owner checks, tombstone, fencing và test thật |
| Tài liệu/nhánh trên PC và Mac lệch nhau | Process revision + baseline SHA + handoff ID, đối chiếu trước tích hợp |

Thay đổi mục tiêu/phạm vi/gate được ghi decision trong process, rồi cập nhật phần tương ứng tại đây. Thay đổi contract cần cả PC và Claude xác nhận tương thích, Codex review trước tích hợp. Kết quả triển khai chỉ cập nhật process/report; không xóa tiêu chí roadmap để hợp thức hóa một kết quả chưa đạt.


## 13. Điểm tiếp nối sau reconciliation, ưu tiên hơn giả định bắt đầu từ đầu

[H-RESUME-002](./docs/handoffs/reassignment-2026-11-05.md) ghi toàn bộ nguồn và phân công. PC đã body-fit demo, chưa textured avatar: checkpoint004/toolchain-status là đầu vào trước tiên; không tải lại SMPL-X/env hoặc chạy lại fitting vô cớ. Admin/UAC đang tạm dừng theo yêu cầu cuối có trong chat PC, chỉ gỡ khi chủ dự án xác nhận.

Mac worktree `fitmatch_AI-3d-studio` có viewer/control plane/quiz/looks/worker transport cùng tests; đang dirty và AI khác giữ code. Claude mới review trước, chờ handoff mới sửa. Dùng V2 code làm baseline, đối chiếu lost claim/complete responses, upload idempotency, capability scope, deletion/retention và hai owner/một GPU trước live. Các tính chất trong roadmap vẫn là yêu cầu nghiệm thu, không tự coi hiện thực đã đủ.

Đã có code/test fixture không có nghĩa đã PASS G0/G1 hay full real pipeline; tiếp nối dựa evidence, không xóa tiến độ hoặc bỏ gate. Xem process cho task/session/receipt và status thực tế. Snapshot chỉ để review/handoff, bên Mac phải chốt revision trước đồng bộ worker sang PC.


## 14. Chính sách nhánh sau cleanup OPS-01

Hai nhánh local hiện hành: `main` tại checkout nguồn (tài liệu điều phối + source cũ dirty) và `codex/3d-studio-worker` tại worktree app V2, đã lên d2a9898 lúc kiểm. Main và Studio không có merge-base ở snapshot này; không tự merge/reset để đồng bộ. Hai nhánh auth/audit cũ đã tích hợp vào Studio và được backup tags/bundle rồi xóa local branch names. Worktree cũ giữ detached chỉ tham khảo, remote refs và PC giữ nguyên. Xem [report cleanup](./docs/reports/review/branch-cleanup-20261105/README.md) và process PROC-0003 trước chọn nơi làm. Tạo task branch mới phải có scope/owner/baseline rõ, không phục hồi nhánh lịch sử chỉ để bắt đầu lại phần đã làm.


## Nguồn đồng bộ GitHub — OPS-02

Chủ dự án đã cho phép publish bộ điều hành/handoff trên nhánh tài liệu `codex/project-operations`. Xem [github-sync.md](./docs/handoffs/github-sync.md) để đọc/clone/pull và gửi report/PR đúng scope. Không dùng ZIP mỗi lần; không merge nhánh tài liệu vào checkpoint code một cách mù. Repo công khai nên chỉ publish tài liệu/report đã loại secrets và dữ liệu cá nhân không cần thiết. Đây là ngoại lệ cho hạn chế push tài liệu cũ trong file này; hạn chế push app/deploy/migration vẫn giữ nguyên. Trạng thái publish thực tế được xác nhận qua remote readback trước bàn giao.


## 15. Lộ trình bổ sung theo SPEC-01

Ưu tiên trải nghiệm→likeness→trang phục→recommendations; không mở rộng backend vô hạn trước chất lượng. Sau review R1/PC-CONF và khi unblock phần phụ thuộc, cổng kỹ thuật tiếp theo là DISC-AV-01 + DISC-EDIT-01 + DISC-DENIM-01: một người thật, edit thật và jeans riêng, đo thời gian/VRAM/RAM và cho người dùng xem mẫu. Nếu chưa đạt, báo giới hạn/chi phí rồi người dùng quyết định; không tự thuê GPU hoặc giảm mục tiêu mặt giống thành mannequin.

APP-FLOW-01 tập hợp full journey upload mobile/desktop→avatar draft→wardrobe prep→top/bottom independent→save. APP-AI-01 là3look từ owned inventory/quiz/occasion; APP-RENDER-01 chụp/render scene đúng bộ và góc/nền. PILOT-01 hai tài khoản riêng truy cập website bất kỳ đâu, PC ở nhà outbound worker. Chi tiết và acceptance tại docs/product-requirements-2026-11-05.md. Các package mới Planned, chưa assign/start implementation từ tài liệu này.

Ảnh/video avatar: user chọn giữ hoặc xóa khi hoàn tất, giữ thì có thể xóa sau. Source và derived assets/looks tách vòng đời. Đồ mới xử lý nền, không có avatar vẫn làm canonical; khi fitting ready chỉ autoapply nếu selection/current avatarVersion còn đúng. Không infer lại mỗi click; không tự chuẩn bị mọi tổ hợp áo×quần.
