# Giao việc cho Claude — sửa lỗi FitMatch AI sau audit

## Mục tiêu

Thực hiện các sửa đổi bên dưới, tạo mã và migration có thể review, kèm kiểm thử chứng minh từng lỗi đã được xử lý. Đây là nhiệm vụ triển khai, không dừng ở việc đọc lại audit hoặc đề xuất kế hoạch.

Nguồn yêu cầu: `docs/audit-full-2026-11-04.md`. Bằng chứng và probe: `docs/audit-evidence-2026-11-04/`. Audit là snapshot ngày 04/11/2026; xác minh lại HEAD trước khi sửa, không giả định trạng thái hiện tại còn giống snapshot.

## Bắt đầu đúng baseline

1. Đọc `AGENTS.md`, `CLAUDE.md`, báo cáo audit và tài liệu liên quan trong `node_modules/next/dist/docs/` sau khi cài đúng dependency.
2. Kiểm tra status, worktree và remote branches; fetch rồi tạo nhánh/worktree riêng từ `origin/main` mới nhất. Baseline audit là `ac263063ed760dd4455d628dd82bb99df0518317`. Nếu remote đã có sửa mới, đối chiếu để tránh ghi đè hoặc làm lại.
3. Checkout gốc `/Users/khoihoang/Documents/fitmatch_AI` từng ở `1ef8f25`, có công việc chưa commit: `.agentui/`, `src/lib/i18n/`, `state/` và tài liệu audit mới. Giữ nguyên các phần đó. Báo cáo hiện ở checkout gốc có thể chưa nằm trên remote: đọc bằng đường dẫn tuyệt đối hoặc copy riêng các tài liệu cần thiết sang worktree mới.
4. Không dùng nhánh `codex/app-system-auth` cũ làm baseline. Không cần sửa cùng một lỗi trên cả ba nhánh đang có cùng SHA. Không xóa/force-push nhánh cũ.
5. Thực hiện code, test, migration và tài liệu cục bộ. Phạm vi giao việc này chưa bao gồm push có thể kích hoạt deploy, merge, deploy, thay đổi branch protection hay chạy migration/cleanup trên production. Chuẩn bị đầy đủ kết quả để review các bước đó.
6. Giữ auth gate, Origin checks, PKCE, binding hub/local user, RLS và private storage. Không đưa service key ra client, không tắt auth để làm test xanh. Không in/copy secret vào báo cáo hoặc fixture.

## Thứ tự thực hiện

Làm lần lượt các gói 1–6. Chốt một commit có nội dung rõ ràng cho mỗi gói khi kiểm tra liên quan đạt; tránh gom toàn bộ vào một commit lớn. Có thể chỉnh cấu trúc code khi cần, nhưng giữ thiết kế giao diện hiện tại và không mở rộng thành redesign.

### Gói 1 — Bảo toàn dữ liệu và validation (F03, F04, F05)

**Phạm vi:** các route wardrobe, outfits, profile, analyze-image, generate-outfit, generate-outfit-image, upload-item và schema/helper dùng chung.

- Validate JSON runtime trước side effect: kiểu, object lồng nhau, enum, độ dài chuỗi, số lượng phần tử, giá trị số và image path. Chọn một cách nhất quán; TypeScript assertion không phải validation.
- PATCH wardrobe chỉ cập nhật trường được gửi. Trường không gửi phải được giữ; null chỉ được phép trên trường nullable; isFavorite không gửi không được reset.
- Profile POST rỗng trả 400, không ghi DB. Cập nhật styleProfile riêng không xóa quizAnswers; cập nhật quiz giữ dữ liệu khác theo contract được ghi rõ.
- Archive từ chối items/accessories chứa null hoặc shape sai. Read path xử lý record legacy hỏng an toàn, không làm crash cả archive. Không âm thầm xóa dữ liệu live.
- Body JSON sai trả lỗi JSON 400 thống nhất; lỗi upstream/internal không lộ stack hoặc thông báo nội bộ.

**Nghiệm thu bắt buộc:**

