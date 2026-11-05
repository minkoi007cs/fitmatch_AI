# FitMatch AI — Audit toàn sản phẩm và toàn bộ nhánh GitHub

Ngày kiểm tra: 04/11/2026, múi giờ America/New_York. Repository: https://github.com/minkoi007cs/fitmatch_AI.

## Kết luận

Bản mới nhất build và vượt qua các kiểm thử hiện có, nhưng còn lỗi về mất dữ liệu khi cập nhật, validation, quản lý trạng thái outfit, giao diện và kiểm soát chi phí AI. Chưa đủ bằng chứng để xác nhận mọi luồng production đều đúng. Nhánh auth cũ chứa dependency có cảnh báo bảo mật nghiêm trọng; không nên dùng nguyên trạng để rollback.

Audit này chỉ thêm báo cáo và bằng chứng cục bộ. Không sửa mã ứng dụng, push, merge, deploy, đổi cấu hình GitHub hoặc ghi/xóa dữ liệu production. Các probe ghi dữ liệu chỉ chạy với hub/Supabase giả lập trên localhost; OPENAI_API_KEY bị đặt rỗng trong probe.

## Các nhánh và trạng thái triển khai

Đã lấy danh sách remote trực tiếp bằng `git ls-remote --heads origin`, fetch tất cả heads và đối chiếu SHA.

| Nhánh GitHub | Commit | Kết quả |
| --- | --- | --- |
| main | ac263063ed760dd4455d628dd82bb99df0518317 | Bản mới nhất; audit đầy đủ |
| development | ac263063ed760dd4455d628dd82bb99df0518317 | Cùng toàn bộ mã với main |
| codex/fitmatch-audit-fixes-2026-11-04 | ac263063ed760dd4455d628dd82bb99df0518317 | Cùng toàn bộ mã với main |
| codex/app-system-auth | c05551c68e5621d0e964d9b596f9b52185329408 | Chậm hơn đúng 1 commit; cài dependency và chạy kiểm thử riêng |

Checkout main ban đầu trên máy vẫn ở `1ef8f25`, cũ hơn GitHub. Giữ nguyên checkout, nhánh và các thư mục chưa được theo dõi `.agentui/`, `src/lib/i18n/`, `state/`.

GitHub deployment `7563010836` ghi Production commit `ac26306`, trạng thái success, lúc 21:54:16 ngày 04/11/2026 giờ New York. GitHub commit status Vercel cũng success. Tài liệu `docs/audit-2026-11-04.md` trong commit này vẫn ghi “Chưa triển khai”; thông tin đó đã lỗi thời so với deployment record.

## Phạm vi và kiểm chứng

Đọc source các API, auth/PKCE/cookie/refresh, Supabase schema và migration, OpenAI adapter, các trang landing/login/wardrobe/outfits/quiz, UI primitives liên quan và diff giữa hai commit duy nhất của bốn nhánh. Đã đọc tài liệu Next.js được cài kèm trước khi tạo probe.

| Kiểm tra | ac26306: 3 nhánh mới | c05551c: nhánh auth |
| --- | --- | --- |
| npm ci --ignore-scripts | PASS | PASS |
| npm test | 11/11 PASS | 11/11 PASS |
| npm run lint | PASS | PASS |
| npm run build | PASS, Next 16.4.5 | PASS, Next 16.2.1 |
| npm run test:http | PASS, gồm regression ảnh archive/quiz | PASS, bộ auth cũ |
| npm audit toàn bộ | 8 moderate | 22: 1 critical, 10 high, 10 moderate, 1 low |
| npm audit --omit=dev | 0 vulnerabilities | Không chạy riêng; xem JSON toàn bộ |

Kiểm tra production bằng HTTP không có phiên: `/`, `/login` trả 200; `/wardrobe`, `/outfits`, `/quiz` trả 303 sang login và giữ next; ba API dữ liệu trả 401/no-store; `/api/auth/session` trả 200/no-store. Trình duyệt xác nhận landing mobile và chuyển từ CTA sang login giữ `/outfits`.

