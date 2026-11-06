# FitMatch — trạng thái thực thi và nhật ký AI

Cập nhật: 05/11/2026, America/New_York. Revision: PROC-0008. Dọn nhánh local hoàn tất; xem OPS-01/H-CLEAN-003. Đọc toàn bộ AGENTS → [agent.md](./agent.md) → [roadmap.md](./roadmap.md) → file này trước làm. Trạng thái dưới đã được reconcile với chat PC và worktree Mac; lịch sử PROC-0001 giữ bên dưới để đối chiếu.

## 1. Snapshot hiện tại và điểm tiếp nối

PROC-0001 bỏ sót công việc ở chat/worktree khác. Các dòng “chưa chạy gì” trong nhật ký cũ là quan sát thiếu của chat này, không còn là trạng thái toàn dự án. [H-RESUME-002](./docs/handoffs/reassignment-2026-11-05.md) thay chỉ dẫn bắt đầu từ đầu.

- PC có report body fitting SiTH thành công; lượt cuối nhắc checkpoint004. Reviewer chưa truy cập filesystem PC hoặc mở GLB/OBJ thực tế trong phiên này, cần xác nhận local checkpoint mới nhất trước chạy tiếp.
- Theo báo cáo: RTX3060 12GB, RAM16GB, driver610.88, Python3.10.22, torch2.1.0+cu121. FP32 fitting200 vòng53,61s; peak torchVRAM3,07GiB/RAMprocess3,21GiB. Đây là số đo cũ được báo cáo, chưa rerun bởi reviewer.
- MSVC/nvdiffrast là blocker cuối; chủ dự án tạm dừng phần admin/UAC vì không gần PC. Chưa có bằng chứng gỡ tạm dừng. Có SMPL-X/env/weights/body mesh thì tái sử dụng, không tải/chạy lại vô cớ.
- Cập nhật OPS-01: Mac implementation đã commit V2 ở `d2a98983391c90c0df0c7decb67bd2b0d8cad9c6`, sạch lúc kiểm cleanup. Thông tin 0ec92c6+dirty bên dưới là snapshot PROC-0002 trước commit, không dùng để bắt làm lại. Chỉ còn local branches main và codex/3d-studio-worker; auth/audit branch names đã archive, worktree cũ giữ detached.
- Mac implementation (snapshot PROC-0002): `/Users/khoihoang/Documents/fitmatch_AI-3d-studio`, `codex/3d-studio-worker`, HEAD quan sát `0ec92c6e2a08f0771bc260472be25d69778cb6fb` + dirty/untracked V2. Đã đọc source/docs viewer, queue/API, prepare/looks/quiz, worker transport và tests. Report DB/browser synthetic có sẵn, reviewer chưa chạy lại full suite hoặc nghiệm thu real PC/Supabase.
- Chat **Khảo sát app thử đồ 3D**, ID `01a1a9db-8926-7903-9a99-436be8b59eac`, đang active lúc kiểm và giữ Mac code. Không tự coi Claude là owner; Claude mới review read-only cho đến handoff rõ.
- Repo tài liệu gốc: `/Users/khoihoang/Documents/fitmatch_AI`, main `1ef8f2549633271d6310dc0701b323e46962413d`, dirty. Không lấy source cũ ở đây đè worktree implementation. Auth/login/landing/README, i18n, `.agentui/`, `state/` và docs người dùng được giữ nguyên.
- Audit fixes824c3fa đã merge vào nhánh Studio qua6ed5a86. Worktree audit-fixes sạch lúc kiểm; nhánh authc05551c là lịch sử. Không merge/sửa lại mù. Remote refs chỉ là local snapshot, chưa xác minh latest origin trong phiên này.
- Wire hiện thực `/api/v2/worker` khác bản đề xuất `/api/worker/v1`. Tiếp nối V2 code và gap review, không dựng giao thức thứ hai. Chưa PASS chất lượng/độ tin cậy chỉ từ việc có code.
- Gate tiếp theo G0/G1 đầy đủ; app fixture có tiến độ nhưng chưa real PC→Supabase→viewer/áo thật. Animation chưa mở. Prompt mới đã soạn, chưa dispatch/receipt từ PC/Claude.

## 2. Task board và scope

OBS-PC/OBS-MAC là mã quan sát nguồn có sẵn, không phải reviewer tự tạo session thay bên kia. In progress phản ánh code/chat đang có, không phải review PASS. Chi tiết phụ thuộc/tiêu chí theo roadmap.

