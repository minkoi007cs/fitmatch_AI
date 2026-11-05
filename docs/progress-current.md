# FitMatch AI — tiến độ kiểm tra và sửa lỗi

Ngày: 04/11/2026, America/New_York. Nhánh sửa: `codex/fix-audit-followup`.

## Kết luận hiện tại

Ứng dụng đã có MVP được deploy với đăng nhập, wardrobe, quiz và outfit/archive. Kiểm tra public production hiện tại đạt; vẫn chưa đủ bằng chứng nghiệm thu toàn bộ luồng có đăng nhập và AI thật. Bản sửa trong nhánh này đã có code và kiểm thử cục bộ; chưa push, merge hoặc deploy. Không coi các sửa đổi này là đã có trên website đang chạy.

Không đưa ra phần trăm hoàn thành chung vì chưa có danh sách yêu cầu sản phẩm và bằng chứng end-to-end đầy đủ để làm mẫu số.

## Tiến độ từ GitHub và máy ở nhà

- Kiểm tra trực tiếp remote tại thời điểm làm việc: `main`, `development`, `codex/fitmatch-audit-fixes-2026-11-04` cùng `ac263063ed760dd4455d628dd82bb99df0518317`. Nhánh `codex/app-system-auth` ở `c05551c68e5621d0e964d9b596f9b52185329408`.
- GitHub chưa có commit mới hơn baseline audit, không có PR mới trong kết quả truy vấn. Deployment Production gần nhất được trả về là `7563010836`, commit `ac26306`, tạo lúc 21:54:16 ngày 04/11 giờ New York; lần audit trước đã xác minh trạng thái success.
- Người dùng xác nhận công việc ở PC dùng Codex. Danh sách chat/project mà công cụ hiện trả về chỉ có host `local`; chưa có phiên PC ở nhà để đọc tiến độ đang chạy hoặc thay đổi chưa push. Không suy luận PC đã dừng chỉ vì GitHub chưa thay đổi.
- Chat liên quan “Audit Fitmatch AI hiện tại” trên máy local đang idle, thuộc công việc auth đã thực hiện trước đó. Đây không phải bằng chứng về trạng thái Codex trên PC hiện tại.
- `state/children_status.json` ở checkout gốc mang thời điểm tháng 9/2026; không dùng làm trạng thái live. Các file i18n chưa được track ở checkout gốc được giữ nguyên, chưa chứng minh tính năng dịch đã tích hợp vào ứng dụng deploy.

## Trạng thái chức năng

| Phần | Bản GitHub/production đang có | Bản sửa cục bộ |
| --- | --- | --- |
| Landing và login | HTTP 200; guest đến trang riêng được chuyển login | Giữ nguyên auth chính |
| Bảo vệ dữ liệu | Guest APIs 401; auth tests có binding/Origin/PKCE | Giữ các gate; thêm validation trước side effect |
| Wardrobe | Có CRUD/upload; PATCH có nguy cơ reset trường | PATCH giữ trường bỏ qua, giữ favorite; draft cũ không đóng draft mới |
| Quiz | Có lưu answers/profile; recommendation chỉ ở state | Lưu recommendation trong style_profile JSON hiện có; GET khôi phục; chặn hydrate ghi đè lựa chọn mới |
| Outfit | Có tạo, render và save | UUID phía server, source snapshot theo kết quả, ảnh/path theo batch và archive |
| Giao diện Outfits | Navbar che tiêu đề; URL vibe bị bỏ qua | Đã kiểm tra desktop/mobile: tiêu đề dưới navbar, vintage/sporty đúng |
| Archive | Chỉ thấy 20 record | Cursor ổn định, Load more, xác nhận xóa; thử đủ 45 record |
| Ảnh | MIME khai báo; response render chứa base64 | Decode/normalize upload, giới hạn bytes/pixel; render trả path/URL; retry URL không tạo AI lại |
| Chi phí AI | Chưa có quota trong source | Daily quota atomic trong PostgreSQL; còn thiếu dedupe/idempotency và giới hạn đồng thời riêng |
| CI | Chưa có workflow kiểm thử trong commit deploy | Đã thêm workflow application và database quota; chưa chạy trên GitHub |