- Seed item có notes/material/description/secondaryColor/pattern/favorite; PATCH chỉ name; mọi trường còn lại giữ nguyên. Test cả false và null chủ động.
- POST profile `{}` => 400 và số write bằng 0; styleProfile-only giữ quizAnswers.
- Archive `items:[null]` hoặc thiếu trường bắt buộc => 400 và số write bằng 0; record legacy hỏng không crash UI.
- favoriteColors dạng string, body null/array sai contract, JSON hỏng => 400; không gọi AI/storage/DB write.
- Guest, Origin sai và path ảnh thuộc người khác vẫn bị chặn.

### Gói 2 — Kiểm soát chi phí AI (F01; bảo toàn F02)

**Phạm vi:** mọi đường gọi AI, helper quota phía server, migration Supabase bổ sung, cấu hình và test.

- Quota phải dùng kho chung và reservation atomic theo user; không dùng Map trong process làm giới hạn duy nhất. Quy định giới hạn ngày và đồng thời theo loại tác vụ, cấu hình qua biến môi trường. Ghi rõ giá trị mặc định và cách thay đổi; không khẳng định request count tương đương ngân sách tiền tuyệt đối.
- Áp dụng trước khi gọi provider; với pipeline upload cần chặn trước khi tạo side effect tốn tài nguyên không cần thiết. Quiz gọi hai lần AI phải có cách tính rõ ràng.
- Dùng request/idempotency key ràng buộc user + loại tác vụ + payload hash. Chống request song song và replay gây gọi AI nhiều lần. UI retry cùng thao tác giữ key; thao tác mới có key mới.
- Định nghĩa reservation hết hạn, success/failure, timeout mơ hồ, cách xử lý request đang chạy. Không trả quota rồi tự retry mù khi provider có thể đã tính phí. Khi quota store lỗi, không bỏ qua giới hạn để tiếp tục gọi AI.
- Migration chỉ bổ sung, có RLS/grant đúng role; không cho browser sửa bộ đếm. Chuẩn bị hướng dẫn rollout migration trước application, kèm rollback ứng dụng phù hợp.
- Giữ baseline dependency đã vá; không downgrade Next hoặc chạy audit fix --force. Ghi rõ nhánh auth cũ chỉ là lịch sử, không dùng nguyên trạng làm rollback.

**Nghiệm thu bắt buộc:**

- Test với PostgreSQL cục bộ thật cho claim/reservation đồng thời và quyền DB; mock-only không đủ chứng minh atomicity/RLS của quota.
- N request vượt quota => chỉ số request được cấp phép gọi provider; phần còn lại 429 + thông tin retry thích hợp.
- Cùng idempotency key/payload không tạo thêm AI job; key cũ với payload khác bị từ chối; key giống nhau của hai user không lẫn kết quả.
- Quota store unavailable => lỗi có thể xử lý, số call provider bằng 0.
- `npm audit --omit=dev` không thêm cảnh báo; ghi riêng những cảnh báo dev còn lại.

### Gói 3 — Danh tính và trạng thái outfit (F06, F07, một phần F10)

**Phạm vi:** `src/app/outfits/page.tsx`, API generate/save, types và helper liên quan.

- Server cấp UUID cho outfit; không lấy id model sinh làm danh tính đáng tin cậy.
- Lưu snapshot nguồn và batch ngay khi bắt đầu generate. Save dùng nguồn của kết quả đó, không dùng selectedItemId hiện tại.
- Cô lập ảnh/path theo outfit/batch. Bỏ kết quả async cũ khi đã đổi batch; loading của từng render/save độc lập.
- Mở archive khôi phục đồng thời outfit, source_item_id, imagePath và imageUrl; không để generatedPaths của lượt trước ghi đè.
- Đọc và validate vibe từ URL; UI và request Generate cùng dùng style đã chọn. Hỗ trợ các style đã được landing công bố; giá trị lạ có fallback rõ ràng. Giữ next/vibe sau auth.

**Nghiệm thu bắt buộc:**

