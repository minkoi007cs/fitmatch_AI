# Repro 05/11/2026 — Claude review (CL-REVIEW-20261105-01)

Chạy trên bản sao **không sửa** của Studio `d2a98983391c90c0df0c7decb67bd2b0d8cad9c6`:
migration sha256 `149fbcbf3d729870f0abd961cf9989594af4c298623c54fff4ec1ec6b5a07a8d`, worker.py sha256 `c17109dcb2f7af2377c676dd8c1d51728682a0a27f499995e097c8b5b9a0abcb`.
Chỉ dữ liệu synthetic, không network, không Supabase/PC thật.

```sh
# PostgreSQL 16 local, socket /tmp/pgrepro, user postgres trust (xem đầu repro.sh)
MIGRATION=<studio>/supabase/migrations/20261105_studio_control_plane.sql ./repro.sh   # -> repro.log
WORKER_PY=<studio>/scripts/worker/worker.py python3 -I worker_repro.py               # -> worker_repro.log
```

Kết quả lưu trong `repro.log` (14/14 kỳ vọng tái hiện) và `worker_repro.log` (W1, W2 tái hiện).
Đây là test thể hiện lỗi hiện tại; sau khi sửa, các dòng "REPRODUCED" tương ứng phải đổi thành hành vi mới và nên chuyển vào `scripts/test-v2-db.mjs` / `test-v2-http.mjs`.

## Kiểm tra bản đề xuất sửa

`proposed_worker_recovery.sql` (P1/P2/P4) áp lên migration gốc, chạy `repro.sh` trước (tạo role), rồi:

```sh
MIGRATION=<studio>/supabase/migrations/20261105_studio_control_plane.sql bash verify_proposal.sh   # -> verify_proposal.log, 11/11 OK
```

Chạy các script bằng `bash`/`python3 -I`, không cần quyền thực thi.