## Trạng thái từng phát hiện audit

“Đã sửa” dưới đây chỉ có nghĩa trong nhánh cục bộ. Phần production chưa thay đổi.

| Mục | Trạng thái | Bằng chứng/giới hạn |
| --- | --- | --- |
| F01 quota AI | Một phần | Daily units atomic, 429/Retry-After, store lỗi trả 503 trước provider; test PG thật. Chưa có idempotency/per-user concurrency cap riêng |
| F02 nhánh auth cũ | Đã tránh đưa trở lại | Baseline Next 16.4.5; production dependency audit sạch. Nhánh lịch sử vẫn còn nguyên, không sửa/xóa |
| F03 validation/archive crash | Đã sửa cục bộ | Schema nested, giới hạn body, JSON 400, legacy archive/quiz an toàn; unit + HTTP |
| F04 PATCH mất metadata | Đã sửa cục bộ | HTTP kiểm tra rename-only giữ notes/material/favorite; unit explicit null/false |
| F05 profile rỗng xóa dữ liệu | Đã sửa cục bộ | Empty POST 400 không write; style-only giữ quiz; HTTP |
| F06 nhầm ảnh giữa batch | Đã triển khai | UUID không phụ thuộc id model; reset/khôi phục path+URL, bỏ render stale. Unit UUID; chưa E2E render AI thật |
| F07 nhầm nguồn outfit | Đã triển khai | Source snapshot lúc generate và restore archive; chưa E2E generate thật với thay selection giữa request |
| F08 xóa ảnh dùng chung | Một phần | DELETE wardrobe chỉ xóa row, giữ private object; HTTP xác nhận không gọi storage delete. Chưa có collector/refcount/GC |
| F09 navbar | Đã sửa và kiểm tra browser | Desktop 1280 và mobile 390×844: h1 top 128px, header bottom 67px; không overflow ngang |
| F10 vibe | Đã sửa và kiểm tra browser | URL vintage giữ qua login; sporty hiển thị đúng; request generation dùng state vibe |
| F11 quiz hydrate/persistence | Đã triển khai | Dirty guard + abort; recommendation gắn cùng JSON profile, GET nhiều lần không gọi quota/AI. Chưa E2E submit AI thật/reload |
| F12 ảnh base64/payload | Đã triển khai | Không trả base64 render; URL retry endpoint owner-scoped; upload ≤4MB sau nén, normalize ảnh. Chưa đo response AI thật trên Vercel |
| F13 archive | Đã sửa và kiểm tra | HTTP 45 rows cùng timestamp không lặp/mất; browser 20→40→45; DELETE giữ owner |
| F14 CI | Đã chuẩn bị | Workflow lint/unit/build/HTTP/audit + PostgreSQL concurrency. Chưa push/chạy GitHub; chưa đổi required checks/settings |

## P3: đã làm và còn lại

- Đã tách các request wardrobe/profile/archive để một phần lỗi không chặn dữ liệu phần khác; có thông báo lỗi/reload. Retry từng phần riêng vẫn có thể cải thiện thêm.
- Đã thêm draft guard khi lưu wardrobe, dirty guard khi hydrate quiz.
- Đã truyền các preference vóc dáng/lifestyle có sẵn từ quiz vào profile/prompt; không thu thập thêm trường mới. Không bảo đảm mọi món gợi ý đều nằm trong wardrobe hiện có.
- Đã decode và normalize ảnh upload bằng sharp; MIME giả/ảnh hỏng không đi tới quota/AI. Chuẩn hóa category/pattern AI về enum fallback. Không hứa hỗ trợ HEIC.
- Còn thiếu lifecycle/GC cho orphan; đang ưu tiên giữ ảnh tránh mất dữ liệu. Storage có thể tăng cho đến khi triển khai collector an toàn.
- Chưa thay đổi refresh recovery UX hoặc replay rotating tokens.
- Chưa thêm CSP/frame policy hoặc thay các testimonial/số liệu marketing tĩnh.
- Chưa xử lý 8 moderate trong dev-tool dependency chain; không dùng audit fix --force.

