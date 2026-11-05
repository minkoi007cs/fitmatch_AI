# Lệnh giao owner Mac — sửa recovery trước khi nối PC

Tiếp tục nhánh `codex/3d-studio-worker` từ actual HEAD (review baseline d2a9898); không dựng lại V2. Bạn là owner hiện hữu. Claude mới vẫn review-only cho tới handoff có revision/file scope. Đọc AGENTS/agent/roadmap/process của nhánh tài liệu `codex/project-operations`, report Claude và `docs/reports/review/claude-review-20261105/review.md` trước sửa. Đọc Next docs đúng worktree trước code Next và Supabase docs/changelog trước sửa DB; tạo migration additive bằng workflow CLI thực tế, không sửa live DB/production.

Ưu tiên đợt đầu FIX-MAC-01/02/03: complete/finalize/claim replay, worker crash recovery, revision failure và server capability allowlist. Đừng áp nguyên SQL proposal. Codex đã xác nhận repro14/14 và proposal11/11 nhưng proposal thiếu recovery qua restart, cache reader updates và RPC integration. Mỗi sửa phải có test hành vi đúng và exit status fail thực sự; các test repro đang xác nhận bug phải chuyển assertion.

Yêu cầu cốt lõi: khi output đã tồn tại và complete outcome chưa rõ, retry/reconcile cùng kết quả, không fail hoặc tự chạy model lại. Persistent receipt/checkpoint bảo toàn qua process restart, lease/cancel/revoke theo server authoritative. Claim reply mất không tăng attempt/rerun mù; instance/request identity và locking có kiểm tra race. Mismatch engine trả lỗi rõ; OOM/timeout map đúng contract được PC xác nhận, không tự đoán exit code adapter đang dùng.

Tiếp FIX-MAC-04 cache regeneration có revision/concurrency/quota; FIX-MAC-06 alpha normalization; FIX-MAC-07 privacy deletion/tombstone/GC dry-run. FIX-MAC-05 là gate trước hai user chung GPU: một scheduler/khóa theo host GPU ngay trước claim, không chỉ workDir, giữ owner-scoped tokens và strip token env khỏi adapter. Đọc đầy đủ acceptance trong review report. Tách commit/gói, ghi rõ phần nào còn chặn live và phần nào chưa làm.

Chạy lint, unit, build, test:v2:db, test:v2 của actual revision đã sửa; thêm tests lost reply trước/sau commit, restart và upload interruption, wrong owner/asset/token, canceled/revoked, generation race, capability grant và hai process. Không dùng mock làm bằng chứng PC/GPU thật. Kiểm RPC qua route thực tế, không chỉ psql proposal.

Không sửa/reset checkout source đang dirty, không tự chiếm worktree khác. Không push app, merge/deploy, migrate production, enrollment token thật hay yêu cầu PC chạy live trước gate. Local model inference trên PC vẫn tiếp tục độc lập, MSVC/UAC giữ tạm dừng theo yêu cầu cuối.

Bàn giao `docs/reports/claude/mac-recovery-fixes-report.md` hoặc report owner có tên tương đương: task/session/baseline/finalSHA, diff/commits, migration rollout/compatibility, protocol revision, tests logs/exit, fixed/partial/notrun, remaining blockers và hướng dẫn chuyển worker. Publish report an toàn qua nhánh tài liệu/PR theo github-sync; không token/ảnh/weights. Codex sẽ review và retest. Nếu cần giao Claude implementation, owner ghi rõ revision, file scope và phần đang giữ trước chuyển.
