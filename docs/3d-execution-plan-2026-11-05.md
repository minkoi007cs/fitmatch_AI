# FitMatch 3D — kế hoạch thực thi và nghiệm thu

> Nguồn hiện hành đã chuyển về [roadmap.md](../roadmap.md) ở thư mục gốc. Đọc [agent.md](../agent.md), roadmap và [process.md](../process.md) đầy đủ trước làm việc. File này giữ snapshot kế hoạch 05/11 để tham chiếu; tiến độ/claim chỉ cập nhật trong process, không ở snapshot này.

Cập nhật: 05/11/2026, America/New_York. Trạng thái: đã soạn kế hoạch và giao việc; chưa kết nối PC, chưa chạy model và chưa nghiệm thu pipeline.

## 1. Quyết định hiện tại

- Người dùng thực tế: chủ dự án và giáo viên, hai người; chưa có yêu cầu phục vụ công cộng.
- Phần cứng đã được người dùng xác nhận: PC có RTX 3060 12GB. Windows là thông tin trong discovery cũ, cần kiểm kê lại; RAM, CPU, SSD, driver và mạng chưa xác minh.
- Mục tiêu ưu tiên: avatar cá nhân giống người thật nhất có thể, đặc biệt mặt, dáng, da/tóc; quần áo giữ màu, logo và form. Đẹp và giống là hai tiêu chí riêng.
- Bản đầu: người đứng yên, camera orbit/zoom 360°, body và áo tách riêng, thay áo đã chuẩn bị và lưu/mở lại look.
- Sau khi bản tĩnh ổn định: người thở/chuyển trọng tâm/đầu nhẹ, áo chuyển động tương ứng; không làm đi bộ, nói chuyện hoặc pose tự do trong đợt này.
- Một áo thun là vertical slice đầu tiên; sơ mi vẫn là phạm vi dự kiến tiếp theo, sau khi áo thun đạt nghiệm thu. Không tự hủy scope sơ mi.
- Tận dụng PC hiện có, một tác vụ GPU nặng tại một thời điểm. Không tự mua GPU, thuê cloud hoặc chuyển sang API trả phí.
- Không thay tính năng 3D bằng ảnh 2D, mannequin chung hoặc mesh người mặc áo liền khối. Demo/fixture được phép dùng để phát triển, phải ghi rõ nguồn và chưa phải avatar của người dùng.

Tài liệu này ưu tiên khi khác kế hoạch ngày 04/11. Chi tiết UI/pipeline còn phù hợp tiếp tục dùng từ [kế hoạch trước](./3d-upgrade-plan.md). Nghiên cứu repo ở `/Users/khoihoang/Documents/fitmatch_AI-research/RESEARCH.md` là khảo sát cũ chưa benchmark, không phải engine đã chọn. Brief audit `claude-implementation-brief.md` là nhiệm vụ riêng; không giao lại toàn bộ audit trong đợt 3D, nhưng phải xử lý các lỗi an toàn/dữ liệu trực tiếp chặn luồng mới.

## 2. Vai trò và cách phối hợp

| Vai trò | Sở hữu | Không tự kết luận |
|---|---|---|
| Agent trên PC | Inventory, môi trường CUDA, benchmark model, body/appearance, áo/texture/drape, export, worker và vận hành Windows | App production đã hoạt động, avatar đạt độ giống, engine vừa 12GB khi chưa đo |
| Claude | App Next.js, schema/migration bổ sung, queue/API/worker authentication, storage, viewer/UI, regression và tích hợp | Fixture chứng minh model thật, mô hình static tự tương thích animation |
| Codex — chuyên gia đánh giá | Review contract, code/diff, bằng chứng 3D, độ chân thực, tài nguyên, lỗi tích hợp; ra kết luận kỹ thuật từng gate | Tự chấp nhận thay đổi mục tiêu/chất lượng/ngân sách thay chủ dự án |
| Chủ dự án và giáo viên | Cung cấp ảnh được phép dùng, xem mẫu thật và xác nhận độ giống/chất lượng trình bày | — |

Không tự spawn agent/chat khác. Người dùng chuyển hai prompt cho hai bên và gửi lại báo cáo/artifact ở chat này. Người đánh giá đọc kết quả thật; chưa nhận artifact thì ghi chưa kiểm chứng, không PASS theo mô tả của bên triển khai.

