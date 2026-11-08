# QINT-C checkpoint 3 — CL-QINT-20261107-01

App `codex/qwen-app-test`, source `ef244e1` (head sau report: xem nhánh). Docs ops vẫn `c5e2429`; chưa có review Codex hay receipt PC mới cho QINT-C/G/P.

- Trạng thái PC đúng thực tế: `workerOnline` (worker của owner được grant + đang khai + heartbeat < 90 s). UI báo "PC đang offline" khi không có worker; `MEMORY_PRESSURE` có thông báo riêng (khác GPU bận).
- Tắt cờ phía server: `storableCapabilities()` bỏ `garment.analyze` khỏi heartbeat (unit test).
- Tài khoản thứ hai đăng nhập qua auth mock: không thấy và không cancel/retry/confirm được analysis của owner (404), action trên job của owner bị từ chối (409), dữ liệu không đổi.
- Kết quả: npm 64/64, lint, build, DB 8 blocks, HTTP/browser 14 PASS, contract 48 files, qwen conformance, Python 30/30 — exit 0. CPU/mock only.

Vẫn chờ: PC3D native drain + guard ACK, PC Qwen adapter thật + conformance, Codex review, test env HTTPS + credentials.
