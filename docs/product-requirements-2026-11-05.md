# FitMatch — yêu cầu đã chốt sau phỏng vấn từng câu

Ngày05/11/2026. SPEC-01 / CX-PRODUCT-20261105-08. Nguồn: câu trả lời trực tiếp của chủ dự án trong chat điều phối, không phải suy đoán từ proposal kỹ thuật. Ưu tiên hơn scope cũ trong các snapshot/handoff. Đây là yêu cầu sản phẩm và tiêu chí thử nghiệm, **chưa phải lời xác nhận pipeline hiện có đáp ứng được**.

## 1. Các câu trả lời được giữ đầy đủ

| ID | Chủ đề | Người dùng chốt |
|---|---|---|
| U01 | Ưu tiên | D→A→B→C: trải nghiệm trọn luồng → avatar giống/chân thực → đúng quần áo → tư vấn phối đồ. Trọn luồng không có nghĩa bỏ tiêu chí likeness. |
| U02 | Đầu vào avatar | Chấp nhận quay video quanh người, chụp thêm mặt và nhập số đo nếu giúp giống/chân thực hơn. Không giới hạn vài ảnh vì tiện. |
| U03 | Thời gian avatar | Càng nhanh càng tốt; mong muốn không quá khoảng15–30phút, cân nhắc tùy chất lượng. Đây là target cần benchmark; chưa chốt queue wait hay thời gian upload có tính vào đó. |
| U04 | Tự động hóa | App tự tạo rồi người dùng chỉnh vài thông số đơn giản; ưu tiên tự động nhiều nhất, không dùng chỉnh tay hậu trường làm luồng mặc định. |
| U05 | Chỉnh avatar | Cả mặt/dáng/tóc/da, ưu tiên khuôn mặt→dáng người→tóc/màu da. Cần giống chính người dùng. |
| U06 | Cách chỉnh | Thanh kéo/lựa chọn trực quan kết hợp nhập yêu cầu bằng lời; dễ dùng, ưu tiên chỉnh mặt. Chưa chốt cụ thể slider/editor nào có thể realtime. |
| U07 | Chất lượng trang phục | Đúng màu/logo/họa tiết/cổ/tay/form; chấp nhận nếp vải chưa hoàn toàn chính xác. Không yêu cầu chứng nhận size/chật/rộng. |
| U08 | Capture áo | Hai ảnh trước/sau, trải phẳng nền trơn; chưa yêu cầu thêm ảnh chi tiết hoặc số đo áo trong luồng cơ bản. Khả năng giữ logo/form từ hai ảnh phải được thử thật. |
| U09 | Full look | Có áo **và quần của chính người dùng**. Giày dùng mẫu sẵn trước. Không dùng quần mẫu thay yêu cầu jeans cá nhân của bản đầu. |
| U10 | Category và trình tự | Quần ưu tiên jeans→quần vải/tây→short. Chấp nhận first release trọn luồng với **áo thun + jeans**, rồi sơ mi/quần tây/short. Không bắt đủ mọi category từ đầu. |
| U11 | Wardrobe | Giữ wardrobe hiện tại làm trung tâm; chụp/upload đồ vào tủ, xử lý nền và lưu bản sẵn mặc trên avatar để chọn lại nhanh. Không gọi AI dựng lại mỗi lần click. |
| U12 | Pending item | Tiếp tục thêm đồ/phối đồ khác; khi xong tự hiện **chỉ nếu người dùng vẫn đang chọn món đó**, không ghi đè selection mới. |
| U13 | Áo/quần và save | Chọn áo/quần riêng, đổi món nào giữ món kia; phối xong lưu cả bộ và mở lại nhanh. |
| U14 | Trang phục ban đầu | Avatar ban đầu mặc áo/quần mẫu đơn giản; preset ghi nhãn, không giả là wardrobe item người dùng sở hữu. |
| U15 | Camera | Mặc định phía trước, tự kéo orbit/zoom; có nút bật/tắt camera tự xoay chậm. Người đứng yên trong bản đầu. |
| U16 | AI inventory | Chỉ chọn áo/quần thật trong wardrobe tài khoản, chưa mua sắm hoặc đồ tưởng tượng. |
| U17 | AI personalization | Nhớ gu từ quiz, điều chỉnh theo dịp chọn mỗi lần. |
| U18 | AI presentation | Ba bộ phối, giải thích ngắn; click bộ nào mặc bộ đó. Chưa ready thì status/prepare rõ, không invent asset hoặc đổi version sai. |
| U19 | Deadline | Càng sớm càng tốt, chưa ngày cụ thể; ưu tiên đủ luồng thun+jeans trước thay mở category hàng loạt. |
| U20 | Remote access | Website dùng từ bất kỳ đâu; PC tại nhà xử lý AI phía sau. |
| U21 | Capture devices | Thêm/chụp đồ trực tiếp trên điện thoại hoặc upload từ máy tính; đồng bộ để phối trên desktop. Chưa yêu cầu toàn bộ Studio3D có trải nghiệm tương đương desktop trên mobile. |
| U22 | Tài khoản | Mỗi người wardrobe riêng; không tự dùng chung dữ liệu. Avatar theo tài khoản là thiết kế tiếp tục, user chưa yêu cầu chia sẻ wardrobe/cộng tác. |
| U23 | Retention source | Khi tạo avatar xong cho chọn giữ/xóa ảnh/video; nếu giữ có thể xóa sau. Không âm thầm xóa asset avatar/looks còn dùng khi xóa nguồn. Default retention trước khi chọn và failed jobs cần chính sách triển khai rõ. |
| U24 | Avatar draft | Nếu sau khoảng15–30phút đã có bản dựng mà mặt chưa giống: cho xem nháp, người dùng quyết định dùng tạm hoặc bổ sung ảnh/tạo lại. Draft không phải likeness PASS. |
| U25 | Chi phí | Xem kết quả PC và chi phí thực tế trước mới quyết dùng dịch vụ trả phí. Chưa cấp ngân sách hoặc quyền gửi ảnh lên provider mới. |
| U26 | Lookbook | Bản đầu render từ avatar đang mặc đúng bộ, chọn góc máy/nền. Generative AI thêm cảnh chỉ sau khi giữ đúng người/đồ/màu/logo. Không dùng pipeline text-to-image cũ để tự thay quần áo. |
| U27 | UI | Giao Codex chọn đẹp/dễ dùng; ưu tiên avatar chân thực và màu đồ đúng, thao tác phối đơn giản. Không mặc định bắt buộc giữ nền cam/tối cũ. |

