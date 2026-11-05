# Giao lại công việc — tiếp nối PC và Mac đang dở

> Nguồn đọc chung hiện hành là nhánh GitHub `codex/project-operations`; đọc [hướng dẫn đồng bộ](./github-sync.md). Giữ code/checkpoint trong repo riêng, không cần chuyển ZIP hoặc chép đè toàn repo.


Ngày 05/11/2026. Handoff H-RESUME-002, thay các chỉ dẫn “bắt đầu từ đầu” trong H-DOC-001. Đọc AGENTS → agent → roadmap → process trước làm. Đây là giao việc có điểm tiếp nối, không phải xác nhận model/app đã đạt nghiệm thu.

## 1. Những gì đã đối chiếu

### PC — có báo cáo từ chat, chưa truy cập filesystem PC trong phiên này

Nguồn: chat **Tóm tắt tiến độ body fitting SiTH**, ID `01a1abfd-f4c9-70b2-836a-e1ae9d1be514`, đã đọc các lượt cuối. Agent tiếp nhận phải kiểm local report/checkpoint để xác nhận trạng thái hiện tại, nhất là checkpoint 004.

- Workspace báo cáo: `C:\Users\johnn\Documents\Fitmatch-GPU\fitmatch_AI`.
- RTX 3060 12GB, RAM 16GB, driver 610.88; Python 3.10.22, PyTorch 2.1.0+cu121 theo báo cáo PC. Không coi RAM còn chưa biết như tài liệu PROC-0001.
- SMPL-X đã restore/checksum, sáu model ở `C:\Users\johnn\Documents\Fitmatch-GPU\models\smplx`; junction tới SiTH, giữ `version.txt` như bản gốc. Không tải/ghép lại vô cớ.
- Demo preprocessing và body fitting FP32 200 vòng đã chạy: 53,61s; peak VRAM PyTorch 3,07GiB, RAM process 3,21GiB; ba body models CUDA forward thành công theo báo cáo.
- OBJ đã có: `outputs\pc-sith-20261105-003\body-fit-retry2\000_smplx.obj`; preview front/side/back; collision candidate kín, patch đường dẫn/dtype Windows. Không coi body fitting là avatar textured hoặc clean body đã nghiệm thu.
- Gói `fitmatch-sith-handoff-20261105-003.zip` có patch/Git bundle/report; lượt cuối nói checkpoint **004**, nên phải đọc checkpoint mới nhất và `workers\windows\TOOLCHAIN-STATUS.md`, không quay ngược về 003 nếu đã có sửa mới.
- Blocker ghi nhận: MSVC/nvdiffrast. Chủ dự án đã nói chưa ở gần PC và **tạm dừng cài Administrator**; chưa có bằng chứng gỡ tạm dừng. Bản giao việc này không tự coi đã có chấp thuận UAC.
- Chưa có bằng chứng sinh mặt sau/reconstruction texture/GLB/drape hoàn tất. Có thể đã có thay đổi mới trên PC chưa đồng bộ; kiểm trước khi làm.

### Mac — đã đọc git/filesystem trực tiếp, có công việc đang chạy

| Vị trí | Snapshot | Cách xử lý |
|---|---|---|
| `fitmatch_AI` nguồn | main `1ef8f25`, dirty: auth/login/landing/README, i18n, docs/điều phối | Giữ nguyên, không lấy làm baseline app mới nhất |
| `fitmatch_AI-3d-studio` | `codex/3d-studio-worker`, HEAD `0ec92c6`, nhiều file dirty/untracked | Worktree chính tiếp tục app V2; đang có AI làm, không tạo bản app cạnh tranh |
| `fitmatch_AI-audit-fixes` | `824c3fa`, sạch lúc kiểm; đã là ancestor nhánh Studio qua merge `6ed5a86` | Không giao sửa audit từ đầu hoặc merge lại mù |
| `fitmatch_AI-app-system-auth` | `c05551c` | Lịch sử auth, không ghi đè auth hiện có từ bản cũ |

Chat đang phụ trách Mac là **Khảo sát app thử đồ 3D**, ID `01a1a9db-8926-7903-9a99-436be8b59eac`, trạng thái active lúc đọc. Đây là Codex hiện hữu, không có bằng chứng Claude đang sở hữu worktree đó. Claude mới tham gia không được tự chiếm file.