Trên bản production build cục bộ với dữ liệu giả lập: đăng nhập qua giao diện fixture, mở Outfits/Wardrobe/Quiz, kiểm tra desktop 1280px và Outfits mobile 390×844. Quiz hydrate tuổi đã lưu; drawer nhận focus, Tab vào nút đóng, Escape trả focus về Add item. Đây không phải bằng chứng OAuth hoặc database production.

## Phát hiện ưu tiên

P1: cần xử lý sớm vì tác động bảo mật/chi phí. P2: lỗi chức năng hoặc dữ liệu cần sửa. P3: hoàn thiện vận hành/trải nghiệm. Nhãn “HTTP xác nhận” chỉ nói về ứng dụng thật chạy với backend giả lập; “đọc code” chưa được tái hiện với dữ liệu live.

### F01 — P1: Chưa có quota/rate limit bền vững cho AI

- **Vị trí:** `src/app/api/generate-outfit/route.ts:10–29`; `generate-outfit-image/route.ts:12–46`; `upload-item/route.ts:18–62`; `user/profile/route.ts:43–45`; `analyze-image/route.ts:29`.
- **Bằng chứng:** đọc code toàn bộ các entrypoint; authenticateRequest kiểm tra auth/Origin, không reserve ngân sách hoặc giới hạn tần suất trước OpenAI. Không có quota table hoặc limiter được tích hợp trong schema/routes. Việc SDK vendor có module rate-limiter không đồng nghĩa ứng dụng sử dụng nó.
- **Ảnh hưởng:** một tài khoản hợp lệ có thể tạo nhiều request đồng thời và tiêu tốn chi phí AI/storage. Không kết luận đã bị abuse hay đã có hóa đơn bất thường; chưa kiểm tra các giới hạn bên ngoài repo.
- **Sửa:** quota theo user/ngày bằng giao dịch atomic trong kho chung; giới hạn đồng thời, input/output và idempotency cho request tốn phí. Kiểm thử 429 trước khi gọi provider.

### F02 — P1, chỉ nhánh auth cũ: Dependency có cảnh báo critical/high

- **Vị trí:** `package.json` và `package-lock.json` ở `c05551c`.
- **Bằng chứng:** npm audit hiện tại báo 22 affected packages, gồm Next critical cùng các dependency high. Next ở nhánh cũ là 16.2.1; main đã lên 16.4.5 và production dependencies audit sạch.
- **Ảnh hưởng:** deploy/rollback nguyên nhánh cũ đưa lại dependency bị cảnh báo và các lỗi sản phẩm đã sửa. Mức critical là phân loại package từ registry, không phải chứng minh ứng dụng hiện đang bị khai thác; từng advisory có điều kiện áp dụng riêng.
- **Sửa:** đánh dấu nhánh lịch sử; nếu cần rollback auth thì áp dụng thay đổi nhỏ trên baseline dependency đã vá. Không dùng `npm audit fix --force` để tự downgrade Next ESLint.
- **Bằng chứng máy đọc:** [npm-audit-auth-branch.json](audit-evidence-2026-11-04/npm-audit-auth-branch.json).

### F03 — P2: Archive nhận dữ liệu sai và có thể làm Outfits crash

- **Vị trí:** `src/app/api/outfits/route.ts:43`; `src/app/outfits/page.tsx:549–551,666`.
- **HTTP xác nhận:** `{data:[{name:"Malformed look",items:[null],accessories:[null]}]}` trả 200, sau đó GET trả lại nguyên các phần tử null. Thiếu cả id/style/confidence vẫn được nhận.
- **Ảnh hưởng:** chọn Open saved look sẽ dereference `item.suggestedColor` từ null; dữ liệu sai còn nằm trong archive. Wardrobe/profile/AI routes cũng thiếu schema runtime: favoriteColors dạng string trả 500 kèm `favoriteColors.join is not a function`; PATCH JSON hỏng trả 500 không có JSON lỗi thống nhất.
- **Sửa:** validate đầy đủ cả object lồng nhau, enum, độ dài, số lượng và JSON parse; 400 cho input sai. Sanitize hoặc bỏ record legacy hỏng khi đọc. Không chỉ ép kiểu TypeScript.

