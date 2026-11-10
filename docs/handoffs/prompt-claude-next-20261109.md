# Claude mới - APP-CLOSE-30

Bạn tiếp quản app/SQL/tests của FitMatch AI theo yêu cầu chủ dự án, sau bàn giao Claude cũ. Hãy thực hiện việc, không chỉ đề xuất kế hoạch. Giữ toàn bộ code đã có. Codex ở chat điều phối tiếp tục review độc lập; hai PC giữ engine/coordinator và Qwen adapter riêng.

## Đọc và lấy đúng checkpoint

Repo https://github.com/minkoi007cs/fitmatch_AI. Lấy nhánh codex/project-operations mới nhất, đọc đầy đủ AGENTS.md → agent.md → roadmap.md → process.md. Đọc docs/reports/review/progress-claude-pc-20261109.md, docs/reports/review/claude-checkpoint-847aeea.md và tài liệu sản phẩm trong roadmap. Prompt này cập nhật nhiệm vụ của H-RESUME-29: không dùng trạng thái UI interrupted hoặc thiếu PC policy cũ làm hiện trạng.

Code: nhánh **codex/canonical-migration-26**, HEAD **0c4c44ea518453b823af50b2b5b0f4f8b0b65878**, implementation **cf902d3**; 847aeea là checkpoint trước lần test UI chạy lại. Kiểm remote/dirty/owner thực tế trước làm, giữ descendant mới nếu có. PR15 là PR tài liệu vào operations, không phải code app. Không dùng preview PR15 để nghiệm thu source app.

Đọc từ code branch: docs/reports/claude/migration/report.md và logs/test-v2-http-run1.log, test-v2-http-run2.log; docs/infrastructure/canonical-cutover/{README.md,cutover-plan.json,real-qwen-smoke.md}; scripts/migration-cutover/apply.mjs; scripts/worker/test_worker_unit.py và compatibility migration20261109093355. Tạo worktree/nhánh riêng từ0c4c44e hoặc descendant đã reconcile. Không reset/stash/clean main hoặc Studio gốc, không merge mù nhánh docs vào code.

Ghi receipt **APP-CLOSE-30**, role app owner, session, machine, source/docs SHA, file scope và test plan trước sửa. APP-CLOSE-30 tiếp nối APP-RESUME-29, không chạy hai owner app song song. Nếu AI mới khác đã nhận APP-RESUME-29, reconcile receipt trước sửa chung file; không đoán claim đã hết hạn.

## Hiện trạng đã biết

Auth/outfit và migration package đã triển khai. Codex trước đó chạy độc lập76unitPASS, kiểm12SQL/manifest hashes. Claude báo build/lint/PG17legacy/DB/HTTP/Python PASS, có log. test:v2 run1 timeout chờ AIproposal15s, run2 trên cùng implementation đã **PASS toàn bộ**, exit0; không root-cause lần timeout. Chưa có cloud apply/deploy/backuprestore/native-fullgate hoặc realQwen. Đừng bắt đầu bằng việc viết lại UI hoặc gọi mọi kết quả là independent PASS.

Hai PC đã làm native CPU và xác minh cùng policy; chat3D báo18case, chatAI báo70adaptertests+4nativecase. Cả hai bị giới hạn usage trước khi publish đầy đủ. Suite worker gốc46PASS/9skip/1fixtureERROR. Scoped binding ACK không phải slot GPU.

## Hai việc triển khai ưu tiên

1. **R-MIGTARGET-29:** runner hosted target check đang cho phép host bất kỳ nếu username mang hậu tố .gohczmqykjkrgdblgbog. Codex đã tái hiện offline bằng DATABASE_URL `postgresql://postgres.gohczmqykjkrgdblgbog@example.invalid/postgres` và fake psql không nối mạng: runner gọi fake rồi exit3, thay vì từ chối trước subprocess với exit2. File hiện chưa đổi (sha b7273a39152cc573b24a6ce21089b02ff97207704454a5ce91194a4a841067a2). Siết scheme/host canonical direct hoặc pooler được xác minh VÀ username đúng project; không dùng suffix username làm chứng cứ host. Không thêm bypass. Kiểm docs chính thức/cấu hình thực khi cần; không đọc/in secrets. Thêm regression offline chứng minh target sai không gọi psql, target đúng đi tới fake như dự kiến, giữ isolated loopback-only.

