# Prompt Mac / Claude — tiếp tục V2 đang dở, review trước khi tiếp quản

> Nguồn đọc chung hiện hành là nhánh GitHub `codex/project-operations`; đọc [hướng dẫn đồng bộ](./github-sync.md). Giữ code/checkpoint trong repo riêng, không cần chuyển ZIP hoặc chép đè toàn repo.


Bạn phụ trách hỗ trợ app/API/viewer FitMatch trên Mac. Đọc đầy đủ `AGENTS.md` → `agent.md` → `roadmap.md` → `process.md`, `CLAUDE.md`, rồi `docs/handoffs/reassignment-2026-11-05.md`. Codex chat điều phối là chuyên gia đánh giá; agent PC đang tiếp tục SiTH checkpoint004. Không tạo subagent/chat mới.

## A. Không bắt đầu lại hoặc ghi đè agent đang làm

Workspace tài liệu điều phối: `/Users/khoihoang/Documents/fitmatch_AI` (main1ef8f25 + dirty, không phải app mới nhất).
Workspace implementation: `/Users/khoihoang/Documents/fitmatch_AI-3d-studio`, branch `codex/3d-studio-worker`, HEAD đã thấy `0ec92c6e2a08f0771bc260472be25d69778cb6fb` + nhiều dirty/untracked V2. Nhánh đã merge remediation824c3fa qua6ed5a86; không giao sửa audit/merge lại từ đầu.

Chat Mac **Khảo sát app thử đồ 3D**, ID01a1a9db-8926-7903-9a99-436be8b59eac, đang active lúc đối chiếu. Đây là AI đang giữ code, không phải bằng chứng Claude đã nhận ownership.

- Nếu bạn chính là owner đang triển khai: tiếp tục session/checkpoint đó và ghi mapping task, không mở implementation thứ hai.
- Nếu là Claude/AI mới: trước hết chỉ đọc/review, ghi report/patch proposal ở worktree riêng; không sửa worktree active. Muốn tiếp quản phải có handoff ghi revision, dirty/untracked được bảo toàn/chuyển và scope file được giải phóng. Không reset/stash/clean để lấy workspace.
- Kiểm HEAD/status lại, không giả snapshot của reviewer vẫn mới nhất. Copy bộ docs điều phối sang worktree riêng khi cần, không kéo ghi đè source hoặc env.

## B. Phần có sẵn cần giữ và kiểm chứng

Đã thấy viewer Three.js orbit/zoom/compare/import ZIP/GLB/IndexedDB và saved looks local; `src/lib/v2/`, `/api/v2/[...path]`, `/prepare`, `/looks`, quizV2, rules-v1 recommendation/feedback; migration`20261105_studio_control_plane.sql`; worker Python stdlib + manage/config; DB/API/browser tests và CI đang sửa.

Đọc `docs/v2-s1-s2-status.md`, `docs/worker-api-contract-v1.md`, `docs/pc-worker-connect.md`, `docs/fitmatch-v2-master-plan.md` trong worktree đang triển khai. Nghiệm thu thực tế phải đối chiếu source/test. Không coi các mục “đã triển khai” là deployed; không dựng viewer/queue/quiz khác để lặp phần có sẵn.

Trước mọi code Next đọc hướng dẫn liên quan trong `node_modules/next/dist/docs/` của đúng worktree (đang ghi Next16.4.5), không dùng dependency checkout gốc cũ làm chuẩn.

## C. Việc ưu tiên ngay