### F04 — P2: PATCH đổi tên xóa metadata và trạng thái favorite

- **Vị trí:** `src/app/api/wardrobe/[id]/route.ts:25–35`.
- **HTTP xác nhận:** PATCH `{name:"Rename only"}` gửi sang Supabase `secondary_color/pattern/material/description/notes = null` và `is_favorite=false`.
- **Ảnh hưởng:** cập nhật một trường làm mất các trường không gửi. Form hiện tại không có isFavorite trong draft nên sửa món đã favorite cũng reset cờ đó.
- **Sửa:** chỉ thêm trường thực sự có trong body vào updatePayload; phân biệt bỏ qua với chủ động null.

### F05 — P2: POST profile rỗng xóa hồ sơ đã lưu

- **Vị trí:** `src/app/api/user/profile/route.ts:43–55`.
- **HTTP xác nhận:** POST `{}` trả 200 và upsert cả `style_profile:null`, `quiz_answers:null`. Chỉ gửi styleProfile cũng xóa quizAnswers.
- **Ảnh hưởng:** request thiếu dữ liệu trở thành thao tác reset ngoài ý muốn; profile sai shape còn có thể làm Outfit/Quiz lỗi ở lần đọc tiếp theo.
- **Sửa:** từ chối body rỗng, validate schema, giữ các trường không được cập nhật; reset phải là thao tác rõ ràng.

### F06 — P2: Ảnh outfit có thể bị dùng nhầm giữa các lượt tạo hoặc archive

- **Vị trí:** `src/app/outfits/page.tsx:55–56,174,191,228–232,666`; `src/lib/openai.ts:103` (id do model trả).
- **Bằng chứng đọc code:** generatedImages/generatedPaths được giữ qua lượt generate và đánh chỉ mục bằng id model sinh, không có namespace lượt tạo. Open saved look thay generatedImages nhưng không thay generatedPaths; Save lại ưu tiên đường dẫn trong map hơn imagePath của archive.
- **Tái hiện theo trạng thái:** render look id X ở lượt A; lượt B hoặc record archive cũng có X nhưng ảnh khác; Save B chọn đường dẫn A còn trong map.
- **Sửa:** server cấp UUID riêng, reset/namespace cache theo batch; khi mở archive khôi phục đồng thời ảnh/path/source. Bỏ phản hồi render của batch đã rời.

### F07 — P2: Lưu outfit gắn nhầm món nguồn đang chọn

- **Vị trí:** `src/app/outfits/page.tsx:150–174,190,330–333,666`.
- **Bằng chứng đọc code:** tạo từ món A, chọn B trước khi Save; kết quả A vẫn hiển thị nhưng `sourceItemId` là B. Mở archive cũng không khôi phục source_item_id, rồi Save dùng selection hiện tại.
- **Ảnh hưởng:** dữ liệu liên kết nguồn sai; phía API chỉ chứng minh B thuộc user, không chứng minh B tạo ra outfit.
- **Sửa:** lưu snapshot sourceItemId cùng batch/outfit; Save dùng snapshot này. Việc chọn nguồn mới cần làm rõ kết quả đang thuộc nguồn nào.

### F08 — P2: Xóa món đồ có thể xóa ảnh vẫn được tham chiếu

- **Vị trí:** `src/app/api/wardrobe/[id]/route.ts:70–83`; `src/app/api/wardrobe/route.ts:69–86`.
- **Bằng chứng đọc code:** API cho nhiều món cùng user dùng một imagePath; không có unique constraint/refcount. DELETE xóa object ngay sau xóa một row, không kiểm tra các row hoặc outfit khác.
- **Ảnh hưởng:** tạo A/B dùng chung path hợp lệ rồi xóa A sẽ làm ảnh B mất; lỗi remove cũng bị bỏ qua nên có thể trả success trong khi vẫn còn file.
- **Sửa:** mô hình asset/reference, chỉ dọn khi hết tham chiếu, job cleanup có retry. Tách file tạm khỏi file đã được gắn vào dữ liệu lâu dài.