| Task | Bên sở hữu / dự kiến | Trạng thái | Session / bằng chứng / bước kế tiếp |
|---|---|---|---|
| DOC-01 | Codex | Done | CX-DOC-20261105-01; docs gốc; thiếu tiến độ ngoài chat được sửa trong DOC-02 |
| DOC-02 | Codex | Done | CX-RECON-20261105-02; reconciliation/prompts/snapshot/package PROC-0002 |
| OPS-01 | Codex, được chủ dự án giao | Done | CX-CLEAN-20261105-03; 2 local branches còn lại, tags/bundle verified, report OPS-01 |
| OPS-02 | Codex, chủ dự án cho phép publish docs | Done | CX-PUBLISH-20261105-04; 874f4dc đã push và readback GitHub thành công |
| PC-00 | PC hiện hữu | Assigned | OBS-PC-004; inventory đã báo GPU/RAM/env, bổ sung delta/local receipt |
| PC-01 | PC hiện hữu | Assigned | OBS-PC-004; env/SMPL-X đã dùng; giữ weights/junction, kiểm toolchain/license manifest |
| PC-02 | PC | Planned | Body+áo template riêng/drape chưa có bằng chứng |
| PC-03 | PC hiện hữu | Blocked | OBS-PC-004; body fitting xong theo report, texture/reconstruction/GLB chờ MSVC/UAC |
| APP-00 | Mac owner hiện hữu | In progress | OBS-MAC-3D; baseline/schema/docs có code, reconcile contract/revision |
| APP-01 | Mac owner hiện hữu | Changes requested | V2 API/SQL/worker code dirty; lost reply/idempotency/scope gaps cần test |
| APP-02 | Mac owner hiện hữu | In progress | Viewer thật/test synthetic có sẵn, cần GLB PC/QA |
| REV-01 | Codex | Planned | Reconciliation chưa là review gate; chờ report/artifacts/diff cuối |
| PC-04 | PC | Planned | Áo thun texture/drape sau review body phù hợp |
| PC-05 | PC adapter / Mac transport | Planned | Transport có code, adapter thật chưa nhận; không viết worker thứ hai |
| APP-03 | Mac owner hiện hữu | In progress | Prepare/quiz/model/activity có code, còn QC/retention/corner cases |
| APP-04 | Mac owner hiện hữu | In progress | Looks/feedback/cache/cloud Studio có code; fixture không chứng minh real integration |
| INT-01 | Mac + PC | Planned | Tách INT-01A/B/C bên dưới; cần endpoint test/revision/GLB |
| QA-01 | Mac + PC | Planned | Tách QA-01A/B; synthetic report có, real/two-owner còn thiếu |
| REV-02 | Codex + chủ dự án | Planned | Bản thun tĩnh/likeness chưa duyệt |
| GAR-03 | PC + Mac | Planned | Sơ mi sau thun |
| ANIM-01 | PC | Planned | Chưa mở trước REV-02 |
| ANIM-02 | Mac/Claude sau handoff | Planned | Chưa mở trước body/cloth spike |
| REV-03 | Codex + chủ dự án | Planned | Review idle người/vải sau |

| Subtask | Owner | Scope / điều kiện |
|---|---|---|
| INT-01A | Mac owner | Protocol/schema/transport revision, test env runbook, chưa migrate production |
| INT-01B | PC | Adapter input→GLB, exporter/self-test/benchmark, không sửa transport Mac |
| INT-01C | Mac + PC ghi từng phiên | Mac server/enrollment, PC chạy worker; một owner trước, hai owner sau |
| QA-01A | Mac owner; Claude review độc lập | Claim/complete loss, owner/cancel/tombstone/DB/UI tests |
| QA-01B | PC | Rasterizer/inference/GLB/VRAM/RAM/OOM/restart evidence |

## 3. Session registry

| ID | Vai trò / scope | Baseline | Trạng thái / handoff |
|---|---|---|---|
| CX-DOC-20261105-01 | Codex docs nguồn | main1ef8f25 | Kết thúc, H-DOC-001 lịch sử |
| CX-RECON-20261105-02 | Codex reviewer, chỉ docs nguồn/snapshot/handoffs | main1ef8f25 | Kết thúc DOC-02, H-RESUME-002; không sửa worktree active |
| CX-CLEAN-20261105-03 | Codex vận hành repo, chỉ backup/ref metadata và tài liệu | main1ef8f25, Studio d2a9898 | Kết thúc OPS-01, H-CLEAN-003 |
| OBS-PC-004 (quan sát) | PC, chat body fitting SiTH | PC SHA chưa nhận | Checkpoint004, admin/UAC tạm dừng theo report cuối; cần xác nhận local |
| OBS-MAC-3D (quan sát) | AI Mac hiện hữu, chat Khảo sát app thử đồ 3D | 0ec92c6 + dirty | Active lúc đọc; chưa có bàn giao code cho Claude |

Session mới dùng ROLE-YYYYMMDD-unique-suffix; ghi machine/worktree, baseline, task/scope, checkpoint và receipt. Không bịa giờ hoặc khai session mới đang chạy khi chưa nhận. Claim đang có không tự hết hạn vì im lặng. Quy trình reconcile nhiều máy theo agent.md.

## 4. Decision register

