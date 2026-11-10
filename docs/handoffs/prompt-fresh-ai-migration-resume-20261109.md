# Prompt đầy đủ cho AI mới - H-RESUME-29

> **H-RESUME-30 cập nhật:** dùng [prompt Claude hiện hành](./prompt-claude-next-20261109.md). App đã lên0c4c44e (code vẫncf902d3); test:v2 run2 có logPASS, haiPC đã báo scoped policyACK nhưng suiteWindows còn lỗi fixture. R-MIGTARGET-29 vẫn chưa sửa. Nội dung H-RESUME-29 bên dưới giữ bối cảnh; baseline/ưu tiên mới trong H-RESUME-30 thay các dòng cũ tương ứng.

Bạn là AI mới tiếp quản phần app/SQL/test của FitMatch AI từ Claude đã dừng theo yêu cầu chủ dự án vì giới hạn usage. Không cần lịch sử chat để bắt đầu: dùng các nguồn và thứ tự dưới đây. Nhiệm vụ là tiếp tục công việc, kiểm chứng và sửa lỗi có bằng chứng; không viết lại app hay chạy lại toàn bộ model. Model của bạn không quyết định vai trò: bạn là owner triển khai app trong phạm vi bàn giao này, Codex ở chat điều phối giữ review độc lập.

## 1. Lấy đúng hai nguồn và ghi receipt trước khi sửa

Repository: https://github.com/minkoi007cs/fitmatch_AI

- Bộ điều hành: nhánh **codex/project-operations mới nhất**. Đọc đầy đủ theo thứ tự AGENTS.md, agent.md, roadmap.md, process.md. Các entry cũ giữ lịch sử; dùng checkpoint mới nhất để xác định việc đang làm.
- Code app: **codex/canonical-migration-26**, checkpoint **847aeea27d1fa5970231c3445ac89a3c5c61a809**; implementation **cf902d3**, baseline trước gói này **f80749a**. Kiểm remote có mới hơn không; nếu có thì đối chiếu và giữ work mới, không reset về SHA cũ.
- PR https://github.com/minkoi007cs/fitmatch_AI/pull/15 là **PR tài liệu** vào operations, không chứa code app. Đừng dùng HEAD5d08c98 hoặc preview tự động của PR đó để test app mới.

Đọc tiếp từ CODE APP: docs/reports/claude/migration/report.md và logs, docs/infrastructure/canonical-cutover/README.md, cutover-plan.json, real-qwen-smoke.md; migration mới 20261109093355_legacy_compat_auth_outfits.sql; scripts/migration-cutover/apply.mjs; scripts/test-legacy-compat-db.mjs. Đọc từ OPERATIONS: docs/reports/review/claude-checkpoint-847aeea.md, docs/handoffs/pc-migration-prep-20261109.md và product requirements trong roadmap.

Tạo checkout/worktree riêng từ code847aeea hoặc descendant đã đối chiếu, nhánh codex/canonical-migration-26-resume (nếu đã tồn tại thì kiểm owner rồi chọn tên riêng). Có thể clone repo sang thư mục mới nếu các checkout sẵn có đang bẩn. Không checkout/reset/stash/clean main ở thư mục /Users/khoihoang/Documents/fitmatch_AI; không đụng worktree Studio gốc fitmatch_AI-3d-studio tại d2a9898. Hai nhánh docs/app là hai nguồn khác nhau: không merge mù bộ docs vào source.

Ghi receipt session/task **APP-RESUME-29**, machine/branch/HEAD/docs revision, scope file và cách kiểm chứng trước sửa. Dùng quy trình process delta/session report nếu không có quyền sửa process chính; Codex nhập delta. Việc Claude dừng và chủ dự án giao tiếp là handoff rõ, không phải tự chiếm một task đang chạy. Không tạo thêm agent/chat hoặc nhắn người khác khi chưa được chủ dự án giao.

## 2. Sản phẩm và những gì đã có - không làm lại