## Kiểm chứng

Kết quả chi tiết: `docs/fix-evidence/verification.txt`. Lệnh cuối gồm lint không warning, 18 unit tests, production build, HTTP contract/regression, PostgreSQL quota test và production-only dependency audit.

Kiểm tra PostgreSQL chạy trong container riêng, không mở port, không chạm database live. Hai role trình duyệt không được đọc/sửa usage hoặc execute RPC; service_role dùng BYPASSRLS như Supabase. Trong 20 client đồng thời với limit 10 có đúng 10 lần được cấp phép và số dư không vượt 10. Test cũng kiểm tra migration chạy lại không reset bộ đếm.

HTTP fixture dùng token/khóa giả, ép OPENAI_API_KEY rỗng. Đã kiểm tra auth, metadata/profile preservation, malformed input, quota denied/outage, ảnh hỏng, phân trang, hai danh tính giả lập không đọc/xóa chéo archive, preview ownership và refresh song song. Đây không thay thế hai tài khoản production thật.

Browser dùng local production build và backend giả lập: vintage qua callback, header desktop/mobile, sporty, archive 45 record. Bằng chứng:

- `docs/fix-evidence/outfits-desktop.png`
- `docs/fix-evidence/outfits-mobile.png`

Public production smoke mới nhất: `/`, `/login` 200; `/wardrobe`, `/outfits`, `/quiz` 303 với next; API wardrobe/outfits/profile 401 cho guest.

## Triển khai và bước nghiệm thu còn thiếu

1. Review nhánh cục bộ; quota migration phải chạy **trước** application mới: `supabase/migrations/20261104_ai_daily_quota.sql`. Chưa chạy trên production.
2. Cấu hình `FITMATCH_AI_DAILY_UNITS` nếu cần, mặc định 50 units/user/ngày UTC. Analyze/upload/generate text = 1; render ảnh = 5; quiz = 2 nếu classify+recommend, hoặc 1 nếu profile cung cấp sẵn. Đây là đơn vị kiểm soát lượt gọi, không phải hạn mức tiền chính xác. Provider failure/timeout vẫn tính units để tránh retry mơ hồ vượt quota. Quota store chưa có hoặc lỗi => 503; không fail-open.
3. Quota hiện chưa dedupe request hoặc chặn concurrency bằng lease. Retry có thể tiêu tốn thêm units và tiền trong giới hạn ngày; cần làm tiếp trước khi mở quy mô lớn.
4. Recommendation lưu trong cột JSON hiện có nên không cần thêm cột; hồ sơ cũ không có recommendation sẽ trả null. API render ảnh đã bỏ imageDataUrl; client trong nhánh này đã dùng signed URL + endpoint retry.
5. Rollback ứng dụng về baseline `ac26306` nếu cần; giữ bảng quota bổ sung, không xóa dữ liệu. Rollback sẽ mất cơ chế quota mới. Không rollback nguyên nhánh auth cũ chỉ để đổi auth.
6. Deploy preview đúng origin auth đã đăng ký, kiểm thử bằng hai tài khoản thật: login/reload/refresh/logout, upload/camera, CRUD, quiz/recommendation reload, generation/render/archive và quyền Storage/RLS.
7. Xác nhận quota live, kích thước response Vercel và chi phí OpenAI thật, rồi mới promote production theo quyết định của người dùng.

Chưa có bằng chứng đọc trực tiếp tiến trình hoặc code chưa push trên PC ở nhà. Cần PC kết nối lại với Codex hoặc có chat/branch được chia sẻ để bổ sung phần tiến độ đó.