U08 xác nhận rõ cho áo; capture jeans đề xuất dùng front/back tương tự, nhưng cách trải quần/hướng dẫn cụ thể cần kiểm ảnh mẫu. Không tự bắt nhập số đo quần hay video mặc đồ khi user chưa chốt. Những giới hạn ảnh/định dạng/video duration và danh sách số đo avatar cần spike/capture design, chưa được hỏi để chốt chi tiết.

Các quyết định trước phỏng vấn vẫn giữ: hai người pilot, RTX3060 12GB/RAM16GB theo PC report; đứng yên/camera orbit trước, idle người+vải sau khi ổn định; MSVC/UAC pause chưa được gỡ.

## 2. Hành trình bản đầu

```text
Đăng nhập / tài khoản riêng
  ├─ Thêm đồ bằng điện thoại/desktop → wardrobe → xử lý garment canonical nền
  └─ Tạo avatar: video/ảnh mặt/số đo → xử lý → xem draft → chỉnh hoặc tạo lại
Avatar sẵn sàng + garment sẵn sàng → chuẩn bị fitting cho version avatar hiện hành
Studio mặc preset → chọn áo thun + jeans cá nhân → orbit/zoom/auto-orbit
  ├─ Lưu bộ → mở lại đúng version/selection, không inference lại
  ├─ Chọn dịp + gu quiz → 3 bộ từ wardrobe → chọn bộ để mặc
  └─ Render lookbook đúng avatar/bộ → chọn góc máy/nền → lưu ảnh
```

Cho làm hai nhánh onboarding theo thứ tự tùy ý. Garment chưa có avatar vẫn xử lý phần độc lập, không giả fitting ready. PC offline: ready asset vẫn xem, job mới chờ rõ. Lỗi stage không xóa nguồn hay kết quả phiên bản cũ đang dùng.

## 3. Những thay đổi cần thiết trong kiến trúc sản phẩm