- Generate từ A, chọn B rồi Save => source vẫn A.
- Hai response model cố tình có cùng id => client vẫn nhận danh tính khác nhau, không dùng nhầm ảnh.
- Render A bị delay, chuyển batch B, response A về => không thay B.
- Render look mới rồi mở archive có id model cũ trùng => Save archive giữ đúng ảnh/path/source archive.
- `/outfits?vibe=vintage` hiển thị vintage và request gửi vintage; tương tự sporty, kể cả sau login.

### Gói 4 — Asset, ảnh và archive (F08, F12, F13; orphan/upload P3)

- Chọn và ghi rõ cách quản lý tham chiếu asset. Không xóa object nếu wardrobe/outfit khác còn tham chiếu; kiểm tra phải an toàn với concurrency hoặc chọn cơ chế dọn trễ có grace period và recheck.
- Chuẩn bị cleanup có retry, dry-run và thời gian giữ file tạm. Không chạy job xóa trên production trong nhiệm vụ này. Không dựa vào tuổi file đơn thuần để xóa asset còn được dùng.
- Generate image chỉ trả path/signed URL cùng metadata cần thiết, không trả base64 sau khi đã upload. Nếu ký URL thất bại, cho phép phục hồi URL mà không tạo ảnh/tính phí lại. Cập nhật client theo contract mới.
- Kiểm tra bytes/khả năng decode ảnh trước AI; giới hạn kích thước và số pixel hợp lý. Chuẩn hóa category/pattern AI về enum hoặc fallback để form/filter hoạt động.
- Phân biệt giới hạn ảnh nguồn trước nén với payload gửi server. Đảm bảo giới hạn thực tế phù hợp Vercel; thông báo hỗ trợ định dạng đúng khả năng ứng dụng. HEIC chưa hỗ trợ thì từ chối rõ ràng, không hứa hỗ trợ.
- Archive phân trang cursor ổn định theo created_at/id; thêm Load more và xóa trong UI. Delete phải kiểm tra owner và xử lý asset reference theo mô hình đã chọn.

**Nghiệm thu bắt buộc:**

- A/B dùng chung ảnh; xóa A => B và ảnh còn nguyên. Xóa tham chiếu cuối => asset được dọn theo chính sách, lỗi storage được theo dõi/retry.
- File giả MIME, ảnh hỏng, kích thước/pixel vượt mức => lỗi validation trước AI.
- Giả lập provider trả ảnh lớn: JSON response vẫn nhỏ và không có base64; ký URL lỗi rồi retry không gọi AI lần hai.
- Seed ít nhất 45 archive records, gồm trùng timestamp => đọc hết bằng Load more, không lặp/mất; user khác không đọc/xóa được.
- Job dry-run liệt kê file tạm hết hạn nhưng không chọn asset còn được tham chiếu.

### Gói 5 — UI, quiz và trạng thái mạng (F09, F11; P3 liên quan)

- Sửa offset navbar ở Outfits; không làm login/quiz bị padding kép. Xác nhận desktop 1280px và mobile 390×844: heading/nút không nằm dưới fixed header, không overflow ngang.
- Quiz hydrate không ghi đè lựa chọn đã sửa; hủy/bỏ response cũ khi rời trang. Loading/error/retry phải được hiển thị rõ.
- Lưu recommendations theo phiên bản profile bằng migration bổ sung; GET tải lại được sau reload, không gọi AI lại chỉ để xem kết quả đã có. Tương thích hồ sơ cũ chưa có recommendation; không bịa kết quả.
- Outfits tải wardrobe/profile/archive độc lập: một phần lỗi không làm mất dữ liệu thành công của phần khác.
- Submit wardrobe có draft/version guard hoặc khóa chuyển drawer hợp lý; response của draft cũ không được đóng draft mới. Giữ focus trap, Escape, focus restoration hiện có.
- Prompt cá nhân hóa sử dụng các preference liên quan mà sản phẩm thực sự có; hoặc chỉnh câu quảng bá cho đúng phạm vi. Không thêm thu thập dữ liệu cá nhân mới. Không khẳng định outfit dùng toàn đồ đã có nếu không ràng buộc vào wardrobe thực tế.
- Với refresh outcome không thể retry an toàn, hiển thị đường đăng nhập lại phù hợp; giữ sự phân biệt với outage tạm thời và không replay rotating token có thể đã dùng.
- Landing ghi rõ hình/kết quả minh họa khi không có số liệu thật; cập nhật Microsoft/App System, README và file env mẫu chỉ có tên/placeholder. Không bỏ nội dung đang có để che lỗi chức năng.

