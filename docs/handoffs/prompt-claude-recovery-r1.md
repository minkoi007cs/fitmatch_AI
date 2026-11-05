# Claude — R1 implementation: worker recovery và capability

Bạn đã hoàn thành review CL-REVIEW-20261105-01. Chủ dự án yêu cầu Codex tiếp tục phân việc; đây là scoped handoff cho bạn **triển khai**, thay read-only ở gói cụ thể này. Không chỉ trả thêm proposal. Codex sẽ review độc lập kết quả trước merge/live.

## 1. Baseline và workspace riêng

Đọc toàn bộ AGENTS/agent/roadmap/process từ nhánh docs `codex/project-operations` mới nhất, `docs/reports/review/claude-review-20261105/review.md`, report/proposal của bạn và prompt này. Giữ lịch sử checkpoint PC004 và MSVC pause.

Baseline app trên Mac: `/Users/khoihoang/Documents/fitmatch_AI-3d-studio`, commit `d2a98983391c90c0df0c7decb67bd2b0d8cad9c6`, sạch ở lần kiểm. Đừng mặc định còn sạch; kiểm status/HEAD trước. Không đổi branch hoặc sửa file trong worktree Studio hiện hữu. Tạo nhánh `codex/worker-recovery-r1` và worktree riêng `/Users/khoihoang/Documents/fitmatch_AI-recovery-r1` từ đúng d2a9898 nếu hai tên chưa tồn tại. Nếu đã có, kiểm baseline/owner rồi tiếp nối đúng phiên hoặc báo conflict, không reset/clean/ghi đè.

D2a9898 còn local Mac, không lấy remote mainac26306 làm baseline code. Nếu bridge của bạn chỉ đọc được thì hoàn tất receipt nêu thiếu quyền viết cho worktree mới; không giả đã sửa. Không cần quyền ghi source canonical để làm nhánh task riêng. File env/secrets không copy vào report/commit; test cục bộ fixtures không cần live provider.

Session đề xuất `CL-RECOVERY-R1-20261105-01`; task R1 gắn APP-01, QA-01A. Trước code ghi receipt: docs SHA, app baseline, branch/worktree thật, dirty status và file scope vào `docs/reports/claude/recovery-r1-receipt.md`. Không nhận ownership PC adapters/toolchain.

## 2. File scope được giao

- Migration additive mới: worker/job receipts, claim/request identity và capability grants tối thiểu; không sửa production DB. Đọc Supabase skill/docs/changelog, tạo migration bằng CLI workflow phiên bản thực tế.
- `scripts/worker/worker.py`, `scripts/worker/manage.mjs`, config example nếu cần; worker protocol docs/runbook.
- `src/lib/v2/contracts.ts`, server/output helpers và route `/api/v2/[...path]` phần worker/compute status cần thiết.
- Tests liên quan recovery/RPC/DB/worker và scripts test fixture. Có thể thêm helpers nhỏ theo module, không redesign toàn app.
- Report mới và diff/commits của gói R1. Không thay viewer/quiz/recommender/cache-generation/privacy/category/animation trong gói này trừ dependency tối thiểu được giải thích.

## 3. Kết quả bắt buộc

### R1A / FIX-MAC-01 — complete và upload recovery

Output inference đã tạo không được dựng lại chỉ vì upload/finalize/complete lỗi mạng. Persist checkpoint/receipt trước và sau từng side effect để restart worker nhận lại/reconcile cùng output. Complete replay cùng assignment/attempt/output phải thành công idempotent; owner/asset/token khác, canceled/revoked/stale bị chặn. API phải đi tới nhánh replay, không chặn ở helper chỉ nhận running trước khi DB xử lý replay.

Tách trường hợp complete đã commit nhưng mất reply, complete chưa tới server, finalize đã commit nhưng mất reply, upload URL hết hạn/PUT outcome không rõ. Retry bounded/backoff/jitter theo loại lỗi. Không gửi fail mù sau finalize outcome không rõ; cũng không chỉ bỏ fail rồi để lease hết và requeue inference như cũ. Định nghĩa recoverable outcome và authoritative reconciliation trước retry job; lease còn hạn/đã mất có policy rõ, không publish late output bằng token cũ.