| ID | Ngày | Quyết định / nguồn |
|---|---|---|
| D-001 | 05/11/2026 | Người dùng: hai người sử dụng, RTX3060 12GB; chưa SLA/public |
| D-002 | 05/11/2026 | Người dùng: avatar chân thực, người tĩnh/camera orbit trước |
| D-003 | 05/11/2026 | Người dùng: sau ổn định có idle nhẹ cả người và áo |
| D-004 | 05/11/2026 | Người dùng: PC model/worker, Claude hỗ trợ app, Codex đánh giá; owner Mac thực tế hiện là AI chat khác |
| D-005 | 05/11/2026 | Giai đoạn đề xuất: thun trước, sơ mi sau, không bỏ scope sơ mi |
| D-006 | 05/11/2026 | Người dùng: roadmap/process/agent là bộ đọc bắt buộc |
| D-007 | 05/11/2026 | Contract đề xuất ban đầu trong chat; bị phát hiện khác V2 hiện thực, không dùng làm wire integration |
| D-008 | 05/11/2026 | H-RESUME-002: tiếp nối SiTH004/V2 code, không dựng lại từ đầu, giữ pause UAC và owner Mac; V2 wire baseline phải qua gap review |

Template/engine đề xuất trong roadmap chưa là benchmark đạt. PC report body fitting không chứng minh toàn SiTH/clean body. Recommender hiện có code rules-v1, chưa phải Qwen. Tên model trong chat không tự thành quyết định tích hợp.

## 5. Blocker/đầu vào thiếu

| ID | Vấn đề | Owner / việc độc lập tiếp tục |
|---|---|---|
| B-001 | Chưa xem PC filesystem/checkpoint004 trực tiếp trong reviewer | PC xác nhận local, không restart workflow từ zero |
| B-002 | MSVC/nvdiffrast/admin UAC tạm dừng | Chủ dự án + PC; inventory delta/export debug/adapter skeleton vẫn làm |
| B-003 | Có demo theo report, bộ ảnh cá nhân/áo/quyền dùng đầy đủ chưa chứng minh | Chủ dự án + PC; fixture/demo ghi nhãn |
| B-004 | Hai contract không khớp, V2 transport/server gaps cần test/review | Mac owner + Codex/PC; không endpoint thứ hai |
| B-005 | Likeness/texture/garment/drape thật chưa có evidence đạt | PC + chủ dự án; contact sheet/GLB thật |
| B-006 | Mac active với dirty/untracked chưa bàn giao | Mac owner; Claude mới review read-only/patch proposal riêng |
| B-007 | Chưa Supabase thật/HTTPS/enrollment/handshake/two-owner GPU | Mac + PC; local tests/runbook, một owner trước |

RAM16GB đã có report, CPU/disk/mạng cần delta. Không đánh Blocked toàn dự án chỉ vì UAC; chỉ task phụ thuộc mới Blocked.

## 6. Evidence và mức tin cậy

| ID | Nguồn | Đã kiểm / giới hạn |
|---|---|---|
| E-DOC-001 | Root roadmap/agent/process/AGENTS | Docs local, không chứng minh pipeline |
| E-DOC-002 | [PC prompt](./docs/handoffs/prompt-pc-3d.md), [Mac prompt](./docs/handoffs/prompt-claude-3d.md) | Đã soạn lại theo resume; chưa gửi/receipt |
| E-PC-002 | Chat Tóm tắt tiến độ body fitting SiTH, ID01a1abfd-f4c9-70b2-836a-e1ae9d1be514 | Đọc report/checkpoint được thuật lại; chưa mở artifacts PC |
| E-MAC-002 | [Snapshot7files/hashes](./docs/handoffs/resume-snapshot-20261105/snapshot-manifest.json) | Filesystem thật + dirty status; snapshot không là accepted revision |
| E-RECON-002 | [Reassignment report](./docs/handoffs/reassignment-2026-11-05.md) | Branch/worktree/chat/source/contract đối chiếu |
| E-RES-001 | `/Users/khoihoang/Documents/fitmatch_AI-research/RESEARCH.md`, repository-manifest.json | Khảo sát04/11, chỉ nghiên cứu cũ; PC report mới ghi riêng |
| E-AUD-001 | [Audit](./docs/audit-full-2026-11-04.md), [brief audit](./docs/claude-implementation-brief.md) | Lịch sử khác baseline; fixes đã có trên nhánh local, không suy ra production |

Báo cáo cần nhận tiếp: PC resume-004-report và Mac mac-resume-report (path cụ thể trong prompt), assets/GLB/previews/checksums, patches/test logs. Chưa có file thì không tạo report rỗng để gọi đã nhận. Báo cáo synthetic và kết quả PC thật tách riêng; revision sau test phải được kiểm lại phù hợp.

## 7. Gate review

| Gate | Trạng thái | Kết luận | Thiếu gì |
|---|---|---|---|
| G0 | Có report/code một phần | NOT VERIFIED | Inventory delta/checkpoint/license và contract reconcile |
| G1 | Fitting body + viewer có ở nguồn khác nhau | NOT VERIFIED | Textured GLB/cá nhân/QA/compiler/report/code revision |
| G2/G3 | V2 app đang làm/test fixture | NOT VERIFIED | Full PC/real storage, reliability gaps, two-owner GPU và likeness |
| G4 | Chưa có bằng chứng | NOT VERIFIED | Sơ mi thật sau thun |
| G5 | Chưa mở | NOT VERIFIED | Bản tĩnh đạt rồi rig/idle/cloth/playback |

