# Giao việc cho Codex trên PC Windows — Fitmatch 3D

## Nhiệm vụ

Triển khai và chạy thật pipeline GPU cho Fitmatch: ảnh người → avatar 3D riêng; ảnh áo trước/sau → áo riêng đã drape lên avatar; xuất GLB để Studio đang được làm trên máy Mac đọc được. Đừng dừng ở kế hoạch hoặc tạo mannequin thay người dùng. Có quyền làm code, cài môi trường nghiên cứu riêng trong dự án, tải repo/checkpoint công khai có quyền dùng, chạy benchmark. Không mua dịch vụ, không deploy, không lấy ảnh cá nhân ngoài mẫu được người dùng cấp. Nếu checkpoint cần đăng ký/đồng ý điều khoản, ghi đúng bước cần người dùng thực hiện; không bỏ qua.

Đọc AGENTS.md và hướng dẫn Next đúng version nếu sửa web. Phần web đã có importer/viewer; ưu tiên code dưới workers/ và benchmark GPU. Không sửa auth, DB production hoặc merge main.

## Yêu cầu người dùng đã chốt

- RTX 3060 được hiểu là 12 GB VRAM, Windows; RAM chưa biết.
- Desktop, avatar chân thực; bản đầu bắt buộc 3D xoay được.
- Áo thun + sơ mi; giữ màu/logo/form để xem phối đồ. Chưa cam kết size.
- Ảnh áo trước/sau nền trơn, ảnh chi tiết khi cần; capture cơ thể do pipeline đề xuất.
- Khi bấm áo đã chuẩn bị phải gần tức thì: mọi reconstruction/drape chạy trước, không mỗi lần click gọi model.
- Nghiên cứu/nhóm nhỏ; chưa có ngân sách thuê GPU.

## Bắt đầu

1. Chạy `powershell -NoProfile -File .\workers\windows\Collect-Hardware.ps1` từ terminal Windows. Đọc reports/hardware.json, không suy đoán RAM. Không cần admin hay tắt execution policy. Nếu chính sách máy chặn script, báo nguyên nhân và dùng các lệnh Get-CimInstance/nvidia-smi trực tiếp; không tắt policy.
2. Tạo nhánh `codex/pc-gpu-pipeline` từ commit handoff. Nếu nhận ZIP snapshot chưa có .git, tạo Git repo cục bộ, commit baseline trước khi sửa để có thể bàn giao patch. Đọc docs/3d-upgrade-plan.md và docs/3d-research.md.
3. Xác định CUDA/WSL hiện có; ưu tiên WSL2 Ubuntu nếu có. Không thay driver hoặc cài WSL yêu cầu restart khi người dùng đang dùng máy mà chưa thông báo. Cài Python deps trong env riêng cho từng engine, không vào system Python, không gộp requirements các repo.
4. Lưu lệnh, version, lỗi và kết quả vào reports; không ghi token, username account hoặc đường dẫn file cá nhân vào báo cáo chia sẻ.

## Repo nghiên cứu (pin commit)

- SiTH: https://github.com/SiTH-Diffusion/SiTH — 6401549120a4a6246b5cb4a10d8c3e1b2d9e8c7d.
- ECON: https://github.com/YuliangXiu/ECON — d8f4e8b7171e30868acd94a1d1f6fcc1238e3e32. Phi thương mại; kiểm tra điều khoản và asset trước dùng.
- GarmentCode: https://github.com/maria-korosteleva/GarmentCode — d449629979028123a5c4dc9e732a2ec19b7fce31. Cần fork NvidiaWarp-GarmentCode cho simulator.
- ChatGarment: https://github.com/biansy000/ChatGarment — 798c34ac04319668aaa0e3a3a02d44284fbd70ec. Script 7B bf16 không mặc nhiên vừa 12 GB; chưa có bản quantized được chứng minh. Cần GarmentCodeRC.
- ReWeaver: https://github.com/SII-LiMing/ReWeaver-Code — e5640769f89d9540d118a9cc605ebe2d7404bc02. Chưa thấy license gốc; tham khảo nghiên cứu, không tự đưa vào sản phẩm public.
- VTON360: https://github.com/scnuhealthy/VTON360 — e9e6a661c3c3c8fc799ddf8e92276ca0790b67da. Không giả định 3DGS bằng GLB mesh áo riêng.

