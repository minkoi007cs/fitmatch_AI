# Fitmatch V2 — kế hoạch hợp nhất sản phẩm, API và AI 3D

Ngày: 05/11/2026, America/New_York. Thay thế phạm vi của các bản kế hoạch 3D trước khi có mâu thuẫn. Đây là kế hoạch triển khai và tiêu chí nghiệm thu, không phải tuyên bố toàn bộ hệ thống đã chạy.

## 1. Định hướng đã chốt

Desktop trước; nhóm nghiên cứu nhỏ, có thể mở rộng. Người dùng chụp cơ thể để tạo avatar riêng, chụp áo thun/sơ mi trước/sau để số hóa đồ thật; quiz và gợi ý phải dẫn đến outfit có thể nhìn trên avatar 3D. Màu/logo/form cần giữ trung thực. Áo đã chuẩn bị phải đổi gần tức thì; các bước AI và drape thực hiện nền.

Mac chịu trách nhiệm chuẩn bị web, dữ liệu, API, kiểm thử, UI/UX và adapter. PC chịu trách nhiệm chạy/benchmark model. Web không chờ PC để sửa lỗi hay hoàn thiện luồng; nghiệm thu AI thật vẫn phải chờ output PC, body/checkpoint hợp lệ và dữ liệu thử.

Không chọn một model duy nhất cho cả đọc ảnh, tư vấn, tạo ảnh, dựng hình người, dựng áo và mô phỏng. Không coi ảnh 2D đẹp là kết quả GLB thay áo được.

## 2. Hiện trạng có bằng chứng

| Thành phần | Đã có | Khoảng trống |
|---|---|---|
| Baseline repo | origin/main ac26306 lúc fetch 05/11; checkout gốc cũ hơn | Hợp nhất các nhánh sửa cục bộ trước mở rộng |
| Sửa audit | codex/fix-audit-followup 824c3fa: validation, bảo toàn PATCH/profile, UUID/snapshot, pagination, quota ngày, normalize ảnh, CI | Chưa idempotency/concurrency cap; chưa asset GC hoàn chỉnh; không suy ra đã có trên production |
| Studio | 43cff27: GLB viewer thật, capture ZIP, tìm/lọc áo, A/B, IndexedDB và local looks | Chưa cloud persistence, queue, GPU connection; browser storage không phải security boundary |
| API AI | Gọi OpenAI trực tiếp; text/vision/image có các luồng riêng | Chưa provider abstraction/capability discovery/model revision; ảnh lookbook từ mô tả, không đảm bảo đúng item |
| Quiz | Có body/height/lifestyle/style/color; nhánh audit lưu recommendation cùng JSON profile | Chưa ranking trên toàn wardrobe IDs; input/profile/output version chưa chuẩn; mặc định câu trả lời có thể gây hiểu nhầm là lựa chọn chủ động |
| Đề xuất outfit | Endpoint nhận một analysis và style profile | Chưa bắt buộc item IDs thuộc tủ, chưa biết prepared fitting và avatar version |
| SMPL-X | Gói tải và kiểm tra trên Mac, chuyển lên Drive riêng | Không chứng minh SiTH/clean body/garment pipeline đã hoàn thành trên PC |

Lần này đọc lại source API/profile/generate/quiz và báo cáo remediation; chưa gọi đây là audit production toàn diện mới. Kiểm tra đầy đủ hơn nằm trong lô B0 và các gate bên dưới.

## 3. Luồng sản phẩm đích

Đăng nhập → dashboard tiến độ → quiz phong cách có thể bỏ qua → thêm ảnh/avatar → thêm đồ → phân tích/số hóa → gợi ý 3 outfit từ đồ thật → chuẩn bị các fitting còn thiếu → mở 3D trên avatar → so sánh/lưu → phản hồi để cải thiện lần sau.

Ba loại nội dung phải phân biệt:

