# H-PAIR-007 — PC conformance + Claude R1 chạy độc lập

Ngày05/11/2026, theo yêu cầu chủ dự án giao hai bên chạy trước khi tiếp tục phỏng vấn mong muốn app. Không mở scope tính năng mới. Bản tĩnh/độ chân thực và product priorities chưa được chốt lại; không tự bắt đầu animation/category/image model mới.

## Checkpoint đã nhận

Draft PR1: https://github.com/minkoi007cs/fitmatch_AI/pull/1 , head quan sát `4ee404d476d1e733e7d1b8d30a171abd9a646615`. Reviewer đọc ba file report/delta/evidence, chưa merge. PC báo local adapter revision29725dac…,21 CPU tests, engines rỗng và checkpoint004 paused. Code/source/raw logs vẫn local, Codex chưa rerun21tests nên chỉ ghi reported PASS, không nghiệm thu engine. Không cần chuyển ZIP/weights mỗi lượt.

Claude R1 tiếp theo [prompt implementation](./prompt-claude-recovery-r1.md). Studio baseline d2a9898 còn sạch lúc kiểm; không có report R1 mới được xác nhận.

## Lệnh cho PC — PC-CONF-01, CPU-only

1. Trong checkout operations riêng, fetch/pull nhánh `codex/project-operations` sạch và đọc toàn bộ root docs + file này. Đọc PR1 local/current revision và giữ lịch sử PC. Ghi receipt/session/docs SHA. Không ghi đè process chính, không merge PR1.
2. Tiếp nối skeleton disabled tại revision local mới nhất đã test, không tạo lại env/model. Giữ checkpoint004/weights/fitting, MSVC/UAC paused; không build rasterizer, mở UAC, inference, live credentials hoặc bật capability.
3. Tạo report **`docs/reports/pc/adapter-conformance-r1.md`** mô tả interface chính xác theo code thật: input schema/roles/paths, trust boundary download hash ở transport, output GLB/header vs structural UV/texture gate, exit codes hiện có, error JSON nếu có, stdout/stderr và cách parent phân biệt lỗi. MODEL_UNAVAILABLE hiện exit78 trong report; đừng tự đổi để khớp ví dụ exit3/4/5 của proposal Claude.
4. Kiểm bằng CPU fixture có cả positive/negative cases: manifest valid nhưng engine disabled→MODEL_UNAVAILABLE/output absent; malformed input, path escape/symlink nếu OS hỗ trợ, duplicate role/id, output overwrite, env token không đi vào adapter, UV/embedded-image decode/material references hợp lệ và lỗi. Test có assert/exit1 khi fail. Chỉ thêm/rerun khi có change hoặc coverage thiếu, không lặp21tests vô ích.
5. Ghi rõ validator không chứng minh likeness/logo/scale/garment separation. Unit cap40,000,000bytes khác transport40MiB: ghi là stricter-local giới hạn tương thích hiện tại, không đổi wire unilateral. Texture-positive fixture tự tạo được dùng để chứng minh validator, không gọi textured personal avatar.
6. Chuyển cho Claude đề xuất mapping **mã lỗi adapter đang có → protocol failure codes**, gồm disabled/invalid input/export/error unknown/OOM chưa chạy; tách code đã thực thi khỏi hợp đồng đề xuất. Cả hai cần xác nhận revision trước áp dụng; PC không sửa `scripts/worker/worker.py`, server hoặc SQL.
7. Cập nhật draftPR1 bằng report/delta/evidence sanitized. Sửa lỗi encoding mojibake `â€”`/`â†’` trong report hiện có thành UTF-8 đúng. Không force push/merge, không thay process gốc, không đưa raw private paths/ảnh/mesh/weights/token lên public repo. Code adapter vẫn local như scope hiện hành; nếu muốn reviewer đọc source, báo nguồn truy cập hiện hữu, không tự public code/ZIP chứa dữ liệu riêng.
8. Bàn giao revision/test names/command/exit/hash và phần chưa chạy. Đặt PC-CONF-01 Ready for review, PC-03 vẫn Blocked(MSVC pause), PC-05 full vẫn chưa Done. Hoàn tất gói CPU thì dừng tại checkpoint mới; không tự phát sinh thêm tác vụ cho đến phản hồi Codex hoặc chủ dự án gỡ pause.

## Lệnh cho Claude — tiếp R1, nhận interface từ PC

Thực hiện đầy đủ [prompt R1](./prompt-claude-recovery-r1.md), không chỉ review/proposal thêm. Ghi receipt/actual baseline và tạo hoặc tiếp đúng nhánh task/worktree riêng, không đổi canonical Studio. Nếu bạn đã bắt đầu R1, tiếp session đó thay vì tạo nhánh cạnh tranh.

Ưu tiên: durable complete/upload recovery, safe claim redelivery, server grants và mismatch/error handling; fixture DB/API/worker chứng minh model invocation count không tăng khi outcome mơ hồ còn phục hồi được. Chưa PC live. Không bỏ checkpoint phục hồi qua restart để chỉ sửa happy path replay.

Trước final error mapping đọc PR1 và adapter-conformance-r1 khi PC gửi; dùng fake adapter mô phỏng chính exit78 disabled hiện có. Nếu chưa nhận spec, làm lớp mapping cấu hình/fixture và ghi provisional, không nói PC đã compatible. Không đợi MSVC để sửa server/transport hoặc chạy full suite cục bộ. Chỉ PC xác minh engine readiness.

Hai bên trao đổi bằng report/PR trên nhánh docs, không tự sửa file của nhau; Codex reconcile process. Claude báo progress theo R1A/B/C với commit/test đã chạy, rồi report finalSHA/diff/full suite và phần thiếu. Gửi report/PR sanitized theo quy trình GitHub; không push app/merge/deploy/migrate production theo nhiệm vụ này. Chờ Codex review trước gói R2 hoặc live.

## Điều phối và trạng thái

Người dùng đã cho phép giao việc cho PC/Claude chạy. Codex có thể gửi prompt đến chat PC hiện hữu khi host được xác nhận, không tạo chat/subagent mới. Claude external chưa có công cụ chat trực tiếp trong session; link/prompt cần chủ dự án chuyển. Ghi rõ sent vs received vs running, không nhầm publish tài liệu với đã khởi chạy cả hai.