Clone vào thư mục ignored `research-repos/`, dùng GIT_LFS_SKIP_SMUDGE=1 khi chưa cần weights. Đọc source trước khi chạy script tải/cài; checkpoint và data lấy theo hướng dẫn chính thức. Không chạy code không hiểu chỉ để có output.

## Thứ tự thực hiện và đầu ra

### GPU-01: hardware và environment

Báo cáo OS, RAM, GPU/VRAM, disk, driver, phiên bản torch/CUDA nếu đã cài. Smoke test CUDA tensor và peak VRAM thật. Nếu không có quyền truy cập GPU từ WSL, giải quyết hoặc ghi rõ blocker, tiếp tục phần CPU/format.

### AV-01: ảnh → avatar

Thử demo chính thức với dữ liệu mẫu có quyền dùng trước, sau đó dữ liệu người dùng cấp. Lưu OBJ/mesh gốc, texture và GLB. Bắt đầu batch=1. SiTH benchmark gốc dùng 3090; không hứa 3060 chạy được trước khi thử. Giảm số back samples/grid nếu cần và ghi tác động chất lượng.

Tách body/collision khỏi áo đang mặc. Mesh người mặc đồ liền KHÔNG hoàn thành avatar thay áo. Nếu fitting body model cần tài khoản/giấy phép, nêu rõ để người dùng lấy asset hợp lệ; tiếp tục skeleton pipeline và exporter trong khi chờ.

### GAR-01: một áo thun + body chuẩn

Chứng minh GarmentCode/Warp dựng được áo riêng từ pattern và drape lên body. Giữ kích thước chiếc áo khi đổi body. Áo template chỉ chứng minh đường cơ sở, ghi là template, không tuyên bố đã chuyển ảnh thành áo.

### GAR-02: áo từ ảnh thật

Tạo adapter ảnh trước/sau → cấu trúc/template có kiểm soát; benchmark ChatGarment nếu đủ khả năng offload/quantization. Tách UV/texture transfer để giữ logo/họa tiết. Không tự bịa mặt sau nếu đã có ảnh. Lưu lỗi cổ/tay/logo/texture cùng ảnh đối chiếu. Sau thun mới mở rộng sơ mi.

### FIT-01: prepared fitting export

Thư mục `outputs/<run-id>/` gồm:
- manifest.json theo manifest.example.json (chỉ liệt kê áo thật sự đã tạo).
- avatar.glb: body có texture và head/hair nếu pipeline thực có.
- tee.glb / shirt.glb: CHỈ mesh áo đã drape, không lặp body trong mỗi áo.
- benchmark.json, quality-notes.md, source/provenance và phiên bản pipeline.

Contract GLB: v2, mét, +Y lên, cùng origin/scale/pose cho body và áo, hướng mặt +Z; không normalize từng mesh riêng. Texture nhúng trong GLB, không URL/file ngoài; bản đầu không Draco/KTX2. Tối đa 40 MB/file, 120 MB/bundle, 12 áo. Mesh tĩnh, không yêu cầu rig. Không dùng material giả sửa màu để giấu mất texture.

Viewer đã hỗ trợ mở manifest.json cùng GLBs, cache meshes và toggle visible. Không đổi contract tùy tiện; nếu cần thêm field, đề xuất version mới và test tương thích.

### QA-01: báo cáo thật và bàn giao

Đo cold/warm latency riêng avatar/garment/drape/export, peak allocated/reserved VRAM, RAM, số lần OOM và version. Không dùng thời gian README làm thời gian máy này. Tạo ảnh front/side/back cho review nếu có renderer chạy được. Lưu limitation và task chưa xong.

Bàn giao: commit riêng, `git diff --binary <baseline> HEAD > pc-gpu.patch` (hoặc git bundle nhánh), output GLBs và reports. Giữ raw images/weights ngoài Git. Không push/merge/deploy tự động. Không đánh dấu complete nếu chỉ có script chưa chạy.

## Điều kiện hoàn thành

Ít nhất một avatar từ ảnh và một chiếc áo từ ảnh riêng, đã drape không xuyên rõ, giữ logo/màu hợp lý, output mở trong Studio xoay được. Có benchmark thật trên 3060 và báo cáo phần chưa đạt. Nếu vướng body/checkpoint/ảnh mẫu, hoàn thành các bước độc lập rồi chỉ rõ đúng dữ liệu hoặc quyền còn thiếu; không tự thay kết quả bằng hình minh họa.