Reconciliation không phải review PASS. Codex review chính thức ghi report/artifact đã đọc, lỗi ưu tiên/owner/điều kiện retest. Chủ dự án/giáo viên duyệt likeness. Không giảm tiêu chí roadmap để biến kết quả chưa đạt thành Done.

## 8. Nhật ký theo thời gian — append, không xóa lịch sử

### L-001 — 05/11/2026 — CONTEXT — Codex

Đọc source AI/API và nghiên cứu/kế hoạch có sẵn để tư vấn phần cứng. Người dùng xác nhận RTX 3060 12GB, hai người dùng, ưu tiên avatar chân thực/tĩnh trước và idle cả người/áo sau. Chưa thao tác PC hoặc chạy model; không có benchmark trong chat này.

### L-002 — 05/11/2026 — HANDOFF PREPARED — Codex

Soạn kế hoạch thực thi ngày 05/11, hai prompt PC/Claude và worker contract v1; liên kết discovery/kế hoạch cũ. Kiểm local links, markdown fences và JSON ví dụ. Đây là chuẩn bị giao việc; chưa gửi message cho agent bên ngoài, chưa nhận báo cáo. Không sửa code app hoặc chạy app tests trong gói tài liệu này.

### L-003 — 05/11/2026 — START — CX-DOC-20261105-01 / DOC-01

Nhận yêu cầu tạo roadmap.md/process.md/agent.md và bắt buộc AI đọc trước làm. Đọc AGENTS/CLAUDE, kế hoạch hiện hành, contract, git status/HEAD và state cũ. State cũ là output generated khác thời điểm, không dùng làm tiến độ của luồng PC/Claude mới. Scope: tài liệu điều phối gốc + entrypoint/prompt liên quan; bảo toàn source đang bẩn.

### L-004 — 05/11/2026 — END / HANDOFF — CX-DOC-20261105-01

Đã tập hợp kế hoạch đầy đủ vào roadmap gốc, tạo process có task/session/decision/blocker/evidence/review/handoff và agent có quy trình đọc/claim/ownership. AGENTS/CLAUDE và hai prompt dẫn đúng thứ tự đọc; kế hoạch cũ được đánh dấu dùng roadmap làm nguồn hiện hành. Kiểm local links, fences/JSON và task ID consistency; không chạy app/GPU tests vì không sửa implementation. File lưu tại workspace, chưa commit/push/chuyển sang PC. DOC-01 Done; PC/Claude chưa nhận việc được xác nhận.

Mẫu entry tiếp theo:

```text
### L-<unique-id> — <ngày/giờ + timezone thực tế> — START / UPDATE / DECISION / TEST / HANDOFF / END
Session / task / baseline / process revision nguồn:
Việc đã làm và file thay đổi:
Bằng chứng/lệnh/kết quả (fixture hay real):
Blocker/giới hạn/quyết định và lý do:
Trạng thái mới, bước kế tiếp, bên tiếp nhận:
```


### L-005 — 05/11/2026 — START / CORRECTION — CX-RECON-20261105-02 / DOC-02

Người dùng yêu cầu giao lại việc theo phần đang dở. Claim phạm vi docs nguồn/snapshot/handoffs, không sửa code worktree active. Đọc root docs và kiểm git/chat; phát hiện PROC-0001 bỏ sót tiến độ PC và Mac khác, cần reconcile và giữ lịch sử cũ.

### L-006 — 05/11/2026 — RECONCILE / END — CX-RECON-20261105-02 / DOC-02

Đọc chat PC checkpoint004 và chat Mac active; kiểm worktree0ec92c6+dirty API/UI/SQL/Python/tests. Sửa snapshot PROC-0001 bỏ sót tiến độ; giữ L-001…005 như lịch sử. Snapshot7files có SHA256; phân biệt PC report, Mac code và tests synthetic. Soạn lại prompts/reassignment để tiếp nối compiler→texture→GLB và contract/recovery/integration; giữ UAC pause và owner Mac. Kiểm links/JSON/hash/task consistency, không chạy app/GPU suite hoặc sửa worktree active. DOC-02 Done, gate sản phẩm chưa PASS. Chưa dispatch/receipt PC/Claude.

## 9. Handoff

### H-DOC-001 — lịch sử PROC-0001, đã được H-RESUME-002 thay thế

Bản cũ giao PC-00/APP-00 như chưa có triển khai vì chưa kiểm các chat/worktree khác. Không dùng nó để xóa checkpoint hoặc tạo implementation song song. Các root rules/scope còn phù hợp tiếp tục áp dụng.

### H-RESUME-002 — hiện hành — PROC-0002