1. Đồ cá nhân: source_item_id, ảnh gốc, garment version và provenance. Không tự tạo áo khác để lấp món còn thiếu.
2. Ý tưởng thiết kế: người dùng yêu cầu tạo món chưa có → generated garment riêng, nhãn "ý tưởng AI", không lưu vào tủ đồ thật như đã sở hữu.
3. Ảnh lookbook: có thể tạo bằng image model, gắn với look/version và nhãn ảnh tổng hợp; không thay thế tài sản 3D.

## 4. B0 — hợp nhất baseline và xử lý code smell/bug

- Tích hợp 824c3fa vào nhánh Studio, giải conflict dependencies bằng lockfile tái tạo, giữ auth/Origin/PKCE/RLS hiện có.
- Chạy lại regression toàn bộ sau merge. Không chỉ dựa kết quả từng nhánh.
- Inventory mọi API theo input/output, auth, owner checks, side effect, quota, timeout, retry và storage reference.
- Cụ thể hóa các phần audit còn thiếu: idempotency theo actor/action/payload, concurrency reservations có lease, reference lifecycle/cleanup delayed, legacy data reads, nguồn outfit snapshot bất biến.
- Kiểm tra lại archive và quiz race ở browser: thay lựa chọn khi request cũ đang về, reload/retry sau lỗi mạng, lỗi provider một phần.
- Chia page lớn thành view/controller/domain; rút client fetch/validation/provider logic dùng chung. Tránh refactor toàn repo một lần hoặc giữ mock success trong code production.
- Rà chuỗi dependency runtime và dev; xử lý compatible upgrades từng nhóm. Không audit fix --force hay rollback dependency đã vá.
- CI chạy lint, type/build, domain tests, API integration, DB concurrency/RLS tests và browser các story chính. Public smoke riêng, tài khoản live riêng.

Gate B0: Studio và remediation cùng ở một nhánh chạy test; trạng thái Done/Partial/Unverified cho từng finding; migration plan và không mất data cũ.

## 5. B1 — chuẩn hóa API và dữ liệu

Giữ route V1 cho UI cũ trong thời gian chuyển đổi; V2 contract-first để UI và PC cùng phát triển.

| Hiện tại | Hành vi V2 |
|---|---|
| /api/analyze-image, /api/upload-item | Upload asset riêng → finalize/validate bytes → analysis job; không gửi ảnh lớn trong JSON |
| /api/wardrobe + /[id] | Preserve PATCH; multiple views; garment status/version; precise owner checks |
| /api/user/profile | Quiz draft/version, profile generation riêng; cập nhật preference không xóa body/avatar/history |
| /api/generate-outfit | Recommend từ inventory snapshot và profile/avatar versions; output item IDs có kiểm chứng |
| /api/generate-outfit-image | Endpoint image-preview riêng, job async; không coi text-to-image là garment reconstruction |
| /api/outfits | Lưu outfit snapshot, item/material/avatar/prepared versions, thumbnail, provenance và restore |
| Studio local | Giữ importer cứu hộ; cloud owner-scoped là luồng sử dụng chính |

Đề xuất endpoints:

- POST /api/v2/assets/upload-intent; POST /api/v2/assets/finalize.
- GET/POST /api/v2/avatars; GET/PATCH /api/v2/avatars/:id; POST /api/v2/avatars/:id/reconstruct.
- POST /api/v2/wardrobe/:id/views; POST /api/v2/wardrobe/:id/reconstruct.
- GET/POST /api/v2/style-profiles; POST /api/v2/recommendations.
- POST /api/v2/fittings/prepare; GET /api/v2/fittings/:id.
- GET/POST /api/v2/looks; DELETE /api/v2/looks/:id.
- GET /api/v2/jobs/:id; POST /api/v2/jobs/:id/cancel; POST /api/v2/jobs/:id/retry.
- GET /api/v2/compute/status (cho user: capabilities và tình trạng phục vụ, không lộ machine secrets).
- Worker endpoints theo contract riêng, không dùng user session cookie để giả lập máy.