Output-intent cần mapping/refresh idempotent để retry không tạo artifact logic mới liên tục. Giữ output và metadata để upload lại, không xóa file job khi redelivery. Unrecognized/partial checkpoint bị từ chối an toàn; không tin file khác owner/attempt/hash.

### R1B / FIX-MAC-02 — claim redelivery

Claim reply mất: cùng request/process identity có thể nhận lại assignment an toàn, không tăng attempt và không cấp job thứ hai. Test heartbeat race, delayed response, restart khác instance, lease expiry. Thiết kế chống hai execute đồng thời cùng assignment trong một worker; dùng locking/checkpoint, không `mkdir(exist_ok=True)` rồi xóa output mù. Không buộc numeric fencing field nếu UUID lease/attempt đảm bảo cùng tính chất và được chứng minh.

### R1C / FIX-MAC-03 — capability và lỗi worker

Server/operator quản lý allowlist; heartbeat chỉ khai phần giao với grants. `compute/status` phản ánh capability được cấp và online, không lấy tự khai làm quyền. Default deny và cách grant/revoke/rotate có runbook tương thích worker hiện tại.

Protocol/revision mismatch phải giải phóng/fail rõ MODEL_UNAVAILABLE, không raise trước cleanup rồi bỏ job running. Map OOM/INVALID_INPUT/EXPORT_FAILED/timeout có contract với PC; chưa biết exit code adapter thật thì dùng fixture để test contract đề xuất, không tự khẳng định PC đã tương thích. Không lộ token biến mới vào subprocess; credentials grants/server secrets không gửi browser.

Giữ owner isolation, quotas, cancel/revoke/lease fencing; không nới permissions hoặc tắt RLS để tests pass. Không copy nguyên proposal SQL: thiếu persistent recovery và có thay đổi generation ngoài scope; tránh RPC overloaded ambiguity hoặc chứng minh mapping qua API thật.

## 4. Kiểm thử trên revision cuối

Chuyển bug repro thành regression assert đúng; fail phải exit1. Chứng minh test fail khi dùng code cũ và pass khi sửa nếu khả thi. Synthetic worker GLB20byte chỉ là transport unit fixture, API tests phải dùng GLB có mesh hợp lệ.

- DB thật cô lập: atomic/race, claim redelivery, complete duplicate/concurrent, cancel/revoke/expiry, grants và owner boundaries.
- API route thật + worker fixture: trước/sau DB commit mất reply; upload/finalize interruption; process restart từ checkpoint; inference invocation count không tăng cho cùng output còn phục hồi hợp lệ; stale lease không được publish.
- Grant mismatch/engine mismatch/OOM/error classification; secrets không lộ vào adapter environment/log.
- Cả legacy behavior được giữ theo policy rollout, schemas/RPC mapping đúng; không chỉ psql proposal.

Chạy theo scripts đúng baseline:

```sh
npm run lint -- --max-warnings=0
npm test
npm run build
npm run test:v2:db
npm run test:v2
```

Docker/Chromium hay dependency thiếu thì xử lý setup cục bộ theo scope, báo Not run nếu chưa được; không ghi full PASS từ test proposal. Không chạy production migration/enrollment/PC thật trong R1.

## 5. Bàn giao và dừng

Commit cục bộ theo R1A/R1B/R1C khi meaningful checks đạt; không push source app hoặc merge canonical trong gói này. Tài liệu/report sanitized có thể publish qua nhánh docs/PR theo github-sync. Không đưa ảnh/weights/credentials vào repo công khai.

`docs/reports/claude/recovery-r1-report.md` gồm receipt, baseline/finalSHA/commits, files/diff, migration order/compatibility/rollback, updated protocol revision và checkpoint recovery policy, test commands/log/exit và invocation counts, fixed/partial/notrun, remaining bugs. Chạy xong chuyển Ready for review, chưa Done sản phẩm.

Dừng tại R1 để Codex retest; chưa mở cache/image/privacy/two-owner scheduler/animation. Gói R2 sẽ theo sau review: cache regenerate/version, PNG background và tiếp theo GPU-host serialization/privacy. PC vẫn giữ MSVC pause và tiếp tục phần local độc lập. Nếu cần đổi scope giải thích dependency cụ thể trong report, không im lặng mở rộng toàn bộ hệ thống.