Đã thấy code: `/studio` viewer GLB, capture/import/local saved looks; V2 `/prepare`, `/looks`, quiz/profile/rules-v1 recommendation; `src/lib/v2/`, `/api/v2/[...path]`, migration control plane, Python worker transport, test DB/HTTP/browser và CI edits. Nhiều phần V2 còn chưa commit. Tài liệu bên Mac báo đã kiểm DB/browser bằng synthetic geometry, nhưng phiên reviewer này chưa chạy lại full suite và chưa nghiệm thu real PC/Supabase.

Không gửi yêu cầu xây lại viewer/queue/quiz/worker từ đầu. Không dùng screenshot tam giác fixture làm bằng chứng avatar thật. Chưa migration Supabase thật/enrollment/PC handshake/inference end-to-end được xác nhận; chưa push/deploy trong báo cáo này.

## 2. Xung đột giao thức cần xử lý trước tích hợp

Snapshot nguồn thực tế có trong [resume-snapshot-20261105](./resume-snapshot-20261105/snapshot-manifest.json), gồm contract/code worker/schema/migration lúc đọc, kèm SHA256; không chứa weights/credentials. Đây là snapshot worktree chưa commit, cần bên Mac chốt revision trước dùng thực tế.

| Hạng mục | Bản đề xuất trong chat này | Bản đã có code ở Mac |
|---|---|---|
| Prefix | `/api/worker/v1` | `/api/v2/worker` |
| Job types | `avatar.static.v1`, `garment.static.v1`, `fitting.static.v1` | `avatar.reconstruct`, `garment.reconstruct`, `garment.drape` |
| Payload | snake_case, lease/fencing fields riêng | camelCase, UUID lease token + attempt |
| Output | Manifest asset tham chiếu body/áo | Một GLB/ model version; fitting GLB chỉ chứa áo, avatar riêng |
| Upload | uploads/prepare + complete idempotent đề xuất | output-intent → upload → finalize → complete |
| Lease gợi ý | heartbeat 30s / lease 180s | heartbeat 20s / lease 120s / online90s / max3 attempts |

**Quyết định giao việc:** dùng code `/api/v2/worker` hiện có làm baseline để review và sửa, không dựng server/worker thứ hai theo bản đề xuất cũ. Đây không phải PASS giao thức. Giữ các yêu cầu an toàn/idempotency của roadmap; xuất bảng requirement → code/test → gap. Nếu đổi wire format, version và test conformance trước chuyển PC.

Các gap cần Mac kiểm tra có repro/test trước sửa:

1. Complete response bị mất: SQL đang chỉ chấp nhận running rồi xóa lease khi succeeded; Python exception path có thể gọi fail sau success. Cần replay/result reconciliation không chạy inference lần hai.
2. Claim response bị mất: SQL trả null khi worker đã giữ running job; cần đường nhận lại assignment hoặc recovery có giới hạn, ghi rõ có cần rerun không.
3. Output-intent/upload/finalize bị gián đoạn: idempotent mapping và refresh URL, không tạo output logic trùng/ready sai.
4. Capability operator claim vs server allowed capabilities và self-test thật; không quảng cáo garment/drape khi chỉ có body fitting.
5. Private asset/version deletion/tombstone/retention và orphan staging; chưa đủ vòng đời xóa trong report Mac.
6. Hai user dùng chung một GPU: một worker hiện bound một owner; không tự cấp service role hoặc đổi thành token đọc mọi user. Chốt scoped enrollment + một scheduler GPU chung hoặc worker allowlist có review, chứng minh không chạy hai inference cùng lúc. Khi chưa có thì nghiệm thu một owner trước và ghi phần hai người chưa đạt.
7. Photo normalization max2048/JPEG95 có ảnh hưởng texture/logo/mặt; benchmark ảnh normalized thật, không so với nguyên ảnh rồi tuyên bố giữ nguyên pixels.

## 3. Phân việc và thứ tự cụ thể

