# Fitmatch 3D — yêu cầu đã xác nhận

> Bộ điều phối hiện hành: [agent.md](../agent.md), [roadmap.md](../roadmap.md), [process.md](../process.md). Yêu cầu mới cập nhật trong roadmap, tiến độ/claim trong process; discovery giữ nguồn yêu cầu lịch sử.

## Bổ sung đã xác nhận ngày 05/11/2026

- Chỉ chủ dự án và giáo viên sử dụng trong giai đoạn hiện tại.
- Người dùng xác nhận GPU RTX 3060 12GB; RAM/CPU/SSD và môi trường PC chưa kiểm tra trực tiếp.
- Ưu tiên độ chân thực/độ giống người thật cao nhất có thể; chưa chốt thang điểm nghiệm thu hoặc thời gian dựng cho phép.
- Giai đoạn đầu người đứng yên, camera xoay quanh; sau khi ổn định mới thêm chuyển động nhẹ cho người và cả quần áo. Không yêu cầu đi bộ/pose tự do trong đợt hiện tại.
- Giao việc cho agent trên PC và Claude bằng hai prompt riêng; Codex làm chuyên gia đánh giá kết quả. Chưa khởi chạy hoặc liên hệ hai bên từ chat này.
- Kế hoạch hiện hành: [3d-execution-plan-2026-11-05.md](./3d-execution-plan-2026-11-05.md). Các yêu cầu cũ còn phù hợp tiếp tục áp dụng; thông tin mới ở trên được ưu tiên.

Ngày: 04/11/2026 (America/New_York). Nguồn: trao đổi trực tiếp trong chat.

## Định hướng bắt buộc

- Bản đầu phải có avatar 3D xoay được và thay áo. Chấp nhận ít loại áo; không thay bằng tính năng chỉ tạo ảnh 2D.
- Avatar càng đẹp, chân thực càng tốt. Chưa có thang đánh giá độ giống hay giới hạn thời gian tạo avatar được chốt.
- Ưu tiên desktop; người dùng giao agent lựa chọn phong cách giao diện đẹp, dễ dùng.
- Bản đầu hỗ trợ áo thun và sơ mi, mở rộng sau.
- Ưu tiên giữ màu, logo/họa tiết và form chiếc áo để xem phối đồ có hợp. Chưa yêu cầu chứng minh size/chật/rộng.
- Ảnh áo: trước/sau, nền trơn; bổ sung chi tiết nếu cần.
- Chọn áo phải thay gần như tức thì. Không thiết kế mỗi lần bấm phải chờ diffusion/reconstruction.
- Hiện dùng cho nghiên cứu và nhóm nhỏ, có khả năng mở rộng.

## Nguồn lực đã biết

- Có PC Windows chạy 24/7, GPU được hiểu là RTX 3060 12 GB VRAM.
- RAM hệ thống chưa rõ; người dùng không nhớ. CPU, SSD, Windows version, driver, WSL và mạng chưa kiểm tra.
- Workspace đang thao tác ở macOS; chưa có kết nối điều khiển PC Windows.
- Chưa có ngân sách thuê GPU hay API được xác nhận. Mặc định kế hoạch ưu tiên PC sẵn có; không tự mua/thuê dịch vụ.

## Quyết định thiết kế đề xuất để đáp ứng yêu cầu

1. Tạo avatar và số hóa áo là tác vụ nền; mặc áo trong viewer là thao tác dùng asset đã chuẩn bị.
2. Chuẩn bị garment asset theo avatar hiện tại ngay sau khi thêm áo. Một áo có thể đã số hóa nhưng vẫn chưa có bản mặc sẵn cho avatar đó.
3. Luồng tạo avatar có hướng dẫn ảnh trước/bên/sau + chiều cao, thêm ảnh mặt nếu người dùng muốn giống mặt; thử nghiệm lựa chọn số đo bổ sung. Đây là thiết kế capture, không phải khẳng định các repo đã hợp nhất được mọi góc ảnh.
4. Chỉ hỗ trợ một áo ngoài cùng ở bản đầu; sơ mi mặc độc lập. Layering thun + sơ mi khoác là mở rộng riêng cần collision và QA.
5. Hình dáng và kích thước áo phải được giữ qua các avatar; không tạo áo made-to-measure ngầm.
6. Giới hạn tập áo đầu theo mẫu thực benchmark: ưu tiên thun tay ngắn và sơ mi cơ bản. Oversize lớn, áo xuyên thấu, tua rua, nhiều layer, nơ/phụ kiện phức tạp cần xét sau.

## Các thông số để benchmark quyết định, chưa được coi là đã đạt

- Chuyển áo warm/cache: mục tiêu p95 ≤ 1 giây sau khi asset đã tải; không bao gồm tạo áo hoặc tải lần đầu qua mạng.
- Tải áo lần đầu: mục tiêu p95 ≤ 3 giây trên cấu hình mạng/máy benchmark được ghi rõ.
- Tương tác viewer desktop: mục tiêu ≥ 30 FPS trên thiết bị tham chiếu, không coi RTX 3060 server là GPU của mọi người dùng.
- Thời gian tạo avatar, số hóa áo và drape: hiển thị số đo thực nghiệm; không gán thời gian giả.
- Mức giống mặt, silhouette, màu/logo/form: chốt bằng bộ ảnh thực + đánh giá người dùng, không chỉ metric hình học.

## Cần lấy dữ liệu lúc triển khai

- Ảnh mẫu có quyền dùng: người thật + áo trước/sau + ảnh người mặc đúng chiếc áo để đối chiếu.
- Thông tin PC tự động từ PowerShell/nvidia-smi sau khi có quyền truy cập máy.
- Mức chấp nhận chờ lúc tạo avatar/thêm áo, số người beta, lượng áo/người, chính sách lưu ảnh gốc.
- Chọn góc/độ chi tiết và body estimator thông qua thử nghiệm; không chọn engine theo số sao.

Các câu chưa trả lời ở bảng hỏi đầu đã được thay bằng các câu hỏi và câu trả lời cụ thể hơn phía sau. Không suy ra người dùng muốn thu phí, đánh giá size, hoặc tự động chấp nhận thuê GPU.