1. Kiểm kê baseline, dirty/untracked scope, file owner, test hiện có, report đã chạy và thay đổi sau report. Ghi session/task APP-00…04 theo phần có code, không đặt tất cả về Planned.
2. Đối chiếu protocol thực tế `/api/v2/worker` với bản đề xuất `docs/handoffs/worker-contract-v1.md`. Dùng bản thực tế làm baseline sửa và conformance, không thêm `/api/worker/v1` song song. Giữ các yêu cầu owner/version/idempotency của roadmap; ghi requirement→file/test→gap.
3. Reproduce/test các ca cần sửa trước PC live:
   - complete thành công nhưng mất HTTP reply: retry/reconcile idempotent, không fail nhầm hoặc chạy model lần hai;
   - mất claim reply khi server đã cấp lease: tìm lại assignment/recovery có giới hạn, tránh job treo/rerun mù;
   - output-intent/upload/finalize đứt mạng, URL hết hạn, checksum/owner/attempt đúng;
   - revoke/cancel/lease expired và kết quả trễ; capability allowlist phía server so với khai báo operator;
   - delete/tombstone/reference/retention, không khôi phục dữ liệu đã xóa bởi completion cũ;
   - hai user cùng một GPU: worker token đang bound1owner, thiết kế scheduling/scoped enrollment rõ; tuyệt đối không đưa service-role cho PC hoặc chạy hai inference cùng lúc.
4. Giữ schema migration additive và test DB thật. Chưa chạy migration project Supabase thật/enrollment/deploy ở nhiệm vụ này. Viết runbook môi trường test và rollback app, không coi fixture storage là Supabase thật.
5. Kiểm import GLB lớn/texture/memory và normalized input ảnh2048/JPEG95; ghi giới hạn chất lượng. Chuẩn bị load output PC thật bằng cùng viewer, không viết viewer khác. Avatar GLB clothed không được gắn nhãn clean body hoặc cho phép thay áo giả.
6. Bảo toàn quiz/profile cũ/auth/wardrobe/outfits; quy tắc ranking hiện tại ghi `rules-v1`, không gọi đó là Qwen hay model học feedback. Không tải model ảnh/text mới trong lúc chờ PC.

Nếu bạn chưa có quyền tiếp quản code thì hoàn thành review + repro plan + patch proposal trước, giao owner hiện hữu thực hiện; không bị yêu cầu tạo bản code cạnh tranh để chứng minh có hoạt động.

## D. Kiểm thử và bằng chứng

Sau khi có ownership và thay đổi, chạy bộ kiểm phù hợp trên revision cuối:

```sh
npm run lint -- --max-warnings=0
npm test
npm run build
npm run test:v2:db
npm run test:v2
```

Đọc script trước chạy để biết có start server/container, port/temp fixtures và cleanup. DB test dùng PostgreSQL thật cục bộ; browser fixture dùng synthetic meshes và không gọi provider thật. Thiếu Docker/Chromium thì báo Not run/Blocked phần đó, không giả PASS. Chỉ mở rộng/chạy lại khi có thay đổi/lỗi cần kiểm.

Tách rõ: (a) test đã có report từ session trước, (b) test bạn vừa chạy với lệnh/exit/log/revision, (c) PC thật/Supabase thật chưa chạy. Screenshot tam giác không chứng minh độ giống avatar.

## E. Điểm nối PC và bàn giao

PC báo body fitting đã xong trên RTX3060/RAM16GB, texture/reconstruction/GLB còn chờ MSVC/nvdiffrast. Lần cuối chủ dự án tạm dừng admin/UAC; không yêu cầu PC bypass hoặc làm lại weights/fitting. Khi PC gửi GLB, xác minh embedded texture/trục/scale/pose trước integrate; chưa có ảnh cá nhân thì ghi demo.

Mac giữ transport `scripts/worker/worker.py` và server/schema; PC giữ adapter/toolchain/export. Chốt revision giao nhận, cập nhật contract/tests trước copy worker sang PC. Config default engines rỗng; chỉ bật avatar capability sau self-test adapter thật, không bật garment/drape chỉ vì SMPL-X load được. Một owner handshake trước, sau đó hai user và scheduler GPU, toàn bộ vẫn cần môi trường HTTPS/test DB được chuẩn bị.

Gửi `docs/reports/claude/mac-resume-report.md` hoặc report owner hiện hữu: baseline/branch/dirty inventory; scope/handoff; code có sẵn và gap; contract matrix/proposals/fixes; test logs/screenshot; runbook test migration/token; phần chưa triển khai production/PC thật. Cập nhật process delta và END/HANDOFF. Không push/merge/deploy/migrate production, không ghi secret vào report. Chưa mở animation trước bản tĩnh được Codex và chủ dự án duyệt.
