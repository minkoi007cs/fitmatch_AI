# Claude continuation — APP-RECOVERY-32

Tiếp tục cùng phiên/checkout APP-CLOSE-30, giữ toàn bộ sáu commit tới499ead01e7f9274ddf310ab346fda4c2464588bd. Codex đã nhận bundle và push hộ nhánh codex/app-close-30-claude-20261109 lên GitHub, đã xác minh remote; không làm lại hai finding cũ, không mở app mới.

## Onboarding và receipt

Fetch codex/project-operations mới nhất, đọc agent.md → roadmap.md → process.md đầy đủ, rồi docs/reports/review/app-close-30-review-20261109.md. Đối chiếu actual HEAD/dirty/ownership, giữ descendant hợp lệ. Ghi receipt APP-RECOVERY-32/session/source/docs SHA/file scope trước sửa. Tạo nhánh codex/ riêng từ499ead0 hoặc descendant đã reconcile, giữ checkout hiện tại; không reset/stash/clean. Không claim việc PC đang làm. Khi thiếu quyền push, tiếp tục công việc và giao bundle incremental + hashes/report; không dừng ở lỗi403, không xin token vào chat.

## Mục tiêu gần nhất

Biến hướng dẫn backup/restore còn mơ hồ thành một quy trình đã diễn tập local, đủ để Codex thực hiện backup riêng tư và review trước cloud cutover. Gói hiện tại chỉ có synthetic migration proof, CHƯA có backup/restore thật. Không tự đánh dấu cloud-ready sau bài local.

1. Đọc README canonical-cutover §2–3, report APP-CLOSE-30 §7 và tài liệu Supabase chính thức về backup/restore bằng CLI. Xác minh CLI3.0.0 --help thực tế. Sửa runbook quanh roles đã tồn tại, schema/data auth/storage được include/exclude và binary Storage không nằm trong SQL. Không khuyên bỏ ON_ERROR_STOP toàn cục hoặc bỏ qua mọi lỗi role; xác định xung đột dự kiến và xử lý phạm vi hẹp, còn lỗi khác phải dừng. Không giả raw dump hash phải giống sau migration: so sánh fingerprint dữ liệu nghiệp vụ/các cột giữ nguyên, tách user mới do smoke test.
2. Viết một rehearsal script nhỏ trong scripts/migration-cutover/ và tests liên quan nếu cần. Chỉ tự tạo nguồn/đích local disposable, synthetic data gồm auth.users, fm_users/wardrobe/outfits/identity/refresh và private storage metadata + vài object byte tổng hợp. Dùng official PG17 image khi môi trường có; nếu dùng stand-in ghi rõ. Không có cloud URL/keys/model/photo thật. Chạy dump → restore → inventory → runner dry-run → execute local → kiểm dữ liệu/owner/private assets → signup/outfit save/reopen. Database chỉ chứa stub thì ghi rõ không phải full Supabase Auth/Storage stack.
3. Đưa bằng chứng identity mapping/owner FK/nullable wardrobe/style_category/is_saved/refresh được giữ; object bytes hashes và count trước/sau restore độc lập SQL metadata. Mất/truncated backup, thiếu Storage bytes, sai target, restore SQL lỗi phải bị phát hiện trước cutover; chọn vài fault cases có ý nghĩa, không tạo framework lớn.
4. Chuẩn bị checklist thực thi sau review: exact source/runner/SQL/manifest hashes, đầu vào bí mật nhập riêng ở máy điều phối, backup private directory, điều kiện dừng/rollback/partial failure và người giữ bước. Nếu chưa có đúng pooler host từ Dashboard thì để allowlist rỗng; tuyệt đối không đoán. Dùng kết quả native PC mới nếu đã publish, không gọi9skip là56PASS.

## Phạm vi và phối hợp

Own: docs/infrastructure/canonical-cutover/README.md và tài liệu phục hồi liên quan; script rehearsal/verification local trong scripts/migration-cutover/; tests tương ứng và docs/reports/claude/app-recovery-32/. Không sửa SQL lịch sử, worker.py, PC adapters/coordinator, model env, UI không liên quan. Nếu tìm lỗi runner trực tiếp chặn rehearsal thì đưa repro/patch/test trong scope; giữ target guard và bytes SQL/plan/manifest trừ khi có lý do rõ và cập nhật hash.

Hai PC đang nhận AI-NATIVE-COMPOSE-31 và PC-CPU-FACE-31, CPU-only. PC còn cần chạy exact test-only f591d96 sau checkpoint hiện tại. Không tự tạo policy/lock/slot, không chạy Qwen/model/render GPU; luôn một GPU task, shared OS byte0 lock, finite slot và owned-tree drain. MSVC/UAC pause giữ nguyên.

Chưa cho phép cloud SQL, backup từ cloud/đọc private user rows, history repair, production deploy, merge main, worker enrollment hoặc bật Qwen flag trong gói này. Không tạo paid service/chat/subagent. Khi cần quyền/metadata ngoài môi trường, ghi đúng blocker và tiếp tục phần local độc lập; không xin gửi secret trong chat.

## Bàn giao

Commit/package từng mốc có ý nghĩa. Report baseline/final SHA, exact file scope, CLI/PG/client versions và substitution, commands/exit/assertions/logs, data/storage invariants, fault-case evidence, phần chưa chạy và runbook đã sửa. Chạy tests phù hợp cùng rehearsal; không lặp toàn bộ UI suite không đổi chỉ để tăng số kiểm thử. Ghi process delta (không đè process cũ). Giao Codex review; local rehearsal không thay private canonical backup/restore proof. Gần hết usage phải lưu bundle/checkpoint trước dừng.