**Nghiệm thu bắt buộc:**

- E2E với profile load chậm rồi người dùng đổi lựa chọn: response về không ghi đè.
- Submit quiz thành công, reload => recommendation cũ xuất hiện, số call AI không tăng.
- Archive API lỗi trong khi wardrobe thành công => vẫn chọn được wardrobe và có trạng thái retry archive riêng.
- Save drawer A bị delay, đóng/mở B => response A không đóng B.
- Kiểm tra bàn phím drawer, heading/navbar, CTA và vibe bằng browser; lưu screenshot mobile/desktop của bản đã sửa. Phân biệt screenshot fixture với production.

### Gói 6 — CI và bàn giao (F14; tài liệu bảo mật/vận hành)

- Thêm GitHub Actions chạy install theo lockfile, lint, unit, build, HTTP contract và E2E các regression trọng yếu. Fixture không phụ thuộc secret/live provider; dọn process/port khi fail và đặt timeout.
- Nếu quota/asset migration cần PostgreSQL, CI có service database và test grants/concurrency tương ứng.
- Kiểm tra dependency scan và cập nhật dev dependency tương thích nếu khả thi; không ép nâng/hạ gây breaking change chỉ để số cảnh báo về 0.
- Đề xuất browser headers phù hợp; nếu thêm CSP phải test ảnh Unsplash/Supabase, fonts và auth. Không thêm policy làm hỏng app chỉ để có header.
- Chuẩn bị hướng dẫn bật required checks/branch rules/Dependabot theo cấu hình thực tế. Không tự đổi GitHub settings trong phạm vi này.
- Viết `docs/audit-remediation-status.md`: mỗi F01–F14 và từng P3 có trạng thái, commit/file, bằng chứng test và điều còn thiếu. Mục phụ thuộc production phải ghi rõ chưa xác minh, không đánh dấu Done chỉ vì viết checklist.

## Kiểm tra trước khi kết thúc

Chạy các lệnh sau trên kết quả cuối; E2E và DB integration test thêm theo scripts được tạo:

```sh
npm ci
npm run lint
npm test
npm run build
npm run test:http
npm audit --omit=dev
```

Đọc nội dung probe cũ trước khi dùng: một số assert trong `http-probes.mjs.txt` cố ý xác nhận hành vi lỗi, vì vậy sau khi sửa phải chuyển thành regression assert cho hành vi đúng. Không giữ test yêu cầu lỗi còn tồn tại để có kết quả PASS.

Thực hiện đối chiếu diff: không mất dữ liệu/cột/policy cũ, không chứa secret, không thay công việc chưa commit của người dùng. Nếu một phát hiện audit không còn tái hiện trên HEAD mới, ghi rõ bằng chứng thay vì sửa cho khớp báo cáo.

## Đầu ra Claude phải trả

1. Nhánh/worktree, baseline SHA, danh sách commit theo gói và tóm tắt thay đổi.
2. Bảng trạng thái F01–F14 và P3: Done / Partial / Blocked / Not applicable, kèm bằng chứng.
3. Kết quả thực tế của từng lệnh/test, screenshot UI và các giới hạn chưa kiểm tra. Không báo PASS nếu không chạy.
4. Migration SQL, thứ tự rollout, cấu hình quota, tác động tương thích API, cách rollback và dry-run cleanup.
5. Danh sách thao tác production còn cần thực hiện: migration, cấu hình, preview, hai tài khoản thật, AI thật, rồi mới promote. Chưa chạy không được ghi hoàn tất.

Nếu gặp blocker, tiếp tục phần độc lập và mô tả chính xác blocker cùng phần chuẩn bị đã hoàn thành. Không tự kết luận toàn bộ sản phẩm production đã ổn từ build hoặc fixture test.