2. **NATIVE-FIXTURE-30:** test_copied_coordination_with_identical_policy_refused_while_canonical_held đang copytree sau khi giữ lock, nên Windows từ chối đọc byte đã lock trước assertion. Sửa TEST fixture bằng cách tạo bản copy trước acquire; vẫn giữ canonical lock trong toàn bộ phép kiểm admission refusal và split-lock-free. Không bỏ assertion, không thay guard/worker production chỉ để test xanh. PC có proposal test-only, xem đường dẫn trong report progress. Code owner sửa scripts/worker/test_worker_unit.py và gửi patch/commit rõ cho PC; không sửa PC repo. Chạy Python suite local; PC sẽ chạy lại native khi tiếp tục được, ghi số skip và lý do thật.

## Sau sửa

Scope chính: scripts/migration-cutover/apply.mjs, unit/regression runner liên quan, scripts/worker/test_worker_unit.py, docs/tests/cutover plan liên quan nếu cần. Giữ recovery, cleanup claim, byte0 lock binding và auth/outfit fixes. Không sửa11migration cũ; nếu sửa SQL compatibility chưa áp hoặc manifest/plan thì cập nhật hash/test/report. Đọc Next docs trước mọi sửa Next code; chỉ mở rộng UI scope nếu có repro mới.

Chạy tests phù hợp thay đổi: runner offline negatives, Python suite, npm test/lint và PG17 legacy cutover test. Broaden build/DB/HTTP/browser khi code thay đổi hoặc có nghi vấn chưa giải quyết; không lặp fullsuite không đổi chỉ vì báo cáo cũ có timeout. Nếu UI timeout tái hiện thì giữ trace/network/state, so sánh baseline cùng môi trường và sửa đúng nguyên nhân, không tăng timeout đại trà/tắt test. Báo chính xác môi trường và exit/count/skip.

Review exact migration pre/postconditions, history adoption/rerun/refusal, backup/restore commands của CLI thực tế. Chuẩn bị report/cutover evidence để Codex review; scope này chưa cho phép thực thi cloud. Legacy FK tới fm_users, nullability, style_category/is_saved và dữ liệu hiện có phải giữ nguyên. Hai schema legacy/fresh đều phải chạy. Không thay RLS của27bảng ứng dụng khác.

## Hướng sản phẩm và gate tích hợp

Bản đầu: avatar cá nhân giống mặt, áo thun+jeans từ wardrobe riêng mỗi người, chọn slot độc lập/save-reopen không infer lại, Qwen phân tích ảnh phải để người dùng xác nhận. Không mở animation/category/provider trả phí hay viết lại app. Canonical duy nhất fitmatch-ai/gohczmqykjkrgdblgbog; smoke bỏ dùng. OAuth của Codex không tự sang môi trường bạn; cần metadata thì gửi query chỉ đọc, không xin key vào chat.

Không SQL cloud/migration repair/main merge/production deploy/bật Qwenflag/cấp worker/GPU trong task này. Còn cần private backup+restore PG17, exact SQL review, reviewed HTTPS revision và scoped token. Chuẩn bị kết quả cụ thể rồi Codex/chủ dự án quyết định bước thực thi riêng.

Giữ policy PC hiện có SHA789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039, guard47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c, worker LFshaef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6. Không tạo lại policy/lock. Một OSlock byte0, finite slot pc-ai do3D cấp, worker soleowner/no nesting/owned-tree drain. Qwen không chạy GPU cùng render3D; MSVC/UAC vẫn pause.

Commit/push nhánh review riêng, report baseline/finalSHA/diff/repro/fix/logs/hash/limitations và process delta. Bàn giao patch fixture rõ choPC; gửi Codex review, không tự nghiệm thu code mình. Không tự tạo agent/chat mới. Gần hết usage phải save/push checkpoint và report việc đang dở trước dừng.