- **Slots:** torso/top và bottoms độc lập; source item IDs/version rõ. Một fitted jeans cá nhân cùng áo thun là tiêu chí full-look, không chỉ avatar+áo. Giữ chung scale/origin/pose; kiểm xuyên body và giao nhau áo/quần, không cần mô phỏng fit vật lý chính xác.
- **Chuẩn bị trước:** canonical garment + prepared fitting theo avatar version/material/pose/engine. Không tạo mọi tổ hợp áo×quần theo Cartesian product mặc định; ưu tiên per-item fit, kiểm phối hợp và chỉ thêm combo preparation nếu spike chứng minh cần. Tránh phát sinh hàng nghìn job cho wardrobe nhỏ.
- **Selection:** response phải ràng buộc owner/avatarVersion/itemVersion/slot/selection intent; late completion không mặc nhầm hoặc reset slot còn lại. Click outfit AI thay đúng cả hai slot dưới một selection snapshot.
- **Avatar versioning:** chỉnh mặt/dáng có thể cần dựng lại mesh hoặc fitting; editor phải nói rõ preview/processing/ready. Giữ phiên bản đang dùng tới khi bản mới QA được. Không hứa mọi slider hay lệnh chữ realtime hoặc giữ mọi fitting khi body đổi.
- **Appearance:** face likeness là workstream riêng; SMPL-X/body-fitting hay SiTH clothed demo không tự thỏa. Video capture không được gọi là multi-view fusion nếu engine thực tế dùng một frame. Phải nêu frame/góc ảnh nào dùng và phần suy đoán.
- **Inputs:** upload video/ảnh riêng tư có giới hạn và kiểm decode, không nhét video vào JSON request Next. Chuẩn hóa ảnh phải giữ màu/logo và alpha policy. Chưa khóa storage/provider/format mới trong gói yêu cầu này.
- **Editor:** tách tham số edit thật (mesh/head/body/material/hair) khỏi prompt cosmetic. Lệnh chữ tạo edit intent hợp lệ rồi preview/confirm, không chỉ text trả lời. Capability nào chưa có phải ghi thiếu, không giả slider ảnh hưởng mặt khi chỉ đổi scale camera.
- **Privacy:** chọn xóa nguồn phải hủy job phụ thuộc/tombstone, chặn late completion hồi sinh nguồn đã xóa. Derived avatar/looks còn được giữ theo lựa chọn; giải thích khi xóa ảnh sẽ không thể reconstruct từ nguồn đó. Retention/job files PC cũng phải có policy.
- **Recommendations:** ràng buộc owner/wardrobe snapshot/top+jeans/category availability; đủ item cho3bộ thì hiển thị3, thiếu thì nói rõ và trả số bộ khả dụng thay invent/mượn đồ. Gu quiz + occasion là input, feedback rule-v1 không tự thành model học.
- **Lookbook:** render chính scene/state đã lưu và asset versions, cho nền/góc không làm đổi màu/logo. Vì không generate hình học mới nên phù hợp mục tiêu giữ đồ; không gọi đó là đã giải quyết photoreal likeness của avatar.

## 4. Đánh giá có đang đúng hướng không

| Hạng mục hiện tại | Đánh giá / hành động |
|---|---|
| Wardrobe, quiz/preference và owned-item recommendation | Giữ; chuyển recommendation từ tops-only sang top+jeans sau khi pipeline bottoms được chứng minh |
| Private assets, queue, version/cache, recovery, scoped worker | Giữ; phục vụ upload nền/remote/access/reuse. Không tiếp tục mở hạ tầng lớn trước quality spike |
| Studio orbit/zoom, saved looks, fixture adapter | Giữ và mở slot quần. Fixture chỉ chứng minh UI/transport, chưa nghiệm thu người/quần áo |
| Shirt-only vertical slice | Được dùng như spike kỹ thuật, **không đủ** first-release theo yêu cầu mới |
| SiTH từ ảnh demo, body fitting thành công | Dữ liệu học khả thi; chưa chứng minh video/face likeness/editor/thời gian15–30phút hoặc clean body thay đồ |
| Editor mặt+dáng+tóc/da, sliders+lời | Gap lớn chưa có bằng chứng. Cần spike một avatar cá nhân và các edit có tác dụng thật trước xây UI hàng loạt |
| Jeans reconstruction/texture/fitting | Gap mới bắt buộc; không tự đưa vào category áo hoặc giả mesh áo thành quần |
| Text-to-image lookbook cũ | Tạm tách khỏi first-release path; thay bằng render3D đúng outfit. Không xóa tính năng/lịch sử cũ âm thầm |
| Animation/cloth live, Qwen-image/cloud provider mới | Hoãn; người dùng chưa cần trong first release và chưa duyệt chi phí |