| Ưu tiên / gói | Bên thực hiện | Tiếp nối | Đầu ra để Codex đánh giá |
|---|---|---|---|
| P0 — trạng thái PC | PC agent hiện hữu | Checkpoint004/toolchain-status, giữ weights và fitting | Resume report + inventory delta; UAC còn chờ hay đã có compiler |
| P0 — trạng thái Mac | AI đang giữ nhánh Mac | Worktree 0ec92c6 + dirty V2 | Report scope/file owner + test results + checkpoint revision có thể giao |
| P0 — contract | Mac owner; Claude review độc lập | API/SQL/Python thực tế | Gap matrix, repro/tests và proposed fixes; không endpoint song song |
| P1 — avatar textured | PC khi blocker được gỡ | Rasterizer smoke → back view → reconstruction → GLB | Artifact/texture/previews/hash/VRAM/RAM/stage logs, nguồn demo/ảnh cá nhân rõ |
| P1 — quality/import | Mac owner sau nhận GLB | Viewer/asset finalize hiện hữu | Load GLB thật, đúng trục/scale/material; báo các validator giới hạn |
| P1 — adapter | PC adapter, Mac transport owner | `scripts/worker/worker.py` có sẵn + argv adapter | Self-test engine, input/output conformance, chưa quảng cáo capability khi output chưa thật |
| P2 — áo thun | PC | Body collision + template/drape có kiểm soát | Áo riêng, texture từ ảnh; chưa cần animation |
| P2 — tích hợp | Mac owner + PC, tách scope | Migration test env/enrollment/HTTPS sẵn sàng | Một owner handshake/inference thật; rồi hai owner/GPU serialization |
| P3 — review | Codex | Reports + artifacts/code/test | PASS / NEEDS CHANGES / NOT VERIFIED theo hạng mục, danh sách sửa và chủ dự án duyệt likeness |

Trong khi UAC còn chờ, PC vẫn kiểm checkpoint/export body OBJ→GLB có nhãn collision/debug, viết adapter skeleton/validator và inventory delta; không gọi debug GLB là avatar textured. Không chạy lại fitting chỉ để có hoạt động. Mac tiếp tục test/contract/UI ổn định độc lập, không cần đợi compiler PC.

## 4. Ownership khi bàn giao cho Claude

- AI Mac đang active giữ quyền sửa `fitmatch_AI-3d-studio` cho tới checkpoint bàn giao; agent Claude mới trước hết đọc và review, viết report ở nhánh/worktree độc lập.
- Trước Claude sửa implementation phải có handoff ghi: nhánh/SHA và danh sách dirty/untracked đã được người giữ nhánh bảo toàn/chuyển, file scope giải phóng. Không yêu cầu clean/reset/stash để chiếm worktree.
- `scripts/worker/worker.py` và manage/config/protocol server đang thuộc Mac transport owner. PC chỉ viết engine adapters/toolchain/export ở `workers/windows/`, `scripts/pc/` hoặc `worker/adapters/` đã chọn trong report. Thay transport phải patch proposal cho Mac review.
- Codex phiên này chỉ sửa docs nguồn và tạo snapshot/handoff, không sửa code worktree đang có AI khác thao tác. Hai prompt mới là giao việc để chủ dự án chuyển; chưa tự gửi message hoặc khởi chạy Claude/PC từ đây.

## 5. Bàn giao tối thiểu và điều kiện dừng

PC: `docs/reports/pc/resume-004-report.md` (có thể giữ report path cũ và liên kết), compiler/rasterizer log, stage benchmark, GLB/preview/hash, patches và env/model revisions, phần chờ UAC. Không đóng gói SMPL-X/checkpoint/ảnh cá nhân vào gói chia sẻ mặc định.

Mac: `docs/reports/claude/mac-resume-report.md` hoặc report của owner hiện hữu, status/dirty inventory, revision giao nhận, contract gap matrix và test output. Không báo lại một lệnh PASS nếu chưa chạy trên revision cuối; giữ evidence synthetic/real tách biệt.

Codex: review báo cáo và artifact thật; chưa có GLB thì chưa duyệt chất lượng. Nghiệm thu SiTH demo trước không đồng nghĩa avatar cá nhân/garment separation/fitting đã đạt. Bản tĩnh chưa đạt thì không bắt đầu idle/vải động. UAC/production/environment access thiếu: checkpoint rõ và tiếp tục phần độc lập; không tự gỡ tạm dừng hoặc bypass.