Website cho chủ dự án và giáo viên, wardrobe riêng từng tài khoản; PC ở nhà RTX3060 12GB làm worker outbound HTTPS. Bản đầu trọn luồng avatar cá nhân + áo thun + jeans, top/bottom chọn riêng, lưu/mở lại không infer lại. Avatar ưu tiên mặt giống người thật; màu/logo/form đồ phải đúng. Upload điện thoại/desktop, xử lý nền và chỉ autoapply nếu người dùng còn chọn món đó. AI gợi ý từ đồ đã có theo quiz/dịp; không thêm mua sắm hay animation trước gate tĩnh.

R1/recovery, fitting generations, full-look slots, privacy cleanup claim, Qwen durable jobs/confirm/quota và policy khóa GPU đã có. Giữ tất cả. Qwen phân tích ảnh/JSON không phải engine tạo mesh. Fixture hay CPU mock không phải avatar cá nhân hoặc model thật.

Gói Claude vừa lưu có sửa auth trigger sang fm_users; route outfit gửi style_category/is_saved; comparator xét schema cũ/quyền mặc định cloud; runner dry-run mặc định; fixture legacy/fresh PG17; tài liệu recovery/cutover. Code này chưa được cloud apply hay production deploy.

## 3. Làm ngay hai việc còn mở

**A - Chốt kiểm thử UI đang dang dở.** `npm run test:v2` thất bại một lần tại scripts/test-qwen-http.mjs:183: chờ “Đề xuất của AI” 15 giây. Lượt chạy lại bị dừng giữa chừng. Chưa chứng minh đó là flake hay regression. Chạy đúng branch, giữ log/trace/screenshot/network/DB state liên quan; nếu fail, chạy cùng môi trường trên f80749a trong checkout riêng để phân biệt. Điều tra polling/selection/state/fixture khi có bằng chứng. Không tăng timeout đại trà, tắt assertion hay gắn nhãn PASS để né lỗi. Nếu lỗi là harness/môi trường thì sửa đúng chỗ và chứng minh app behavior.

**B - Sửa finding R-MIGTARGET-29 trước mọi hosted execute.** Runner hiện chấp nhận host bất kỳ nếu username kết thúc bằng .gohczmqykjkrgdblgbog. Codex đã chứng minh bằng DATABASE_URL giả `postgresql://postgres.gohczmqykjkrgdblgbog@example.invalid/postgres` và fake psql: fake vẫn bị gọi, exit3; đúng ra phải từ chối đích trước gọi psql, exit2. Không có kết nối mạng/secret trong repro. Siết scheme PostgreSQL, endpoint direct canonical hoặc pooler Supabase được xác minh cùng username project chính xác; URL sai host/ref/user phải bị chặn trước subprocess. Giữ test isolated chỉ loopback. Xem cấu hình/docs chính thức để xác định endpoint hợp lệ; không thêm bypass. Viết regression offline kiểm marker/fake psql không được gọi khi target sai.

Codex đã chạy độc lập npm test trên847aeea: **76/76 PASS**, và kiểm **12 hash SQL + manifest hash** khớp. Các kết quả build/lint/PG17 legacy/test:v2:db/test:http còn là báo cáo Claude; full browser vẫn NOT VERIFIED. Không coi 76 unit hoặc Vercel preview là full review PASS.

## 4. Phạm vi được sửa và kiểm chứng

Bạn được tiếp quản các file app/SQL/tests trong receipt CL-MIGRATION-20261109-01: outfit route/validation, schema inventory/comparator/manifest, cutover runner/plan/docs, legacy compatibility migration chưa apply và DB/HTTP/browser tests. Được sửa UI/polling liên quan nếu tái hiện được lỗi, ghi scope bổ sung trước khi sửa. Đọc hướng dẫn Next.js thích hợp trong node_modules/next/dist/docs trước sửa Next code; dùng lockfile/dependency hiện có. Dùng môi trường riêng, không lấy .env/secret của checkout khác hoặc in key ra log.

Không sửa 11 migration lịch sử. Nếu phải sửa migration compatibility mới chưa apply hoặc SQL plan, cập nhật hash/manifest/test/report tương ứng và nói rõ. Không sửa PC adapter/guard, không viết worker/protocol thứ hai, không bỏ cleanup claim hay fencing. Nếu cần đổi contract transport do repro PC, gửi proposal và chờ ACK hai bên.