Gửi cả bộ [reassignment](./docs/handoffs/reassignment-2026-11-05.md), [PC prompt](./docs/handoffs/prompt-pc-3d.md), [Mac/Claude prompt](./docs/handoffs/prompt-claude-3d.md), root AGENTS/agent/roadmap/process, contract snapshot và manifest. Bộ ZIP local: `docs/handoffs/fitmatch-resume-20261105-002.zip`; không có weights/ảnh gốc/token.

PC xác nhận checkpoint004/TOOLCHAIN trước tiếp tục; Mac owner chốt revision/scope trước Claude sửa; Codex nhận report/artifacts thật để review. Chưa receipt không khai agent mới đang chạy. Chưa tự gửi message hoặc dispatch chat khác trong đợt này. Bên nhận đối chiếu local process/history rồi gửi delta, không đè process cũ lên bản chính.

AI mới: đọc tất cả → kiểm task/owner/checkpoint → ghi session+START → làm đúng scope → kiểm chứng → report+END/HANDOFF; nếu scope đang occupied thì chỉ review/chuẩn bị patch proposal độc lập.


### L-007 — 05/11/2026 — START — CX-CLEAN-20261105-03 / OPS-01

Chủ dự án yêu cầu dọn nhánh không liên quan để bắt đầu bộ điều hành mới. Đọc AGENTS/agent/roadmap/process, kiểm refs/worktree/status và ancestry: app-system-authc05551c và fix-audit-followup824c3fa đều nằm trong Studio hiện tại. Studio đã lên d2a9898 và sạch lúc kiểm, source main vẫn dirty và không có merge-base với Studio; tuyệt đối không merge/reset main. Hai worktree nhánh cũ sạch tracked/untracked nhưng có ignored config/build/dependency, giữ toàn bộ thư mục/file. Phạm vi: backup git refs+bundle, detach hai worktree cũ, xóa hai local branch refs đã backup, tài liệu/report; không xóa remote, source, env, GPU assets hoặc code Studio.


### L-008 — 05/11/2026 — END / VERIFY — CX-CLEAN-20261105-03 / OPS-01

Đã tạo tags archive/20261105/app-system-auth và archive/20261105/fix-audit-followup, pre-cleanup.bundle verify+SHA256. Kiểm hai commit đều ancestor Studio; detach worktrees cũ tại chỗ, xóa hai local branch refs theo yêu cầu. Còn main và codex/3d-studio-worker; HEAD source/Studio không đổi, Studio sạch, file/env cũ còn nguyên. Git có warning config.lock khi dọn config branch; refs đã xóa và kiểm thành công, không còn branch config sections; không tự xóa lock của phiên khác. Không chạm remote/PC hoặc reset/merge source. Report và restore instructions ở docs/reports/review/branch-cleanup-20261105/. Không chạy app/GPU test vì chỉ metadata/docs.

### H-CLEAN-003 — hiện trạng Git sau dọn — PROC-0003

[Report cleanup](./docs/reports/review/branch-cleanup-20261105/README.md), [manifest](./docs/reports/review/branch-cleanup-20261105/manifest.json). Bộ handoff mới PROC-0003 tại `docs/handoffs/fitmatch-resume-20261105-003.zip`; ưu tiên hơn ZIP002 về trạng thái Git. Hai archive worktree chỉ để tham chiếu, không bắt đầu implementation mới ở đó. Mac tiếp tục nhánh Studio d2a9898 hoặc commit mới hơn sau khi kiểm; PC tiếp tục checkpoint004 theo H-RESUME-002. Main chỉ giữ nguyên tài liệu/source đang dirty, chưa hợp nhất hoặc push bộ điều hành. Nhánh remote không xóa trong phạm vi cleanup local.


### L-009 — 05/11/2026 — DISTRIBUTION — Codex / H-CLEAN-003

Chủ dự án/PC báo chưa có tài liệu trên PC/GitHub/Drive. Xác nhận trước đây chỉ có ZIP local, chưa phân phối. Đã dùng Google Drive skill upload ZIP PROC-0003 vào My Drive riêng tư, readback metadata xác nhận tên/MIME application/zip/66288 bytes, shared=false. Link: https://drive.google.com/file/d/1d2FAA8qNpGGIlMkwbd4w-CAJSUT75eYQ/view?usp=drivesdk . SHA256 ZIP: 5e0e32d4a83622c533c3aef3dbb8dda43a4de9cade14041c1d7d292034108d4d . Không đổi sharing/public, chưa push GitHub, chưa chép trực tiếp sang filesystem PC. PC cần tải/giải nén staging, đối chiếu process/checkpoint local trước áp dụng; giữ tạm dừng MSVC. ZIP là snapshot trước entry phân phối này, không thay file/archive đã tải lên để tránh sai checksum. Task distribution tài liệu hoàn tất, receipt PC vẫn chờ.


### L-010 — 05/11/2026 — START — CX-PUBLISH-20261105-04 / OPS-02

Chủ dự án cho phép đưa bộ điều hành/handoff lên GitHub để PC/Mac đọc chung. Scope: nhánh tài liệu `codex/project-operations`, chỉ root rules/roadmap/process, docs hỗ trợ và snapshot; không push source đang dirty, bundle/ZIP/env/model/ảnh cá nhân, không merge/deploy/migration. Kiểm remote trước publish, dùng checkout tách biệt để bảo toàn main và Studio. GitHub là nguồn tài liệu chính sau khi push+readback thành công; ZIP/Drive giữ lịch sử.