Quy tắc: bounded JSON/schema runtime, requestId, error code ổn định, 202 + jobId cho tác vụ nặng, 429 + Retry-After cho giới hạn; không lộ stack/upstream secrets; idempotency cùng payload mới replay, payload khác cùng key phải reject. Không trả base64 sau khi file đã lưu. Ký lại URL không chạy AI lần nữa.

Migrations bổ sung: assets/references, capture_sessions, avatars/avatar_versions, garment_versions/views, style_profile_versions, recommendation_batches/items, prepared_fittings, looks/look_items, processing_jobs/attempts, worker_registry/capabilities. Mỗi row đều owner/provenance/version phù hợp; quyền execute RPC riêng cho worker/server. Migration test bằng Postgres thật, backfill legacy nhẹ và có rollback app. Không đổi/xóa bảng cũ trước migration kiểm chứng.

## 6. B2 — Quiz 2.0 và recommendation engine

### Quiz

Sáu nhóm ngắn, có progress và quay lại sửa:
1. Mục đích và dịp mặc: campus, đi làm, đi chơi; ưu tiên thoải mái/lịch sự/cá tính.
2. Chọn cặp hình outfit A/B và mức thích; không chỉ tick tên phong cách.
3. Phom/cảm giác mặc: regular/oversize, dài/ngắn, mức kín, layer; tránh suy ra cơ thể từ sở thích.
4. Màu/họa tiết yêu thích và không muốn; tách "thích" khỏi "có trong tủ".
5. Khí hậu/thời tiết do user cung cấp ban đầu, lifestyle, món thường dùng, mục tiêu phối lại đồ.
6. Review và gợi ý đầu: lưu answers/profile version; avatar/chiều cao/số đo thuộc onboarding body riêng, optional cho quiz.

Không coi các default như tuổi/màu/style là câu trả lời đã xác nhận. Câu nhạy cảm có thể bỏ qua. Không chấm điểm cơ thể hay gán "đẹp/xấu". Ghi rõ thời tiết là dữ liệu người dùng nếu chưa tích hợp nguồn thật.

### Đề xuất outfit

- Query wardrobe thực theo owner và snapshot revision; loại item archived/unavailable/unsupported theo context.
- Lọc ràng buộc cứng bằng code (category/occasion/exclusions/compatibility), sau đó score/rank bằng preference + model; diversity để không trả ba bộ gần giống.
- Model chỉ chọn từ allow-list IDs; kiểm tra output lại ở server. Item bịa hoặc sai owner bị reject/fallback rule-based, không âm thầm thêm.
- Trả 3 outfit với item IDs, explanation ngắn, source/availability, avatar/profile/item versions và fitting readiness.
- Full outfit cần các category tương ứng đã hỗ trợ 3D. Bản áo thun/sơ mi hiển thị rõ phần áo cá nhân; đồ nền/preset phải có nhãn, không giả là quần/giày từ tủ.
- Khi được chọn "Tạo look 3D", compose các assets ready; chỉ enqueue fitting còn thiếu. Không generate lại đồ thật mỗi lần đổi vibe.
- Feedback thích/không thích kèm lý do (màu, phom, dịp, quá nóng...) gắn recommendation/version; không tự học từ một click nhầm.
- Lưu recommendation để reload không tính AI lại. Khi wardrobe/profile thay đổi, đánh dấu cũ và cho cập nhật có chủ đích.

Hai đường thực hiện: outfit từ đồ sở hữu → composition 3D; outfit ý tưởng → design specification → garment generation + texture + drape → asset có nhãn AI. Đường ý tưởng là phase sau vì khó hơn và có thể không giống món thật.

## 7. B3 — pipeline hình ảnh → 3D

Avatar: kiểm ảnh → fit body → tạo/tối ưu shape và appearance → tách collision body khỏi đồ cũ → UV/texture → QA → avatar version.

Áo: ảnh front/back/detail → segmentation/landmarks → nhận dạng cấu trúc → pattern/template/reconstruction → topology/seams → UV/texture transfer → canonical garment version (giữ kích thước).