### F09 — P2: Navbar che tiêu đề và thao tác đầu trang Outfits

- **Vị trí:** `src/app/outfits/page.tsx:250–266`; `src/components/layout/Navbar.tsx:81–86`; `src/app/layout.tsx:54–55`.
- **Trình duyệt xác nhận:** desktop 1280px và mobile 390px đều có h1 top = 48px, navbar bottom = 67px. Screenshot cho thấy phần đầu tiêu đề nằm dưới navbar; desktop còn che phần nút trên cùng.
- **Sửa:** dành khoảng trống cho fixed header ở layout của trang nội bộ; kiểm tra cả cuộn và breakpoint. Quiz và login đã có khoảng đệm riêng, nên tránh thêm padding kép cho chúng.

### F10 — P2: Chọn style từ landing không được áp dụng

- **Vị trí:** `src/app/page.tsx:397`; `src/app/outfits/page.tsx:35,57,150–165,241–247`.
- **Trình duyệt xác nhận:** `/outfits?vibe=vintage` vẫn hiện CASUAL. Trang không đọc searchParams; Generate thường truyền undefined. Cycle chỉ có 4 style, bỏ sporty/vintage dù landing giới thiệu chúng.
- **Sửa:** parse/validate vibe từ URL, dùng vào state và request mặc định; hỗ trợ các style được công bố. Test cả đi thẳng URL và quay về sau auth.

### F11 — P2: Quiz tải chậm có thể ghi đè lựa chọn người dùng; kết quả không tồn tại sau reload

- **Vị trí:** `src/app/quiz/page.tsx:150,163–176,198`; `src/app/api/user/profile/route.ts:47–65`; `supabase/schema.sql:30–38`.
- **Bằng chứng đọc code:** form tương tác ngay, response hydrate luôn setAnswers mà không kiểm tra dirty/version; request không hủy khi rời trang. Recommendations chỉ ở React state và response POST, không được lưu hoặc trả trong GET.
- **Ảnh hưởng:** lựa chọn mới có thể bị response cũ ghi đè. Reload sau nhận kết quả trở lại quiz; muốn xem lại recommendation phải gọi AI lần nữa.
- **Sửa:** chặn form trong giai đoạn hydrate hoặc chỉ hydrate khi chưa chỉnh; abort/version request. Lưu recommendation theo profile version và tải lại khi đọc hồ sơ.

### F12 — P2: API trả ảnh base64 dù đã upload; có rủi ro vượt payload Vercel