Sau sửa, chạy kiểm tra đúng phạm vi: unit/lint/build, test:legacy-compat (PG17), test:v2:db và test:v2; test:http khi đường auth/outfit bị ảnh hưởng. Ghi actual command, env, revision, exit/số case và các skip. Với checkout dùng symlink node_modules bên ngoài, Turbopack có thể lỗi workspace-root; ưu tiên môi trường dependency đúng checkout, phân biệt lỗi toolchain và regression; không đổi dependency chỉ để né lỗi. Không chạy nhiều build/test tranh tài nguyên hoặc cùng server/port. Chỉ lặp khi có thay đổi/lỗi cần xác minh.

Đọc và review thêm exact SQL/history adoption/rerun/refusal/rollback. Bảo toàn hồ sơ, wardrobe, identities/refresh, owner FKs tới fm_users, nullability và private buckets. Chạy test từ baseline legacy thật sự tương ứng, không chỉ schema.sql sạch. Giữ 27 bảng của ứng dụng khác ngoài scope; không sửa RLS của chúng để phục vụ demo.

## 5. Cloud và hai PC - điều kiện tiếp nối

Canonical duy nhất: **fitmatch-ai / gohczmqykjkrgdblgbog**, URL https://gohczmqykjkrgdblgbog.supabase.co. Smoke-supabase đã ngừng dùng. Connector của Codex điều phối đã truy cập được, nhưng môi trường của bạn không tự kế thừa OAuth/credentials. Nếu cần metadata hãy chuẩn bị query chỉ đọc để Codex chạy; không xin dán service-role/password vào chat.

Lần kiểm read-only khi bàn giao: cloud vẫn có0 bảng fm_v2 và auth handler còn target cũ. Sửa trong branch không có nghĩa cloud đã sửa. Backup/schema catalog không giống nhau: còn thiếu backup dữ liệu/storage riêng tư và chứng minh restore PG17. Chuẩn bị đầy đủ gói/commands cụ thể, nhưng **chưa được áp SQL cloud, migration repair, merge main, deploy production hay mở Qwen flag**. Trình Codex review exact SHA/SQL và recovery proof trước bước thực thi riêng với chủ dự án. Không dùng preview trỏ mainDB làm môi trường phá hủy.

PC3D sở hữu engine/render/coordinator policy; PCAI sở hữu Qwen runtime/adapter. Hai chat PC sẵn có: 3d model01a1aa1b-fb39-7ab2-9ca0-1b5e637c9fae, AI model01a1aef0-d86e-7410-86f3-3f785f861e38; host remote-control:env_e_6ae016d7e638832f8c618e42731928c8. Trạng thái cuối: gửi PCAI thành công nhưng chưa xác minh thực thi; 3D lỗi steer, snapshots unavailable. Không suy GPU rảnh hoặc chạy thử để dò.

Native Windows ACK còn thiếu. Worker847aeea kế thừa binding f80749a; PC3D pin existing canonical gpu0.lock bằng policy/hash/file identity, finite pc-ai slot. Worker là chủ lock duy nhất, adapter không lock lồng; chỉ nhả sau toàn bộ owned process tree thoát. Qwen và render3D **không chạy GPU cùng lúc**. Không thay lock/kill process bên kia, giữ MSVC/UAC pause. Chưa cấp GPU job từ handoff này.

## 6. Kết thúc bằng bàn giao có bằng chứng

Chủ động làm phần được giao tới khi có kết quả review được, không chỉ trả lại kế hoạch. Commit/push nhánh review riêng theo scope; không main/production. Lưu report gồm baseline/finalSHA, diff, R-MIGTARGET-29 repro/fix, kết quả UI trước/sau và baseline comparison nếu cần, migration/manifest hashes, tests, blocker và bước kế tiếp. Tách rõ code/unit/local PG, hosted Auth/Storage và model thật. Gửi process delta cho Codex. Không tự tuyên bố independent review PASS cho code mình vừa sửa.

Nếu gần hết usage, commit checkpoint sớm, lưu log/report/chỗ đang dở và push trước khi dừng. Không để AI sau phải đoán một lệnh test đang chạy hay artifact nằm ở đâu. Bạn chưa có quyền tạo chat mới hoặc deploy chỉ vì test xanh.