Fitting: body version + garment version + pose + material/solver revision → align → drape/collision → QA → GLB (body và áo riêng) + preview → publish ready.

Các adapter: SiTH/ECON cho nghiên cứu human; GarmentCode/Warp baseline có kiểm soát; ChatGarment/ReWeaver thử nghiệm reconstruction; VTON360 nhánh 360 riêng nếu chọn biểu diễn khác mesh. Không khóa public API vào tên repo.

QA bắt buộc: giống người, màu/logo trước/sau, form/cổ/tay/hàng nút, xuyên body, áo cũ dính body, units/pose/alignment. Giữ source và output versions. Model ảnh có thể hỗ trợ vùng texture thiếu nhưng phần suy đoán phải có provenance; không overwrite logo quan sát được bằng ảnh mới đẹp hơn.

## 8. B4 — kết nối PC và orchestration

Mac triển khai control plane bằng API + durable queue/storage. PC dùng worker adapter, chủ động HTTPS lấy job; không mở public port trên PC chỉ để browser gọi model trực tiếp.

Worker khai báo từng capability đã self-test thành công, model revision, formats/limits, lease heartbeat; chỉ quảng bá phần thật sự chạy được. `smplx_loaded` không đồng nghĩa `avatar.reconstruct` đã sẵn sàng, và `avatar.reconstruct` không đồng nghĩa `garment.reconstruct`/`garment.drape`.

One GPU 12GB: bước đầu một tác vụ nặng tại một thời điểm, model unload/load theo stage. Queue ưu tiên thao tác user đang chờ nhưng không bỏ đói tác vụ dài; có fairness và quota. Không giữ Qwen + diffusion + 3D cùng GPU chỉ để gọi nhanh hơn. Assets đã ready vẫn dùng được khi PC offline.

Lease atomic + expiry + fencing chống completion cũ, idempotency và cancel trước publish. Retry tách transient/OOM/bad-input/unsupported/model-missing; OOM có thể thử fallback profile đã duyệt một lần, không loop. Upload kết quả vào staging, kiểm checksum/format/owner/provenance rồi mới publish ready. Job parent/DAG cho pipeline; chỉ stage phụ thuộc lỗi bị chặn.

Mọi asset download/upload worker dùng signed URL scoped theo job và thời hạn; không cấp service role cho browser/worker. Log không chứa ảnh base64, secrets hay signed URLs. Unknown result/provider timeout không tự trả lại reservation rồi replay mù.

## 9. Model đề xuất cho PC: Qwen là từng vai trò

Khảo sát nguồn chính thức ngày 05/11/2026; tất cả lựa chọn dưới là ứng viên benchmark, chưa có số đo trên PC này.

| Vai trò | Ứng viên | Quyết định |
|---|---|---|
| Đọc ảnh đồ, JSON attributes, giải thích/style ranking | Qwen3-VL-4B-Instruct, quantized khi runtime hỗ trợ | Ưu tiên thử 4B trước; giữ schema validation; 8B chỉ khi quality gain và memory budget hợp lý |
| Tạo/chỉnh ảnh lookbook/texture study | Qwen-Image-2.1-Turbo | Nhánh nghiên cứu tùy chọn, không chặn 3D core; phải đọc qwen-research license; generation component 7B còn có text encoder 8B/VAE nên không hiểu là toàn pipeline 7B |
| So sánh với image baseline trước | Qwen-Image-Edit (20B) | Không ưu tiên chạy bf16 toàn bộ trên 3060; offload/quantization cần đo RAM/latency |
| Tạo người 3D | SiTH pipeline + body model hợp lệ | Theo PC đang làm; benchmark shape/texture thực |
| Áo 3D + drape | GarmentCode/Warp và adapter reconstruction | Tách khỏi Qwen image/text; chức năng này mới tạo asset mặc được |

