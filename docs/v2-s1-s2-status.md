# Bản triển khai S1 và nền tảng S2 trên Mac

05/11/2026, America/New_York. Branch `codex/3d-studio-worker`, worktree `/Users/khoihoang/Documents/fitmatch_AI-3d-studio`.

## Đã triển khai cục bộ

- `/prepare`: chụp/tải đủ góc body hoặc áo thật gắn wardrobe ID; upload private, kiểm tra decode/kích thước, ảnh pending không thể tạo job. Hiển thị capability/online theo heartbeat, danh sách model và trạng thái, cancel/retry.
- Control plane: schema additive, RLS, server xác thực owner, worker token hash/revoke, idempotency key + payload conflict, quota enqueue 50 job/ngày UTC và 20 active/tài khoản, 100 asset intents/24h kể cả pending, claim SKIP LOCKED và một job/worker, lease120s/attempt<=3, completion atomic với model output. Mỗi attempt lưu engine/model revision khai báo. Ready fitting cache theo cặp version avatar/garment bất biến.
- Upload trực tiếp private storage bằng signed URL; server tải lại/decode, bỏ metadata ảnh, xác minh GLB có mesh/buffer nhúng trước publish. Output URL ký5phút. Server-service credential và lease/token không trả về API browser jobs.
- `/quiz`: 6 bước desktop/mobile, chọn phong cách bằng ảnh tham khảo, dịp mặc/màu/phom/họa tiết/thời tiết, restore profile version và draft theo tài khoản trong tab, retake. Phom/thời tiết mới lưu preference; chưa suy ra fit/material từ quiz.
- `/looks`: xếp hạng tối đa3 áo thun/sơ mi thật, loại pattern tránh, ưu tiên style/màu/dịp/favorite/like, giải thích quy tắc. Không invent item hoặc quần/phụ kiện. Feedback like/skip + undo; snapshot và profile version gắn recommendation; POST lặp lại snapshot hiện tại dùng lại record; hoàn tác về snapshot cũ tạo generation mới để GET latest đúng. Save/delete look trên tài khoản, kiểm tra ownership và readiness.
- Missing fitting tạo job riêng, ready fitting mở trong `/studio?avatar=...&fitting=...`; download giới hạn bytes, kiểm tra SHA256, preload cùng avatar đúng version rồi thay áo tại chỗ. Giới hạn phiên12áo/120MiB. Luồng import ZIP/GLB/IndexedDB cũ tiếp tục dùng được.
- Python worker transport stdlib: outboundHTTPS, capability config allowlist, integrity download, renew URL, heartbeat/cancel/lease loss, subprocess không shell và không truyền token app vào adapter, staging/finalize/complete. Config mặc định không capability/inference giả.
- UI điều hướng chung Prepare → Quiz → Looks → Studio, thông báo empty/error/offline và layout desktop/mobile; footer tập trung luồng người dùng.

## Phạm vi chưa nghiệm thu

- Chưa áp dụng migration vào Supabase thật, chưa đăng ký worker/token thật, chưa deploy hoặc push.
- SiTH đang do PC xử lý độc lập. Chưa có adapter SiTH/garment reconstruction/drape đã nghiệm thu trong transport này. SiTH hoạt động không đồng nghĩa dựng được áo độc lập hoặc mô phỏng mặc áo.
- Chưa đo chất lượng avatar, logo, xuyên áo, warm-swap p95, FPS hoặc latency RTX3060; các hình test là tam giác synthetic, không đại diện chất lượng AI.
- Chưa dùng Qwen để xếp hạng hoặc generate ảnh. Recommender hiện là `rules-v1`, hoạt động không cần inference/API trả phí. Provider Qwen/VLM là bước benchmark riêng, không tạo GLB chỉ bằng text/image generation.
- S2 hiện là gợi ý phần áo; chưa multi-layer outfit/full-body composition. Analytics/feedback model học, model-quality scoring, tự lọc ảnh theo pose/ánh sáng, queue fairness/priority theo nhiều user và dashboard vận hành nâng cao còn ở roadmap.
- Private assets/version history chưa có UI xóa toàn bộ tài khoản hoặc automatic storage GC/retention. Staging và verified có thể cùng tồn tại. Chỉ beta nghiên cứu có kiểm soát trước khi có lifecycle retention, không coi đây là release công khai.
- Hai hệ profile được giữ riêng: quizV2/recommendationV2 không xóa lịch sử quiz/outfit cũ. Luồng phối đồ2D cũ vẫn dùng profileAPI cũ.

## Chạy và nối PC

Xem `docs/pc-worker-connect.md` cho migration, token enrollment, worker config, contract adapter và checklist ảnh thật. `docs/worker-api-contract-v1.md` có payload/trạng thái hiện thực.

## Bằng chứng kiểm thử cục bộ

- Lint với `--max-warnings=0` và production build Next16.4.5 / TypeScript pass.
- Unit: auth/validation/Studio + recommendation, feedback, schema và gate GLB.
- PostgreSQL16 cô lập: dedupe8request→1job; claim song song không trùng; RLS/grants; cross-owner; lease expiry/stale completion; cancel/retry/revoke; fitting cache;20/25job và2/6upload được quota chấp nhận chính xác.
- `test:v2`: Next HTTP handlers + auth/storage fixture + SQL RPC thật + Chromium. Chạy đủ avatar→garment→fitting bằng triangle synthetic; source photo decode/normalize; browsercapture khi worker offline; quiz draft/retake không nhân version; feedbackẩn/undo; snapshotreuse; save look; kiểm tra SHA256 rồi mở Studio; cloudload chậm không ghi đè local import mới hơn; mobile390px không overflow. Python worker thật gọi protocol và chạy adapter synthetic trong tempdir, token không truyền vào adapter. Tiếp tục chạy bộ HTTP/Studio cũ, PKCE/linking/session refresh/pagination/quota/PATCH đều pass.
- `npm audit --omit=dev`:0vulnerabilities tại lúc kiểm tra. Kiểm thử Python syntax pass.
- Chưa kiểm tra migration/Storage trên Supabase live, chưa chạy CI GitHub, chưa đo inference hoặc đồ thật. Screenshot ở `test-results/v2-*.png` chỉ là bằng chứng UI/transport với dữ liệu test; không phải kết quả avatar AI.
