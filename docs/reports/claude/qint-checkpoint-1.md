# QINT-C checkpoint 1 — CL-QINT-20261107-01

App branch `codex/qwen-app-test` @ `9311099` (từ d17ca355; giữ nguyên 521972e/2bfa6ad/0c8f936). Cho PC đọc ngay, Codex review sớm. Chưa có server/worker wire mới cho Qwen; chưa chạy real GPU.

## 1. PC-QUIESCENCE-01 — `7d2283b` (production transport)
- `OwnedProcessTree` trong `scripts/worker/worker.py`:
  - POSIX: adapter có session/process group riêng; coi còn sống khi nhóm còn member không phải zombie.
  - Windows: adapter tạo ở trạng thái `CREATE_SUSPENDED`, gắn vào Job Object riêng cho từng job (KILL_ON_JOB_CLOSE, nested trong job của worker), rồi `NtResumeProcess`; coi còn sống theo ActiveProcesses do kernel báo.
  - Chỉ kill trong job/group của mình, không bao giờ kill theo PID tra ở nơi khác.
- `drain()` chạy ở cả success/timeout/cancel/lease-loss. GPU lock chỉ nhả khi drain trả True.
- Nếu không chứng minh được drain → **quarantine**: giữ lock, không claim, kiểm lại mỗi lần poll; `--once` exit 4.
- Adapter env có `FITMATCH_GPU_LOCK_HELD_BY=worker` và `FITMATCH_GPU_LOCK_PATH`: guard của PC3D không được lấy lại cùng lock.
- Linux: 27/27 Python worker tests PASS. Gồm repro gap cũ (stop_process trả về khi grandchild còn sống), drain chỉ cây owned trong khi foreign sentinel vẫn sống, child bỏ qua SIGTERM, zombie, lock giữ tới khi drain, vòng quarantine, và đặt job Windows bằng fake.
- **Windows native NOT RUN** → PC3D cần chạy 27 tests trên Windows và kiểm native: venv launcher/interpreter/grandchild, nested Job Object được phép, foreign sentinel vẫn sống.

## 2. Contract proposal — `9311099`
- `docs/qwen-contract-v1.md`: luồng, envelope, bảng exit codes (75 GPU_BUSY / 74 MEMORY_PRESSURE là retryable, không tính vào attempt), lock owner duy nhất, cách người dùng xác nhận, khác biệt với PR7, checklist ACK.
- `schemas/qwen-v1/*.json` (Draft 2020-12, gồm cả các rule liên trường) và `fixtures/qwen-v1/` (4 valid, 16 invalid).
- PC kiểm bằng `python scripts/check-qwen-contract.py [result.json]` (hiện: PASS).

## Cần ACK
- **PC Qwen:** sinh output adapter theo `analysis-result`, khớp exit codes, gửi source+hash.
- **PC3D:** guard không lấy lock lồng nhau; ACK đường dẫn lock tuyệt đối + byte 0 + hash guard mới; chạy native drain.
- **Codex:** review contract + drain trước khi grant capability trên test server.

## Tiếp theo
Migration additive cho JSON-result jobs, API, worker transport, UI review/confirm và runbook — sẽ báo ở checkpoint sau.