## Nguồn đồng bộ GitHub — OPS-02

Chủ dự án đã cho phép publish bộ điều hành/handoff trên nhánh tài liệu `codex/project-operations`. Xem [github-sync.md](./docs/handoffs/github-sync.md) để đọc/clone/pull và gửi report/PR đúng scope. Không dùng ZIP mỗi lần; không merge nhánh tài liệu vào checkpoint code một cách mù. Repo công khai nên chỉ publish tài liệu/report đã loại secrets và dữ liệu cá nhân không cần thiết. Đây là ngoại lệ cho hạn chế push tài liệu cũ trong file này; hạn chế push app/deploy/migration vẫn giữ nguyên. Trạng thái publish thực tế được xác nhận qua remote readback trước bàn giao.


### L-011 — 05/11/2026 — PUBLISHED / HANDOFF — CX-PUBLISH-20261105-04 / OPS-02

Đã push commit874f4dc4c96aff3904dab18625be9fe4ef6cf6ab lên `origin/codex/project-operations`, từ remote mainac26306 trong checkout publish riêng. `git ls-remote` xác nhận remote SHA và GitHub contents API readback agent.md/reassignment thành công. 30 file rules/roadmap/process/docs/snapshot, không ZIP/bundle/env/weights/source app. Kiểm relative links/fences/JSON/task IDs, credential-pattern scan và staged paths. Không merge main/deploy/migrate, không đổi nhánh/công việc đang dở PC/Mac. Nhánh docs mới được chủ dự án cho phép, ngoại lệ chính sách chỉ hai nhánh local sau cleanup. Commit tiếp theo chỉ ghi nhận publication này; chưa có receipt PC/Mac nên không tự cập nhật họ đang làm.

### H-GITHUB-004 — nguồn hiện hành

https://github.com/minkoi007cs/fitmatch_AI/tree/codex/project-operations . Đọc docs/handoffs/github-sync.md để clone/pull checkout tài liệu riêng và gửi report/PR. PC/Mac đọc cùng ref/commit thay chuyển ZIP; process cập nhật có evidence, không overwrite bản cũ. Production app/main không thay đổi. Root local và publication checkout giữ cùng nội dung bộ điều hành ở lần publish này; bản copy trên worktree Studio/PC cần đọc GitHub hoặc fetch riêng, chưa tự chép đè.


### L-012 — 05/11/2026 — START — CX-REVIEW-20261105-05 / QA-01A review

Nhận report Claude CL-REVIEW-20261105-01. Scope Codex: đọc/đối chiếu/reproduce độc lập, review proposal, nhập process delta và giao sửa cho owner Mac; không sửa Studio implementation. Đã đọc root rules/roadmap/process, source tại d2a9898 sạch; SHA256 migration/worker khớp report. Test reviewer dùng Docker PostgreSQL16 network-none và loopback worker mock riêng; không Supabase/PC thật. Bắt đầu review, chưa gate PASS.

### L-013 — 05/11/2026 — REVIEW / HANDOFF — CX-REVIEW-20261105-05

Đã nhận delta Claude CL-REVIEW-20261105-01: read-only d2a9898 sạch; report/proposal/repro trong docs/reports/claude/. Codex kiểm hash khớp, chạy lại SQL PostgreSQL16 cô lập:14/14 reproduced, proposal11/11; worker W1/W2 reproduced; Sharp đúng0.35.5 cho PNG alpha nền đen. Không full app suite/Supabase/PC/GPU thật. APP-01 chuyển Changes requested, gate3D NOT VERIFIED. Complete đã commit thì R1 vẫn succeeded; finalize xong nhưng complete chưa commit mới có nguy cơ failed/rerun. Proposal chưa duyệt áp nguyên bản: thiếu persistent recovery, generation readers/race, RPC compatibility, GPU-host locking; scripts cần exit nonzero khi assertion fail. Owner Mac làm FIX-MAC-01…07 theo handoff mới, Claude chưa tự sửa implementation. MSVC pause giữ nguyên. Session Claude và Codex review kết thúc; chưa có receipt sửa code của owner.

### H-REVIEW-005 — việc kế tiếp — PROC-0005

[Kết luận review](./docs/reports/review/claude-review-20261105/review.md), [lệnh owner Mac](./docs/handoffs/prompt-mac-recovery-fixes.md). Owner hiện hữu ưu tiên FIX-MAC-01/02/03 trước live; cache/alpha/privacy và two-owner GPU theo acceptance. Claude review/retest, chỉ sửa implementation sau handoff revision/file scope. PC tiếp tục local toolchain/inference theo pause UAC, không đổi worker live trước chốt protocol. Codex nhận diff/commits/tests/artifacts để review lại; bug repro không có nghĩa sản phẩm PASS.