Qwen3-VL-4B thuộc Image-Text-to-Text và có ví dụ server OpenAI-compatible chính thức. Đây là bằng chứng về giao diện serving, không phải bằng chứng vLLM mặc định vừa 12GB.

Qwen-Image-2.1-Turbo hỗ trợ generation/edit 8 bước; không cam kết bao nhiêu giây trên 3060. Nhánh image phải benchmark theo phiên bản quantization/offload, input size, steps và chất lượng. Không đánh đồng license Apache của model khác với checkpoint qwen-research.

Đề xuất triển khai đầu: một VLM nhỏ cho analyze/style + 3D worker đang xây; image generation có provider adapter optional. Giữ OpenAI hiện tại như provider cấu hình cho text/vision nếu người dùng đang có key, nhưng không tự gửi ảnh cá nhân sang cloud để fallback khi local lỗi. Fallback cần policy rõ và UI cho biết provider.

## 10. UI/UX toàn app

- Dashboard: việc tiếp theo, avatar active, số đồ đã số hóa, jobs cần bổ sung ảnh, look gần đây; trạng thái PC dựa heartbeat thật.
- Studio: canvas trung tâm, wardrobe trái, outfit/compare/save phải; view controls, thumbnail/source comparison, status tại item. Drag/drop chỉ là tăng tốc; mọi thao tác có button/keyboard.
- Wardrobe: ảnh trước/sau, filter/search, phom/size thông tin user, state `ảnh gốc / đang dựng / sẵn sàng / cần chụp lại`; chọn lại ảnh không xóa phiên bản dùng được.
- Quiz: visual choices, saved draft/version, progress, giải thích đơn giản, optional retake. Kết quả là các outfit card với button mở 3D; thiếu assets có trạng thái xử lý đúng.
- Recommendations: ảnh gốc từng item + preview 3D khi ready; giải thích gọn "vì sao hợp mục đích của bạn"; tách wardrobe-only và ideas.
- Activity: queued/waiting_for_worker/running/needs_input/failed/ready, cancel/retry và resume reload. Không progress/ETA giả.
- Settings: avatar/model data, account, retention/delete, provider local/cloud policy; worker console chỉ cho owner/admin.
- Ngôn ngữ nhất quán tiếng Việt trước, có foundation dictionary; không biến phần i18n untracked ở checkout khác thành đã tích hợp.
- Empty/error/offline/quota/storage-full/expired URL đều có hành động tiếp theo. Accessibility: focus trap, keyboard, labels, contrast, reduced motion và responsive desktop/tablet/mobile.

## 11. Sprint triển khai và đầu ra

Sprint là nhóm công việc có gate, không phải lời hứa ngày hoàn thành khi chưa đo GPU.

| Sprint | Mac / web làm độc lập | PC làm khi sẵn sàng | Gate |
|---|---|---|---|
| S0 — Foundation | Merge remediation + Studio, test lại, API inventory, audit backlog | Tiếp tục setup hiện có | Không regression; trạng thái audit có bằng chứng |
| S1 — Contracts + storage | Schema additive, upload finalize, job lifecycle/worker auth, fixture worker có nhãn test | Implement client theo contract, capability self-test | End-to-end fixture upload→job→publish→reload; auth/DB concurrency test |
| S2 — Quiz + recommender | Quiz V2, profile versions, inventory-constrained ranking, feedback, outfit composition | VLM JSON/style benchmark optional | Không item bịa/sai owner; retake/reload không mất dữ liệu |
| S3 — 3D integration | Avatar/garment cloud versions, fitting cache, Studio/result state, quota/cancel/retry | Xuất clean body + áo riêng + drape | Một ảnh người + một áo thật → fitting GLB trên web |
| S4 — Beta polish | UI toàn app, saved looks, lifecycle/GC, observability, docs/runbook | Thun + sơ mi, crash/restart/OOM benchmark | Hai user, nhiều look, PC offline/restart, quality review và beta |
| S5 — Expansion | Idea garments, category/layering mới, image provider nếu có nhu cầu | Benchmark model/solver tương ứng | Quality/license/performance và budget được chốt |