- **Vị trí:** `src/app/api/generate-outfit-image/route.ts:77–81`; `src/app/api/upload-item/route.ts:37–40`.
- **Bằng chứng:** route luôn trả imageDataUrl nguyên vẹn; nếu ký URL lỗi còn lặp base64 trong signedUrl. Upload server quảng bá 10MB nhưng request đi qua Vercel Function.
- **Ảnh hưởng có điều kiện:** PNG lớn sau base64 có thể vượt giới hạn response; ảnh đã tạo và upload nhưng client nhận lỗi. Upload trực tiếp 4.5–10MB có thể bị platform chặn trước handler. UI hiện có compress nên không kết luận mọi ảnh nguồn 10MB đều fail.
- **Nguồn chính thức:** [Vercel Function limits](https://vercel.com/docs/functions/limitations#request-body-size) quy định tối đa 4.5MB cho request hoặc response.
- **Sửa:** chỉ trả storagePath/signedUrl; xử lý lỗi ký URL bằng retry hoặc trạng thái lỗi riêng. Căn chỉnh giới hạn multipart thực tế hoặc upload trực tiếp với quyền giới hạn. Chưa gọi AI thật để đo kích thước ảnh thực tế.

### F13 — P2: Archive cắt ở 20 record và không có đường xem phần còn lại

- **Vị trí:** `src/app/api/outfits/route.ts:19`; `src/app/outfits/page.tsx:640–681`.
- **Bằng chứng đọc code:** limit(20), không cursor/offset/load-more; UI cũng không có xóa dù API DELETE tồn tại.
- **Ảnh hưởng:** từ record thứ 21, các look cũ biến mất khỏi giao diện dù còn trong database. Người dùng không tự quản lý archive để truy cập lại.
- **Sửa:** phân trang theo created_at/id; hiển thị load-more và thao tác xóa có xác nhận phù hợp.

### F14 — P2: Thiếu cổng kiểm tra trước merge/deploy

- **Bằng chứng GitHub:** cả 4 branches protected=false; không có `.github` workflow trong commit; không có PR trong kết quả lịch sử trả về; Actions run list rỗng. Commit mới có Vercel status và check “Vercel Preview Comments”, không có check lint/unit/HTTP.
- **Ảnh hưởng:** build xanh vẫn bỏ lọt lỗi dữ liệu và UI đã tái hiện trong audit. Chưa kiểm tra account/organization rulesets, nên không khẳng định không tồn tại mọi loại kiểm soát bên ngoài repo.
- **Sửa:** workflow lint/unit/build/HTTP với fixture và vài E2E nghiệp vụ; required checks cho main/development, review trước promote production. Tự động dependency alerts/update phù hợp: Dependabot security updates đang disabled; secret scanning và push protection đang enabled.

## Các điểm P3 và hạn chế vận hành

- **Outfits tải dữ liệu tất cả hoặc không có gì:** useEffect dùng Promise.all rồi mới set ba state (`outfits/page.tsx:76–88`). Một endpoint profile/archive lỗi sẽ ngăn cả wardrobe thành công hiển thị. Nên có loading/error/retry riêng từng phần.
- **Race khi lưu drawer:** upload có version guard nhưng submit không có (`wardrobe/page.tsx:225–250`). Đóng drawer đang lưu rồi mở draft khác; response cũ vẫn closeDrawer làm đóng draft mới. Cần guard theo draft hoặc khóa chuyển drawer khi submit.
- **Chất lượng cá nhân hóa:** generateOutfitSuggestions chỉ đưa primary/secondary style, màu và inspirations vào prompt; age/gender/body/height/lifestyle/fit priorities không được truyền trực tiếp (`openai.ts:299–302`). Các món wardrobe khác cũng không được truyền. Không đủ cơ sở cho lời quảng bá mọi gợi ý tận dụng đồ đã có trong tủ hoặc được điều chỉnh chính xác theo vóc dáng/lifestyle.
- **Upload chưa decode/magic-byte verify:** MIME do client khai báo; frontend nhận mọi image/* và có thông báo HEIC trong utils nhưng đường compress dựa hoàn toàn vào browser Image. Chưa xác minh HEIC trên Safari/iOS, camera thật hoặc file ảnh hỏng. Schema AI cũng cho type/pattern string tự do trong khi form/filter dùng enum.
- **Orphan:** bỏ drawer sau upload thành công, thay ảnh và render ảnh không Save vẫn giữ file/uploaded rows; chưa thấy retention/GC. Không xóa chúng trong audit.
- **Refresh bị lỗi mơ hồ cần đăng nhập lại:** refresh coordinator lưu cả `{pair:null}` để tránh replay token có thể đã bị xoay; proxy sau expiry chỉ 503/“retry”. Đây là tradeoff bảo mật đã ghi tài liệu, nhưng UX không cho biết retry có thể không phục hồi. Cần phân biệt outcome và đường reauthenticate; không tự retry token đã có khả năng bị tiêu thụ.
- **Header/browser hardening:** production responses đã kiểm tra không có CSP, X-Frame-Options, Referrer-Policy chung; auth callback mới có no-referrer/no-store. Chưa thấy khai thác XSS/clickjacking; nên có frame-ancestors/referrer policy phù hợp và đánh giá CSP theo nhu cầu thực tế.
- **Landing/docs:** “Looks generated today”, “Most-saved”, confidence và testimonial là literal tĩnh trong source. Không thấy chứng cứ analytics hoặc xác thực lời chứng thực; cần ghi rõ minh họa nếu là demo. CTA còn nói Microsoft trong khi auth chính là App System. README trỏ `.env.local.example` nhưng file mẫu không được track; hướng dẫn setup gốc chưa bao quát hết auth mới.
- **8 moderate dev dependencies:** main vẫn còn chuỗi typescript-eslint/minimatch. Không nằm trong kết quả production-only audit. Chi tiết ở [npm-audit-main.json](audit-evidence-2026-11-04/npm-audit-main.json).

## Những gì đã làm đúng

- Auth gate có trong các business routes; Origin check cho mutation; PKCE S256/state có chữ ký; safeNext chặn redirect ra ngoài; ràng buộc subject hub và local user; không tự merge email.
- Wardrobe/outfits query dùng client của user, user_id filter và schema khai báo RLS theo owner. Storage private và signed URL. Chưa có phát hiện đọc chéo user trong scope mock/source đã kiểm tra.
- Refresh coordinator có claim bền vững và encrypted result giữa instance; test 10 requests cùng refresh chỉ xoay một lần.
- Main đã sửa upload race, quizAnswers contract, lưu imagePath archive, phản hồi lỗi upload, timeout OpenAI và khả năng dùng bàn phím drawer.
- Không có file `.env*` được track ở HEAD; truy vấn lịch sử các tên env phổ biến không thấy commit. Đây không phải secret scan toàn lịch sử mọi file và mọi định dạng.

## Thứ tự xử lý

1. Quota AI và đảm bảo không deploy/rollback nhánh dependency cũ.
2. Validate payload, bảo toàn PATCH/profile, đảm bảo dữ liệu archive không crash UI.
3. Cố định identity/source/path của từng outfit; quản lý reference trước khi xóa ảnh.
4. Sửa navbar/vibe, quiz hydrate/persistence, phân trang và response ảnh.
5. CI và E2E chống regression; kiểm chứng production bằng hai tài khoản thật với RLS/Storage/AI.

## Giới hạn và cách tái chạy

Chưa đăng nhập OAuth thật trong audit này; chưa gọi OpenAI thật; chưa đọc schema/RLS/Storage đang triển khai trực tiếp, log/quota/billing của Vercel/OpenAI hay thử hai tài khoản production. Không suy luận các kiểm tra này từ báo cáo cũ. Public production smoke và deployment record không chứng minh mọi business flow.

Hai detached worktree dùng để kiểm tra:

- `/tmp/fitmatch-audit-20261104` — ac26306.
- `/tmp/fitmatch-audit-auth-20261104` — c05551c.

Chạy `npm ci --ignore-scripts`, `npm test`, `npm run lint`, `npm run build`, rồi `npm run test:http` trong checkout đúng commit. HTTP suite dùng ports 3220/3221 và backend giả lập. Probe bổ sung được lưu dưới dạng văn bản tại [http-probes.mjs.txt](audit-evidence-2026-11-04/http-probes.mjs.txt): copy thành `scripts/audit-probes.mjs` trong checkout audit và chạy `node --import tsx scripts/audit-probes.mjs`. Không đặt AUDIT_KEEP_SERVER nếu chỉ cần kiểm thử; script dùng khóa giả, ép OPENAI_API_KEY rỗng và không tải `.env.local` từ checkout chính.

File JSON audit và probe không chứa token/key thật. Các số dòng trong báo cáo tham chiếu commit ac26306 trừ khi ghi rõ nhánh cũ; checkout main ban đầu trên máy có số dòng/nội dung khác.