### L-014 — 05/11/2026 — START — CX-PROGRESS-20261105-06

Người dùng yêu cầu đánh giá tiến độ Claude và tiếp tục giao việc. Scope: kiểm report/commit/PR/chat, phân công gói implementation riêng và publish docs, không sửa Studio. Kiểm Studio sạch tại d2a9898, không commit recovery mới, remote docs17b77fe và không open PR. Chat owner Mac đã completed/idle với bàn giao S1, không có receipt FIX-MAC-01…03. Claude external không truy cập live được từ công cụ này; không suy luận đang chạy/dừng từ status Mac. Report hiện có vẫn CL-REVIEW-20261105-01.


### L-015 — 05/11/2026 — ASSIGN / END — CX-PROGRESS-20261105-06

Đánh giá: Claude hoàn tất review/repro, chưa có evidence code sửa mới. Studio vẫn d2a9898 clean; không PR mới. Chat owner Mac đã idle/completed ở bàn giao S1, không tự xem là quyền chiếm worktree. Theo yêu cầu mới của chủ dự án, giao Claude implementation giới hạn R1 (FIX-MAC-01/02/03) trên nhánh/worktree riêng từ d2a9898, giữ canonical Studio nguyên trạng; đây là scoped handoff cho nhánh task, chưa quyền merge/push app/live. Receipt phải ghi revision/scope trước code; chưa receipt vẫn Assigned, không In progress. Không rerun các repro cũ trong lượt này vì không source delta. Report [progress](./docs/reports/review/claude-progress-20261105.md), lệnh [Claude R1](./docs/handoffs/prompt-claude-recovery-r1.md).

### H-CLAUDE-R1-006 — hiện hành

Claude nhận gói implementation R1 trên `codex/worker-recovery-r1`/worktree riêng, baseline d2a9898 kiểm lại. Source scope worker transport/control plane/grants và tests, chưa PC adapters hoặc viewer/quiz/cache/animation. Read-only cũ được thay cho đúng nhánh task/phạm vi này; bản canonical vẫn owner cũ giữ tới review. Bước đầu: receipt file `docs/reports/claude/recovery-r1-receipt.md`, sau sửa report/finalSHA/tests. Không tự coi agent đã nhận/running vì prompt có trên GitHub; chưa khởi chạy hoặc gửi vào Claude external từ công cụ này.

| Gói tiếp nối | Bên được giao | Trạng thái | Điều kiện tiếp theo |
|---|---|---|---|
| R1A / FIX-MAC-01 | Claude trên nhánh task riêng | Assigned | Receipt + durable upload/complete recovery + tests invocation count |
| R1B / FIX-MAC-02 | Claude trên nhánh task riêng | Assigned | Safe claim redelivery/crash/race + tests |
| R1C / FIX-MAC-03 | Claude trên nhánh task riêng | Assigned | Grants/default deny, mismatch/error classification + tests |
| Review R1 | Codex | Planned | Chờ finalSHA/diff/full suite/recovery artifacts, không duyệt từ proposal |
| R2 (cache/alpha rồi hostGPU/privacy) | Chưa nhận | Planned | Chỉ giao tiếp sau review R1 |


### L-016 — 05/11/2026 — START — CX-ASSIGN-20261105-07

Người dùng yêu cầu giao PC và Claude chạy tiếp trước khi tiếp tục phỏng vấn sản phẩm; cung cấp report PC OPS004-02 và draftPR1. Đã đọc root docs và PR1 head4ee404d, ba file report/delta/evidence, chưa merge. 21 CPU tests là báo cáo PC, source adapter local chưa reviewer mở/rerun; không gate PASS. Scope lượt này: giao CPU conformance/docs cho PC giữ MSVC pause, Claude tiếp R1, publish docs và dispatch PC hiện hữu khi có tool/host xác nhận. Không mở rộng tính năng trong lúc phỏng vấn chưa chốt.

### L-017 — 05/11/2026 — ASSIGN — H-PAIR-007

Đã đọc draftPR1 head4ee404d gồm ba PC docs, ghi nhận receipt checkpoint004/adapter disabled và reported21CPU tests, chưa merge hay xem source GPU local. PC-00 Ready for review phần receipt/inventory; PC-01 tiếp tục, PC-03 vẫn Blocked UAC, PC-05 chỉ skeleton scope Ready for review, full task chưa đạt. Giao PC-CONF-01 CPU-only contract/error mapping/fixture coverage/report và sửa encoding PR; Claude tiếp R1 implementation riêng, nhận mapping theo thực tế exit78 thay đoán. Phỏng vấn sản phẩm vẫn đang chờ trả lời câu đầu; hai gói này chỉ kiểm chứng/recovery kỹ thuật, không mở feature scope.

### H-PAIR-007 — việc chạy độc lập

