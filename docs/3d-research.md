# Fitmatch — nghiên cứu nguồn mở cho nâng cấp 3D

Ngày khảo sát: 04/11/2026 (America/New_York).

## Trạng thái thực tế

Đã clone 8 repository bằng HTTPS, depth=1, bỏ tự động tải Git LFS. Mỗi repo có commit cố định trong `repository-manifest.json`. Đã đọc README, hướng dẫn cài đặt, license cấp repo, entrypoint/config quan trọng và code ở các điểm được nêu bên dưới. Chưa tải checkpoint/dataset, chưa cài hay thực thi code bên thứ ba, chưa benchmark trên PC Windows RTX 3060 12GB của người dùng. Clone hiện nằm trên máy đang làm việc với Codex, KHÔNG phải đã cài lên PC Windows.

Mục tiêu đã được người dùng xác nhận: bản đầu phải có avatar 3D xoay được và thay áo; có thể giới hạn loại áo. Thử đồ 2D không thay thế tiêu chí ra mắt này.

## Danh mục đã clone

| Repository | Stars lúc khảo sát API | Commit | License cấp repo |
|---|---:|---|---|
| [SII-LiMing/ReWeaver-Code](https://github.com/SII-LiMing/ReWeaver-Code) | 30 | `e5640769f89d` | Chưa xác định |
| [SiTH-Diffusion/SiTH](https://github.com/SiTH-Diffusion/SiTH) | 219 | `6401549120a4` | MIT |
| [YuliangXiu/ECON](https://github.com/YuliangXiu/ECON) | 1213 | `d8f4e8b7171e` | Custom / cần đọc file |
| [biansy000/ChatGarment](https://github.com/biansy000/ChatGarment) | 184 | `798c34ac0431` | Apache-2.0 |
| [fashn-AI/fashn-vton-1.5](https://github.com/fashn-AI/fashn-vton-1.5) | 375 | `7c0f10af3f91` | Custom / cần đọc file |
| [maria-korosteleva/GarmentCode](https://github.com/maria-korosteleva/GarmentCode) | 493 | `d44962997902` | MIT |
| [sail-sg/sewformer](https://github.com/sail-sg/sewformer) | 220 | `281202a70d36` | Chưa xác định |
| [scnuhealthy/VTON360](https://github.com/scnuhealthy/VTON360) | 52 | `e9e6a661c3c3` | Chưa xác định |

Số sao không phải điểm chất lượng hay bằng chứng chạy được trên 3060. License cấp repo không tự động bao phủ checkpoint, body model, dataset hoặc phụ thuộc. Các repo không có file license ở gốc được giữ để nghiên cứu; chưa chọn đưa code vào sản phẩm.

## 1. ChatGarment — ưu tiên khảo sát ảnh → rập → áo 3D

Nguồn: https://github.com/biansy000/ChatGarment

- README có inference ảnh bằng `scripts/v1_5/evaluate_garment_v2_imggen_2step.sh`; đầu ra rập/JSON, sau đó `run_garmentcode_sim.py` dựng và mô phỏng trang phục.
- `docs/Installation.md` yêu cầu checkpoint riêng, GarmentCodeRC và sửa các đường dẫn hardcode. ContourCraft-CG là repo mô phỏng liên quan, chưa clone trong đợt này.
- Script inference dùng `liuhaotian/llava-v1.5-7b`, bf16 và deepspeed. `scripts/evaluate_garment_v2_imggen_1float.py` đặt `load_in_4bit=False`, `load_in_8bit=False`, đẩy toàn model lên CUDA.
- Suy luận phần cứng: riêng 7 tỷ tham số ở 2 byte/tham số xấp xỉ 14 GB thập phân, chưa tính vision, activations và bộ đệm; không coi script mặc định là phù hợp 12 GB. Quantization/offload là công việc thử nghiệm, chưa được chứng minh trong luồng này.
- Code simulator dùng body `mean_all` và đường dẫn cá nhân. Cần adapter nhận body của người dùng, không chỉ sửa đường dẫn rồi coi đã tích hợp.
- README thừa nhận kích thước áo có thể sai và cung cấp postprocess. Không dùng ảnh đơn để cam kết size.
- Kết luận: ứng viên R&D chính cho cấu trúc áo; không hứa giữ nguyên logo/print, mặt sau, kích thước và texture chỉ từ đầu ra pattern.

## 2. GarmentCode — nền tảng rập và mô phỏng

Nguồn: https://github.com/maria-korosteleva/GarmentCode

- Có thư viện panel/edge/component, chương trình áo và tham số thiết kế, body presets, GUI.
- `docs/Running_data_generation.md` mô tả lấy mẫu rập rồi drape trên cơ thể; có `pattern_data_sim.py`, `pattern_fitter.py` và cấu hình collision/material.
- `docs/Installation.md` yêu cầu fork `maria-korosteleva/NvidiaWarp-GarmentCode`, Python 3.9 và một số phụ thuộc native.
- `pygarment/meshgen/boxmeshgen.py` có xử lý mesh, UV và OBJ; cần bước đóng gói GLB và QA trên web.
- Đây không phải model chuyển ảnh bất kỳ thành áo. Giá trị là tạo áo từ cấu trúc/tham số đã biết và mô phỏng.
- Cảnh báo thiết kế sản phẩm: tool tạo đồ made-to-measure có thể thay kích thước rập theo body. Với tủ đồ cá nhân, phải GIỮ kích thước chiếc áo khi đổi người; không tự resize áo theo người rồi tuyên bố áo vừa.
- Ưu tiên cho đường cơ sở 3D có kiểm soát: một template áo, một body chuẩn, sau đó body cá nhân.

## 3. ReWeaver — ảnh nhiều góc → cấu trúc trang phục

Nguồn: https://github.com/SII-LiMing/ReWeaver-Code

- README mô tả 3D curves/patches/connectivity và panel 2D từ sparse multi-view RGB.
- Có link checkpoint, configs và model code. Môi trường công bố Python 3.12.9/CUDA 12.4/PyTorch 2.6.
- Đầu ra evaluation trong README là `.npz`, không phải app xuất GLB mặc được ngay.
- `data.py` và `configs/eval_tileable.yaml` đang phục vụ layout GCD-TS có ảnh render theo góc và panel annotation. Cần kiểm tra/tách inference không cần ground truth trước khi dùng ảnh thực người dùng.
- Chưa tìm thấy license ở gốc repo; chưa xác minh độ bền trên ảnh áo chụp trên giường/móc và chưa đo VRAM.
- Ưu tiên: nghiên cứu nếu người dùng chấp nhận chụp nhiều góc. Không khóa kiến trúc MVP vào nó trước benchmark.

## 4. SewFormer — baseline ảnh người mặc đồ → rập

Nguồn: https://github.com/sail-sg/sewformer

- Code thực ở `Sewformer/`, không ở gốc; có inference.py, config và link checkpoint.
- README hướng dẫn inference trên ảnh thật; bước mô phỏng dựa SewFactory/Maya.
- `SewFactory/ReadMe.md` yêu cầu Maya 2020, Arnold, Qualoth. Không coi pipeline là giải pháp miễn phí hoàn toàn hay backend web dựng sẵn.
- Không thấy license cấp repo ở gốc; quyền sử dụng model và các thành phần phải kiểm tra riêng.
- Ưu tiên: baseline so sánh cấu trúc rập, không ưu tiên simulator mặc định cho app.

## 5. ECON — ảnh → người 3D đang mặc đồ

Nguồn: https://github.com/YuliangXiu/ECON

- Có `apps/infer.py`, model/config, hướng dẫn Windows riêng và khả năng animation theo SMPL-X.
- `docs/installation-windows.md` yêu cầu native extensions, PyTorch3D, CUDA và model tải sau đăng ký. Có gánh nặng tương thích dependency.
- Output clothed human không tương đương body sạch + áo riêng. Cần lựa chọn body representation và garment separation cho thay áo.
- LICENSE giới hạn nghiên cứu/giáo dục/nghệ thuật phi thương mại; không chọn nguyên trạng cho sản phẩm thương mại.
- Ưu tiên: baseline nghiên cứu shape/avatar, không mặc định là engine production.

## 6. SiTH — người 3D có texture từ một ảnh

Nguồn: https://github.com/SiTH-Diffusion/SiTH

- `run.sh`: fit SMPL-X → hallucinate mặt sau → reconstruct mesh.
- README kiểm thử trên Ubuntu 22.04 và RTX 3090; không có benchmark 3060 trong phần đã đọc.
- Bước sinh mặt sau có tính ngẫu nhiên, tài liệu đề nghị chọn kết quả. Cần chuyển thành QA hoặc luồng tự động có điều kiện.
- README ghi UV unwrap cho animation có thể hơn 10 phút/mesh trong bối cảnh tác giả; không dùng thời gian reconstruction quảng bá để hứa toàn pipeline tức thì.
- MIT cho repo, nhưng body model/checkpoint/phụ thuộc cần rà riêng. Body model SMPL-X cần có quyền dùng tương ứng.
- Ưu tiên: benchmark avatar có texture; chưa giải quyết thay áo độc lập.

## 7. VTON360 — tham khảo mặc thử nhiều góc / 3DGS

Nguồn: https://github.com/scnuhealthy/VTON360

- Có code multiview edit, human parsing, render và lifting qua custom Splatfacto/3D Gaussian Splatting.
- README sử dụng đầu vào người 3D/multiview; không phải một API đơn giản nhận selfie rồi cho avatar thay áo ngay.
- Có checkpoint links; inference phải chạy phần front/back riêng theo hướng dẫn do giới hạn GPU memory của pipeline.
- Kiểm tra requirements.txt thấy trùng PyYAML khác phiên bản (6.0.1 và 6.0.2); README và requirements khác version nerfstudio/gsplat/torch. Cần môi trường tái lập trước benchmark.
- Đầu ra biểu diễn 3DGS không mặc nhiên là mesh GLB rigged với áo tách rời. Viewer, chỉnh sửa và cache cho mỗi outfit sẽ khác pipeline garment mesh.
- Không có file license gốc được tìm thấy; việc dùng các parsing checkpoints từ hệ khác cũng cần rà.
- Ưu tiên: nghiên cứu chất lượng 360; chưa coi là lựa chọn chắc chắn cho MVP 3060.

## 8. FASHN VTON 1.5 — đối chứng hình ảnh

Nguồn: https://github.com/fashn-AI/fashn-vton-1.5

- Nhận ảnh người + đồ, xuất ảnh; inference có sẵn và category tops/bottoms/one-pieces.
- Apache-2.0 cấp repo; weights và third-party components cần đối chiếu riêng.
- Không xuất body hoặc garment 3D. Giữ làm baseline nhận diện/màu/print hoặc tính năng ảnh phụ; không dùng thay yêu cầu 3D.

## Đề xuất sau đọc code (chưa là quyết định chọn engine)

1. Chứng minh một áo template 3D thực sự mặc được lên body và xuất model xoay được trên web. Bước này là technical spike, chưa được tính là hoàn tất tính năng chuyển ảnh người/áo.
2. Benchmark body fitting với ảnh và số đo, đánh giá silhouette; tách body dùng để drape khỏi hình dạng quần áo đang mặc trong ảnh.
3. Chọn 1–2 kiểu áo sau phỏng vấn; dùng ảnh trước/sau + thông số để tạo hoặc chỉnh template, sau đó thử ChatGarment và ReWeaver nếu điều kiện đầu vào phù hợp.
4. Giữ nguyên chiếc áo giữa các body, kiểm tra collision; xây bước texture riêng để giữ màu/logo và phân biệt phần được quan sát với phần suy đoán.
5. Chỉ chốt engine sau khi đo trên Windows/WSL2 RTX 3060 thực: peak VRAM, RAM, cold/warm latency, tỉ lệ lỗi, chất lượng và giấy phép.

WSL2 là ứng viên môi trường Linux trên PC Windows; Microsoft xác nhận CUDA/PyTorch trong WSL được hỗ trợ: https://learn.microsoft.com/en-us/windows/ai/directml/gpu-cuda-in-wsl . Chưa cài hay xác nhận cấu hình WSL trên máy người dùng.

## Các điều chưa xác minh

- RAM hệ thống, CPU, SSD, driver, Windows version, WSL2, truy cập PC và tốc độ mạng.
- Checkpoint URLs có tải được không, account gates và giấy phép đầy đủ theo asset.
- Chạy thành công, thời gian/công suất phục vụ trên 3060, độ chính xác ảnh người dùng thực.
- Body từ ảnh có đáp ứng mức giống mặt/dáng người dùng mong muốn không.
- Ảnh áo có đủ thông tin để tái tạo đúng kiểu, kích thước, mặt sau và print không.