Mỗi bên tạo nhánh/worktree riêng từ baseline đã ghi nhận, kiểm tra remote có sẵn trước khi chọn; không reset, stash hay ghi đè checkout đang bẩn. PC sở hữu `worker/`, `scripts/pc/`, `docs/reports/pc/`; Claude sở hữu `src/`, migration bổ sung, test app và `docs/reports/claude/`. Contract `docs/handoffs/worker-contract-v1.md` được đóng băng làm bản đầu; thay đổi phải ghi proposal, cả hai bên xác nhận phiên bản mới trước tích hợp. Không push/merge/deploy/migrate production trong đợt giao việc này.

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

### Avatar chân thực, tĩnh trước

1. Capture có hướng dẫn: front/side/back cùng tư thế, chiều cao; thêm góc chéo và ảnh mặt nếu cần. Không hứa chỉ ba ảnh sẽ đủ chất lượng. Ánh sáng đều, không filter, không nhòe, quần áo ôm vừa; không yêu cầu khỏa thân.
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
| G2 — luồng thật | Avatar cá nhân + áo thun từ ảnh, texture/drape; worker adapter | Capture → job → progress → load model → đổi áo → save/reopen; chuẩn bị queue từ sớm | Một luồng chạy worker thật trên 3060, source/output đúng owner/version; lỗi và phần chỉnh tay được ghi |
| G3 — bản tĩnh ổn định | Restart/offline/OOM recovery, benchmark lặp, render QA | Lease/fencing/idempotency, A→B→A, owner isolation, cache/URL refresh, UI và regressions | Hai account, artifact/screenshot/video, test DB/API thật và latency thực; chủ dự án duyệt độ giống |
| G4 — sơ mi | Thêm cổ/nút/tay/texture trên pipeline đã đạt | Mở category/QA và luồng needs_input | Thun và sơ mi có mẫu thật; giới hạn rõ. Không trì hoãn bản thun chỉ vì sơ mi chưa đạt |
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
- Lint/build và regression auth/wardrobe/outfit/quiz phù hợp phần sửa. Repo hiện chưa có script test; bên triển khai bổ sung test có ý nghĩa cho contract, queue/DB/authorization và critical E2E, không báo đã chạy script không tồn tại.

## 7. Vận hành PC 24/7

Inventory trước, không mặc định RAM đã đủ. Khuyến nghị cân nhắc 32GB RAM hoặc hơn dựa số đo, không tự mua/nâng cấp. Dependency engine tách env và pin phiên bản; không cài CUDA/toolchain ngẫu nhiên toàn hệ thống.

Worker có startup hướng dẫn Windows/WSL phù hợp máy thật, heartbeat, job lease, backoff, timeout, log rotation, disk budget và stop/pause. Không sleep toàn máy khi worker đang chạy; đổi power/startup/reboot bằng thao tác rõ và ghi lại, không tự reboot giữa công việc. Theo dõi nhiệt độ/công suất/VRAM, không tự overclock hay đổi power limit.

Artifact ghi hash/size, đường dẫn an toàn và version; log không chứa ảnh base64, token, signed URL hay thông tin định danh không cần thiết. Upload/finalize theo contract; tiến trình chết giữa upload để lại tạm chứ không publish ready.

## 8. Đầu ra và mẫu báo cáo

Hai prompt: [PC](./handoffs/prompt-pc-3d.md), [Claude](./handoffs/prompt-claude-3d.md). Giao thức: [worker contract v1](./handoffs/worker-contract-v1.md).

Mỗi báo cáo gồm:

1. Baseline SHA/branch, phạm vi thay đổi và commit nếu có; file thực tế, không chỉ tóm tắt.
2. Gate đang làm; Done / Partial / Blocked / Not run theo hạng mục.
3. Lệnh đã chạy, exit status, raw logs và môi trường; secret được loại bỏ.
4. Artifact manifest/hash, ảnh/video/mẫu 3D mở được và cách tái hiện.
5. Chỉ số đo được, giới hạn/chỉnh tay/lỗi; phân biệt fixture với run model thật.
6. Contract compatibility và đề xuất đổi nếu có; việc còn thiếu và bước tiếp theo.

Codex review trả: kết luận PASS / NEEDS CHANGES / NOT VERIFIED cho gate; lỗi chặn theo mức ưu tiên; bằng chứng thiếu; yêu cầu sửa cụ thể cho từng bên. Model chọn engine chỉ thành quyết định sau khi có bằng chứng phần cứng + chất lượng + quyền dùng. Chất lượng diện mạo cuối cùng cần chủ dự án xem và xác nhận.
