# Prompt PC — tiếp tục checkpoint SiTH 004, không làm lại từ đầu

> Nguồn đọc chung hiện hành là nhánh GitHub `codex/project-operations`; đọc [hướng dẫn đồng bộ](./github-sync.md). Giữ code/checkpoint trong repo riêng, không cần chuyển ZIP hoặc chép đè toàn repo.


Bạn là agent PC/GPU của FitMatch, tiếp nối việc đang dở trên chính PC. Codex làm chuyên gia đánh giá; Mac có app/control-plane đang phát triển. Đọc đầy đủ `AGENTS.md` → `agent.md` → `roadmap.md` → `process.md` và `docs/handoffs/reassignment-2026-11-05.md`. Nếu file mới chưa có trên PC, nhận bộ resume handoff trước; vẫn có thể kiểm checkpoint/toolchain độc lập. Không tạo subagent/chat mới.

## A. Đối chiếu checkpoint trước sửa

- Workspace được báo cáo: `C:\Users\johnn\Documents\Fitmatch-GPU\fitmatch_AI`.
- Model SMPL-X: `C:\Users\johnn\Documents\Fitmatch-GPU\models\smplx`.
- Đọc `workers\windows\TOOLCHAIN-STATUS.md`, process/report/session local mới nhất, checkpoint004 và gói `fitmatch-sith-handoff-20261105-003.zip`. Nếu có 004 mới hơn dùng 004, không ghi đè bằng 003 hoặc tài liệu Mac cũ.
- Body đã chạy: `outputs\pc-sith-20261105-003\body-fit-retry2\000_smplx.obj`; tìm cả collision candidate/previews/patch/env/weights thực tế. Giữ nguồn, junction, version.txt và checkpoint.
- Báo cáo trước có RTX3060 12GB, RAM16GB, driver610.88; Python3.10.22, torch2.1.0+cu121. Body fitting FP32 200 vòng:53,61s, peak torch VRAM3,07GiB, RAMprocess3,21GiB, không OOM; male/female/neutral CUDA forward được. Đây là số đo cũ, ghi rõ khi tái sử dụng, không giả thành phép đo mới.
- Kiểm git status/branch/HEAD, paths, disk, env và log thực tế. Không tải lại/restore lại SMPL-X hoặc chạy lại fitting chỉ vì prompt mới. Không tạo repo/env song song nếu env cũ còn đúng.
- Ghi session/task PC-00/01/03 theo phần thực sự đang tiếp tục; nhập delta vào process. Không dùng process snapshot Mac để xóa lịch sử/claim PC cũ. Xác định inventory còn thiếu, không làm lại phần đã có bằng chứng.

## B. MSVC/UAC — kiểm tra và giữ đúng checkpoint tạm dừng

Báo cáo mới nhất nói chủ dự án chưa ở gần PC, đã tạm dừng cài Administrator. Giao việc lại không tự gỡ tạm dừng này.

1. Kiểm tra read-only MSVC/SDK/cl.exe, CUDA Toolkit/nvcc/ninja, env compiler và nvdiffrast hiện có. torch.cuda available không chứng minh compile được extension.
2. Nếu compiler vẫn thiếu và cần UAC: lưu checkpoint, chỉ rõ cần người dùng chấp thuận bước nào trong `workers\windows\install-msvc-admin.ps1`, giữ phần cài admin dừng cho đến khi chủ dự án xác nhận quay lại/cài xong. Không mở thêm UAC liên tục, bypass, đổi driver hoặc restart.
3. Trong lúc chờ, hoàn thiện inventory delta, export/debug validator, đọc adapter contract, chuẩn bị scripts và report độc lập; không khai avatar capability.
4. Nếu compiler đã được cài có bằng chứng, nạp đúng build environment và chạy rasterizer smoke bằng đúng Python SiTH. Test CUDA rasterize tam giác thật; nếu pipeline dùng OpenGL, kiểm backend đó nữa. Import nvdiffrast thôi chưa đủ. Lưu lệnh, phiên bản compiler/CUDA và raw log.

## C. Tiếp tục phần inference còn thiếu khi toolchain đạt