[Lệnh PC + Claude](./docs/handoffs/pc-claude-next-20261105.md). PC-CONF-01 Assigned trước receipt mới;21 tests là report chứ chưa reviewer rerun. Claude R1 vẫn Assigned trước receipt. DraftPR1 giữ draft/unmerged; PC code/weights/fitting local và engines rỗng. MSVC pause chưa gỡ; G0/G1/real integration vẫn NOT VERIFIED. Dispatch/receipt ghi riêng bên dưới khi có kết quả tool, không tự gọi cả hai đang chạy.


### L-018 — 05/11/2026 — DISPATCH PC — H-PAIR-007

Đã publish5793e01 và remote readback. Chủ dự án cho phép giao PC chạy; dùng send_message_to_thread gửi đúng chat PC “Khảo sát pipeline GPU Fitmatch AI”, thread01a1aa1b-fb39-7ab2-9ca0-1b5e637c9fae, host remote-control đã discover. Tool xác nhận gửi thành công; chưa có receipt/completion mới nên chưa đánh In progress/Done. Claude external không có endpoint gửi trực tiếp; prompt H-PAIR-007 đã sẵn cho chủ dự án chuyển, không giả đã khởi chạy Claude. MSVC pause giữ nguyên.


### L-019 — 05/11/2026 — START — CX-PRODUCT-20261105-08 / SPEC-01

Phỏng vấn từng câu theo yêu cầu người dùng đã có đầy đủ quyết định cốt lõi: D>A>B>C, avatar video/số đo/auto+edit, mặt>dáng>tóc/da, mục tiêu15–30phút, wardrobe-first tùy chọn, thun+jeans bản đầu, ảnh đồ front/back flat, chọn món nền và save bộ, AI3 bộ owned-only theo quiz+occasion, render lookbook, remote website/mobile capture/private accounts và retention user choice. Claim chỉ docs/spec/roadmap/process, không source app/PC. Chốt rõ scope mới khác shirt-only cũ; feasibility chưa được chứng minh từ CPU/transport tests. Không tự đổi nhiệm vụ PC-CONF/R1 đang giao hoặc gỡ MSVC pause.


### L-020 — 05/11/2026 — SPEC / END — CX-PRODUCT-20261105-08 / SPEC-01

Hoàn tất phỏng vấn cốt lõi27quyết định và lưu docs/product-requirements-2026-11-05.md. Chủ dự án ưu tiên D>A>B>C, video/ảnh mặt/số đo, auto+edit slider+lời, mặt>dáng>tóc/da, target15–30phút tùy kết quả và draft user choice. Wardrobe hiện hữu là trung tâm: upload mobile/desktop, front/back flat cho áo, thun+jeans first release, slot riêng/giữ món còn lại/save bộ, pending selected-only autoapply, thêm đồ/ảnh avatar thứ tự tùy ý. Owned-only3looks theo quiz+occasion; render3D lookbook đúng đồ/góc/nền trước generative. Mỗi tài khoản wardrobe riêng, remote website+homePC, retention source user chọn giữ/xóa. UI giao Codex chọn trung tính/chân thực/dễ phối. Chưa deadline/ngân sách paid, chi phí xem sau PC benchmark.

Roadmap/rules đã cập nhật scope mới ưu tiên hơn shirt-only snapshot. Đánh giá: nền tảng queue/cache/viewer/wardrobe phù hợp, nhưng face editor/video/jeans/latency là gaps chưa chứng minh; không chạy tests cũ để giả đóng quality gate. Các package DISC/APP mới Planned, không tự dispatch hoặc đổi scope R1/PC-CONF/MSVC pause. Không sửa implementation, không triển khai paid/cloud/deploy.

### H-SPEC-008 — yêu cầu sản phẩm hiện hành

[27quyết định và assessment](./docs/product-requirements-2026-11-05.md). R1/PC-CONF tiếp scope cũ, chưa feature expansion; trước nhiệm vụ quality/UX mới đọc SPEC-01. Bản dùng thử thun-only có thể đánh giá spike, chưa full first release.

| Package mới | Owner dự kiến | Trạng thái | Điều kiện |
|---|---|---|---|
| SPEC-01 | Codex | Done | Phỏng vấn/requirements/roadmap/docs consistency, không product PASS |
| DISC-AV-01 | PC + Codex review | Planned | Capture video/ảnh/số đo, face likeness, đo target15–30phút; toolchain pause vẫn giữ |
| DISC-EDIT-01 | PC/Claude theo file scope khi được giao | Planned | Edit thật slider+lời, mặt ưu tiên, version/preview |
| DISC-DENIM-01 | PC + Mac khi được giao | Planned | Jeans ảnh thật + thun trên cùng body, texture/form/slots |
| APP-FLOW-01 | Mac/Claude khi được giao | Planned | Mobile capture/remote, onboarding linh hoạt, background selection-safe, privacy |
| APP-AI-01 | Mac/Claude khi được giao | Planned | 3 full look owned top+jeans theo quiz+occasion |
| APP-RENDER-01 | Mac/Claude khi được giao | Planned | Render avatar/outfit đúng scene/version/góc/nền |
| PILOT-01 | Hai bên + Codex/user QA | Planned | Hai wardrobe riêng, full journey/likeness/reliability thật |