Nhận định: hướng nền tảng phù hợp, nhưng roadmap cũ thiếu scope jeans/face editor/capture và đi sâu reliability hơn quality evidence. **Không kết luận đã đúng đầy đủ chỉ từ test worker**, cần quality/latency spike làm cổng quyết định engine và scope triển khai. Video nhiều góc chỉ là đầu vào được chấp nhận, không đảm bảo có engine tự động đáp ứng. Target15–30phút chưa có benchmark trên PC cho full pipeline.

## 5. Các cổng tiếp theo sau R1 / PC-CONF

| Gói | Đầu ra cần chứng minh | Gate |
|---|---|---|
| SPEC-01 | Roadmap và luồng UX thống nhất với27quyết định | Tài liệu complete, không product PASS |
| DISC-AV-01 | Capture video/ảnh mặt/số đo, một avatar cá nhân; dùng frame thật, đo end-to-end và stage time/VRAM/RAM | Người dùng nhìn draft/likeness; đối chiếu15–30phút, báo fail/partial nếu vượt |
| DISC-EDIT-01 | Edit mặt ưu tiên, dáng/tóc/da; một thanh kéo và một lệnh chữ cho edit thật, version/preview/undo cơ bản | So trước/sau và nhận dạng; không giả chỉ camera/texture filter |
| DISC-DENIM-01 | Jeans cá nhân từ bộ ảnh phù hợp, material/texture/logo/form, fit cùng áo thun và body riêng | 360° QA, không xuyên rõ, giữ slot và trục/scale |
| APP-FLOW-01 | Onboarding tùy thứ tự, upload mobile/desktop, garment background, selected-only autoapply, privacy choices | Critical E2E với thật một top+jeans, ready/failed/offline/version states |
| APP-AI-01 | Quiz+occasion→owned full-look options có giải thích, save/reopen | Item/version/owner đúng, không inference lại khi xem |
| APP-RENDER-01 | Screenshot/render scene đúng avatar/outfit/version, nền/góc | So outfit state và ảnh, không đổi logo/màu/hình học do generator |
| PILOT-01 | Hai account riêng, remote website + PC, full first-release journey | Quality approval + reliability+latency thực, chưa animation |

Các gói DISC đang Planned, không tự khởi động mới từ file này. PC-CONF-01/R1 đã giao vẫn tiếp tục trong scope, MSVC pause còn hiệu lực. Sửa/review code không tự cấp quyền cloud/UAC/deploy/production migration. Nếu chất lượng/thời gian/VRAM không đạt, trình bày output+chi phí cụ thể cho người dùng quyết định trước đổi engine hay dùng paid API.

## 6. UI direction do Codex chọn

Studio thời trang tối giản: người và đồ là trung tâm, bề mặt preview trung tính, ánh sáng đều; tủ đồ phân slot top/bottom, nhấn một card để mặc và giữ slot kia. App chrome có thể tối nhẹ để tăng độ tập trung, nhưng màu áo đo dưới ánh sáng trung tính, không đèn cam gây lệch màu. Đây là hướng đề xuất theo quyền lựa chọn UI, chưa phải mockup đã được người dùng xem.

Navigation rõ: Wardrobe / Studio / Saved looks; tạo/chỉnh avatar và quiz dễ tìm nhưng không ép quiz/capture thành gate chặn vào tủ. Mobile capture và quản lý tủ thuận tiện, desktop dành không gian3D. Trạng thái xử lý ngay trên item, giữ bộ hiện tại khi món mới chưa sẵn sàng; camera front mặc định, auto-orbit do người dùng bật.

## 7. Điều còn mở (không tự suy diễn)

Danh sách số đo/avatar video duration, hỗ trợ định dạng upload, thời gian món đồ mới tối đa, định nghĩa15–30phút có queue/upload, slider ranges cụ thể, cơ chế tóc thật, chỉnh bằng lời latency, ảnh jeans capture details, default retention khi lỗi, policy xóa account và cloud data permissions. Những mục này chốt bằng mẫu/prototype và câu hỏi tiếp theo nếu ảnh hưởng quyết định, không cần hỏi lại27ưu tiên đã rõ.
