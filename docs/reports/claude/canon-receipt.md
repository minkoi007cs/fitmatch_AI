# Receipt — CL-CANON-20261109-01 (QREV-BIND-02 + ENV-CANON-01)

| Mục | Giá trị |
|---|---|
| Session | CL-CANON-20261109-01 — Claude (cloud Linux), owner app/worker transport/config/tests/runbook theo `docs/handoffs/prompt-claude-canonical-backend-20261109.md` |
| Docs đã đọc | ops `7b247ba` (PROC-0024): AGENTS→agent→roadmap→process; `backend-canonical-20261109.md`, `backend-environments.json`; H-QFINAL-022, `prompt-claude-final-gpu-binding-20261108.md`, `qrace-acceptance-20261108/review.md`; PC repro `docs/pc-safe-008-20261107` (`qfinal022-report.md`, `repro_qrev_binding_cpu.py.txt` sha `8290691…`) |
| App baseline | `579ece2f4d7eb1b5336fec1469d5965ab9d8f919` trên `codex/qwen-review-fixes` (cleanup focused PASS giữ nguyên, không viết lại queue/collector) |
| Branch | tiếp tục `codex/qwen-review-fixes`, descendant, không rewrite history |

## Scope
1. **QREV-BIND-02 (trước, checkpoint sớm):** worker không còn nhận đường dẫn lock/slot/guard tự khai trong config cho chế độ GPU dùng chung. Đường dẫn suy ra từ một file chính sách do điều phối viên PC3D tạo, pin sha256; khóa được xác thực bằng **danh tính file** (volume + file id, chống alias/junction/bản sao) trên chính handle đã mở; slot cùng thư mục, không symlink; guard theo đường dẫn tương đối trong chính sách + hash. Khóa ngoại lai/slot giả bị từ chối trước claim/spawn/CUDA. Không lock lồng, không tin biến môi trường. Hình dạng file chính sách = đề xuất cần PC3D/Qwen ACK; không đổi adapter wire.
2. **ENV-CANON-01:** kiểm danh tính backend phía server (URL/key ↔ project `gohczmqykjkrgdblgbog`; smoke `wqbwwusrhertqktwsxsl` luôn bị từ chối; chế độ test cô lập chỉ loopback) trước ghi/enroll/claim; worker kiểm origin + project trả về từ app trước khi claim. Ví dụ cấu hình chỉ placeholder/URL công khai, không secret.
3. Bộ truy vấn chỉ-đọc + quy trình đối chiếu schema/RLS/storage/migration và khôi phục cho project chính; **chạy khi có quyền truy cập đúng** — không xin secret trong chat, không sửa mật khẩu DB, không migration cloud.

Ngoài scope: deploy, migration cloud, cấp quyền worker/GPU, PC guard/runtime/adapter, `tools/acceptance`, process chính.

## Kết thúc (Ready for review)
App `codex/qwen-review-fixes`: `8c297fe` (binding + backend identity, checkpoint sớm), `2d629a3` (công cụ kiểm kê schema), `2a40f48` (kiểm tra binding an toàn trên Windows — SHA đã kiểm toàn bộ), `f80749a` (report + logs). Worker sha256 `ef25136b…16b6`. Kết quả/blocker: [canon/report.md](./canon/report.md); checkpoint cho PC ACK native: [canon/pc-binding-checkpoint.md](./canon/pc-binding-checkpoint.md). Native Windows, kiểm kê project chính (chưa có quyền truy cập đúng), HTTPS đúng revision + token và Qwen thật vẫn NOT RUN.