- Đọc README/config/entrypoint thực tế, kiểm đủ input/weights rồi chạy sinh mặt sau → reconstruction → texture theo thứ tự repo. Tái sử dụng preprocessing/body fitting còn hợp lệ. Output mới đặt thư mục riêng.
- Một tác vụ GPU nặng mỗi lần; RAM16GB cũng là giới hạn. Đo wall time/peak VRAM/RAM theo stage, ghi OOM và profile giảm bộ nhớ nếu thử. Không nâng cấp hàng loạt torch/dependency hoặc hạ chất lượng âm thầm.
- Mẫu demo phải ghi demo; không gọi là avatar chủ dự án nếu chưa dùng ảnh của họ. Nếu input nhiều góc không được pipeline sử dụng, nói rõ ảnh nào được dùng, phần nào do AI suy đoán.
- Xuất GLB v2 có geometry, UV/material và texture nhúng; mở lại bằng tool/viewer độc lập, kiểm normals/holes/trục/scale. Giữ pose, chuẩn hóa meter/+Y-up/+Z-front cùng origin, không làm mất transform so với collision body.
- Preview front/side/back/cận mặt và turntable; hash/size. Body SMPL-X tô màu/debug export phải ghi collision/debug, không thay cho avatar textured.
- SiTH clothed mesh có thể dính áo: báo rõ giới hạn. Không tự coi output textured là body sạch + áo riêng. Giai đoạn này chưa làm rig/idle/drape nâng cao.

## D. Nối công việc Mac đang có, tránh worker thứ hai

Mac worktree `fitmatch_AI-3d-studio`, branch `codex/3d-studio-worker`, HEAD quan sát0ec92c6 + dirty V2 đã có `scripts/worker/worker.py` và protocol `/api/v2/worker`. Dùng snapshot `docs/handoffs/resume-snapshot-20261105/` để nghiên cứu, nhưng đợi Mac chốt revision trước tích hợp thật. Không triển khai `/api/worker/v1` từ bản đề xuất cũ.

- Capability hiện có: `avatar.reconstruct`, `garment.reconstruct`, `garment.drape`; một GLB/model, drape output chỉ áo aligned, body riêng. Chỉ SMPL-X fitting chưa đủ để bật bất kỳ capability tái dựng hoàn chỉnh nào.
- PC sở hữu engine adapter/export/toolchain, ví dụ `worker/adapters/` hoặc nơi hiện hữu đã ghi report. `scripts/worker/worker.py`/manage/config thuộc Mac transport owner, không sửa trực tiếp chồng lấn; gửi patch proposal khi cần.
- Adapter nhận JSON file local (`params`, `assets[].role/localPath`, versions, outputContract) và xuất GLB theo argv; không shell/eval/lệnh user cung cấp, không nhận worker token vào adapter.
- Trước live, self-test adapter trên input thật. Nếu SiTH chỉ dùng front ảnh thì contract phải nói đúng, không nhận ba ảnh rồi tuyên bố fusion. Config `engines:{}` cho tới khi engine đạt.
- Server/transport vẫn cần xử lý lost-complete/idempotency, capability scope và hai owner/một GPU; không chạy hai worker CUDA đồng thời hoặc chuyển service-role sang PC để né.
- Nếu chưa có HTTPS test URL, worker credential và migration test env được chuẩn bị: hoàn tất local adapter/output/report; không mở router port, không tự deploy/cloud.

## E. Đầu ra và điểm dừng

Lưu `docs/reports/pc/resume-004-report.md` hoặc liên kết report local hiện có, cập nhật TOOLCHAIN-STATUS và process delta, session/checkpoint/task IDs. Báo đầy đủ:

1. Baseline/branch/dirty files, checkpoint thật, phần tái sử dụng và phần vừa chạy.
2. UAC/compiler/rasterizer status, blocker và bước người dùng cần thực hiện nếu còn thiếu.
3. GLB/previews/hash và lệnh tái hiện; số đo cũ/mới tách riêng; env/checkpoint revisions.
4. Body clean/collision/clothed/texture thực tế, manual edits, điều chưa đạt.
5. Adapter/protocol revision, capability nào đủ bằng chứng, việc tiếp nối cho Mac.

Gói bàn giao không chứa model SMPL-X/weights/token/ảnh cá nhân mặc định. Không push/deploy, đổi driver/reboot, thuê GPU/API trả phí. Dừng để Codex review output textured và giới hạn body trước khi mở thêm áo/animation; phần độc lập được phép tiếp tục với nhãn trạng thái rõ.
