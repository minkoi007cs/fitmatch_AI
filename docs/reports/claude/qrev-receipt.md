# Receipt — CL-QREV-20261108-01 (QREV-LOCK / QUOTA / SNAPSHOT / STATUS)

Ghi trước lần sửa source đầu tiên; không phải bằng chứng hoàn thành.

| Mục | Giá trị |
|---|---|
| Session | CL-QREV-20261108-01 — Claude (cloud Linux), owner app/SQL/transport theo prompt-claude-qwen-review-fixes-20261108 |
| Docs đã đọc | `218bc20` (PROC-0020): AGENTS→agent→roadmap→process, review `docs/reports/review/qwen-code-20261108/review.md`, PR10 `a49cc8b` (guard `47331c56…`, gpu-contract-proposal, native report), PR9 `174df07` worker bridge |
| App baseline | `95d59ad5846d78f47209041a76198ad56c378f58` (checkpoint 3 trên `codex/qwen-app-test`, giữ mọi fix trước + two-account HTTP tests) |
| Branch | `codex/qwen-review-fixes` tạo từ 95d59ad (descendant), clone riêng phiên cloud |

## Scope
- **QREV-LOCK (P1):** `scripts/worker/worker.py` startup admission khi có `garment.analyze`: `gpuLock` tuyệt đối, đã tồn tại (không tự tạo), không `default`; pin `gpuGuard.sha256` (47331c56… do PC3D ACK); slot admission `gpu0-slot.json` cùng quy tắc finite của guard (owner `pc-ai`, không hết hạn, ≤3600 s, skew 5 s), kiểm tra sau khi giữ lock; worker là lock owner duy nhất, không gọi guard lồng. Windows drain: chờ cả handle các process trong job (IsProcessInJob) sau ActiveProcesses==0. Config mẫu + runbook.
- **QREV-QUOTA (P2):** migration additive mới: quota chung 50/ngày + 20 active dùng cùng serialization với `fm_v2_enqueue`, áp cho enqueue analysis và retry; dedupe không tính quota.
- **QREV-SNAPSHOT (P2):** reserve (asset pending + cleanup intent có grace) trước upload; enqueue finalize gỡ intent; lỗi upload/enqueue → abort arm intent + xóa ngay; crash → collector sau grace.
- **QREV-STATUS:** heartbeat worker báo GPU đang bận (khi không lấy được lock), UI "PC đang bận GPU" trung thực, không lộ việc của owner khác, không tốn attempt.

Ngoài scope: PC guard/runtime, `tools/acceptance/`, process chính, production deploy/migration/grant.

## Kiểm chứng
npm test, lint, build, test:v2:db (quota/race/failure cleanup), test:v2 (HTTP/browser auth/source/retry/busy), export-contract, Python worker (Linux). Windows native: NOT RUN — PC chạy final native config/conformance.