Gợi ý thứ tự ngay: S0 → S1, trong lúc PC hoàn thiện body. Không ưu tiên thêm chatbot hay tải image model lớn trước capability/job contract.

## 12. Tickets và điều kiện nghiệm thu

| ID | Việc | Phụ thuộc | Nghiệm thu |
|---|---|---|---|
| CORE-01 | Merge audit + Studio | Có các nhánh cục bộ | Lint/unit/build/HTTP/Studio cùng pass |
| AUD-02 | Fresh route/data/UI audit | CORE-01 | Findings có repro/priority/owner và test |
| API-01 | Shared V2 validators/errors/provider interface | CORE-01 | Contract tests input/output/error |
| DATA-01 | Asset/avatar/garment/look/profile/job migrations | API-01 | PG migrations + RLS/owner tests thật |
| QUEUE-01 | Idempotency/quota/concurrency/lease/fencing | DATA-01 | Double-submit/cross-user/late completion không sai |
| WORKER-01 | Auth scoped, heartbeat, capabilities, staging publish | QUEUE-01 | Fixture protocol conformance và actual PC handshake sau |
| QUIZ-01 | Visual quiz/draft/profile version | DATA-01 | Dirty hydrate/retake/reload/optional questions |
| REC-01 | Candidate filtering + rank + validated item IDs | QUIZ-01/API-01 | Không chọn đồ ngoài snapshot; diversity/fallback |
| LOOK-01 | Composition + missing-fitting prepare | REC-01/WORKER-01 | Ready assets reuse, đúng versions, partial state |
| UI-01 | Dashboard/wardrobe/activity/Studio unify | API-01 | Desktop/mobile/keyboard/error/offline review |
| GPU-01 | Avatar/garment/drape adapter | PC | Real artifact and benchmark, no template substitution |
| OBS-01 | Metrics + model revision + job traces | WORKER-01 | Failure reason/retry/cost/queue latency trace được |
| RELEASE-01 | Preview + two-account beta + rollout | Các gate trước | Không chỉ screenshot fixture; real provider/PC data |

## 13. Tiêu chí beta không được bỏ qua

- Hai account không xem/ghi/xóa job/model/look của nhau; worker chỉ lấy đúng scope.
- Client không điều khiển raw storage path/provider URL hay command chạy trên PC.
- Input malformed/oversized/không decode phải bị chặn trước gọi AI.
- V1 khách cũ vẫn hoạt động trong giai đoạn chuyển đổi; migration không xóa lịch sử.
- Recommendations trả item IDs thực; mọi đề xuất mở đúng avatar/profile/garment versions.
- Một end-to-end thật cho ảnh người và áo thật, không chỉ synthetic fixture.
- Warm swap mục tiêu p95 ≤1 giây cho asset đã preload; cold download/decode đo riêng; render mục tiêu ≥30 FPS trên desktop tham chiếu. Đây là target cần đo.
- PC offline/restart: assets ready vẫn dùng; pending jobs không mất, không nhân bản inference do retry mù.
- Avatar thay đổi invalidates fittings đúng; result cũ không ghi đè result mới; không auto-resize áo để giả vừa.
- Không chốt lịch, độ chính xác fit hoặc công suất serving khi chưa có benchmark PC.

## 14. Nguồn model chính thức

- https://github.com/QwenLM/Qwen3-VL
- https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct
- https://github.com/QwenLM/Qwen-Image-2.1
- https://huggingface.co/Qwen/Qwen-Image-2.1-Turbo
- https://huggingface.co/Qwen/Qwen-Image-Edit
- Các repo human/garment và giới hạn đã ghi trong docs/3d-research.md.

Số sao, demo hoặc quảng bá không thay thế quality/capacity/license review. Đến lúc PC sẵn sàng, kỳ vọng là adapter qua contract đã test; vẫn cần integration thật, không hứa chỉ điền một URL là mọi stage tự hoạt động.
