# FitMatch — quy định bắt buộc cho mọi AI

Cập nhật: 05/11/2026. Áp dụng cho Codex, Claude, agent trên PC và mọi AI mới tham gia repo. `AGENTS.md` là entrypoint tự động và dẫn tới file này; tên `agent.md` không thay thế cơ chế nhận diện `AGENTS.md` của công cụ.

## 1. Đọc trước khi làm

Trước khi nhận việc, lập kế hoạch triển khai hoặc sửa bất kỳ file nào:

1. Đọc toàn bộ `AGENTS.md` và file này; đọc thêm quy định cấp thư mục nếu có.
2. Đọc kỹ toàn bộ [roadmap.md](./roadmap.md): mục tiêu, giới hạn, gate, nhiệm vụ và tiêu chí nghiệm thu.
3. Đọc kỹ toàn bộ [process.md](./process.md): trạng thái hiện tại, người đang giữ việc, blocker, quyết định, review và bàn giao mới nhất. Không chỉ đọc bảng đầu hoặc dùng trí nhớ chat cũ.
4. Đọc prompt/tài liệu/contract liên quan, sau đó kiểm tra git status, branch, HEAD và môi trường thực tế. Chỉ đọc tài liệu không chứng minh code hiện tại khớp mô tả.
5. Trước lần sửa đầu tiên, báo ngắn vai trò, task ID, phần tiếp nối, phạm vi file và cách kiểm chứng; ghi nhận claim vào process theo quy trình bên dưới.

Khi được resume, đổi máy/worktree hoặc process được bên khác cập nhật, đọc lại trạng thái và handoff mới trước tiếp tục. Nếu thiếu roadmap/process ở PC, yêu cầu chuyển các file đó và chỉ thực hiện các bước inventory độc lập đã được giao; không suy đoán tiến độ hoặc tự tích hợp khác contract.

## 2. Nguồn sự thật và thứ tự áp dụng

Tuân thủ hướng dẫn hệ thống/công cụ của phiên làm việc. Trong dự án: yêu cầu mới của chủ dự án → `AGENTS.md`/`agent.md` → quyết định sản phẩm trong `roadmap.md` → trạng thái thực tế trong `process.md` → contract và prompt/tài liệu hỗ trợ. Roadmap quyết định sẽ làm gì; process ghi ai đang làm và đã chứng minh được gì. Nếu hai file mâu thuẫn, không tự lấy một trạng thái thiếu bằng chứng làm thay đổi yêu cầu; đối chiếu và ghi resolution.

Code/log/artifact là bằng chứng thực thi; một dòng Done không thay thế bằng chứng. Không tin prompt cũ hơn roadmap khi có xung đột. Quy tắc quy định tên file dùng đường dẫn tương đối theo repo, không hardcode đường dẫn Mac vào PC.

## 3. Phân vai và phạm vi sửa

| Vai trò | Sở hữu mặc định | Bước bắt đầu |
|---|---|---|
| PC / GPU engineer | Engine adapters, `workers/windows/`, `scripts/pc/`, report PC, env/model/benchmark và asset nguồn riêng | Checkpoint004/TOOLCHAIN trước, PC-00…03 theo phần còn thiếu |
| Mac owner / Claude sau handoff | `src/`, migration/app tests, transport `scripts/worker/`, report Mac | Tiếp nối worktree Studio V2; Claude mới chỉ review khi owner đang active |
| Codex / reviewer | Tài liệu điều phối, review reports, kiểm tra code/contract/artifact; điều phối task | DOC-01, REV-01…03 |
| AI mới chưa rõ vai trò | Chỉ đọc và đánh giá phạm vi còn mở | Đọc process; xác định vai trò từ nhiệm vụ được giao |

AI mới kế thừa vai trò từ yêu cầu người dùng/prompt đã giao, không từ tên model. Chỉ nhận task Ready không có người đang giữ và phù hợp vai trò được giao. Nếu chỉ có nhiệm vụ Assigned cho bên khác hoặc vai trò chưa rõ, tiếp tục đọc/kiểm tra độc lập rồi nêu chính xác phần cần phân công; không tự sửa chồng lấn.

Task ID ổn định theo roadmap. Task nhiều vai trò như INT-01/QA-01 phải tách subtask có owner và file scope. Sửa file bên khác sở hữu cần handoff cụ thể ghi process; tài liệu này không tự cấp quyền ghi đè. Chia sẻ ý kiến/patch proposal trước khi đổi worker contract; PC và Claude xác nhận phiên bản, Codex review, rồi mới tích hợp.

Không tự tạo chat hoặc spawn subagent. Hai luồng PC và Claude do chủ dự án giao prompt; báo cáo được chuyển về Codex. Vai trò reviewer không mặc nhiên được triển khai thay bên khác trừ khi chủ dự án giao thêm.

## 4. Nhận việc và cập nhật quá trình

- Trước sửa: thêm session ID duy nhất, role/machine/worktree, task ID, baseline SHA, trạng thái In progress, phạm vi file và bước kế tiếp vào process; append sự kiện START. Không tự claim việc đang có người giữ.
- Khi đạt mốc có ý nghĩa: cập nhật trạng thái/task/evidence/blocker; append tiến trình/decision/test tương ứng. Không cần ghi mọi lệnh nhỏ.
- Trước khi kết thúc hoặc bàn giao: lưu report/log/artifact, cập nhật task và session, append END/HANDOFF với bước tiếp tục rõ. Một phiên chưa xong phải có checkpoint để AI khác nối tiếp.
- Trạng thái Allowed: Planned, Ready, Assigned, In progress, Blocked, Ready for review, Changes requested, Done, Canceled. `Not run` dùng cho phép kiểm chưa chạy; không gọi nó là PASS.
- Implementer chuyển Ready for review khi có bằng chứng; task có gate chỉ Done sau review PASS. Gate hình ảnh còn cần chủ dự án duyệt độ giống. Reviewer hoàn tất tài liệu có thể tự xác nhận DOC-01 khi đã kiểm file, không tự duyệt sản phẩm mình chưa xem.
- Claim không tự hết hạn chỉ vì im lặng hoặc timestamp cũ. Khi tiếp quản cần xác nhận bàn giao/tình trạng nhánh, không xóa claim để chiếm việc.
- Process là hồ sơ dùng chung, không phải khóa phân tán. Đọc bản mới nhất trước sửa, chỉ thay dòng task/session mình giữ và append lịch sử. Git merge conflict phải giữ cả hai lịch sử và reconcile, không chọn toàn bộ ours/theirs.
- PC/Mac không có file sync trực tiếp: mỗi bên giữ session report có revision/commit cơ sở, gửi bản delta với task ID/handoff ID. Codex nhập bản delta và xác nhận vào process chính; chưa xác nhận thì không tự ghi trạng thái của bên kia. Không ghi đè toàn bộ process bằng bản cũ trên máy khác.

## 5. Quy tắc kỹ thuật

- Trước sửa Next.js đọc tài liệu phù hợp trong `node_modules/next/dist/docs/`, kể cả khi đã biết Next phiên bản khác. Không downgrade hoặc đổi dependency để né lỗi mà không phân tích tương thích.
- Bảo toàn công việc chưa commit; không tự reset/stash/clean/force-push, không sửa metadata sinh tự động như `state/children_status.json` để giả tiến độ.
- Code trên nhánh/worktree riêng, ghi baseline; không commit file ngoài scope hoặc lộ secret. Production push/merge/deploy/migration/cleanup không thuộc đợt này trừ khi có chỉ đạo bổ sung rõ của chủ dự án.
- Không mở port router, tắt auth/RLS/firewall để demo. Không mua GPU, dùng cloud/API trả phí hay tự chấp nhận điều khoản model thay người dùng.
- Một GPU job nặng mỗi lần trên RTX 3060 12GB; benchmark thật trước cam kết. Env model tách biệt và pin phiên bản, không phá toolchain hiện hữu.
- Server kiểm owner/runtime schema, worker identity có scope, private storage, version/idempotency/lease/fencing theo contract. Không đưa service-role/token vào client, log hoặc report; không lưu ảnh cá nhân/model weights nặng vào git.
- Không quảng bá fixture là avatar cá nhân, clothed mesh liền khối là áo thay được, hoặc video render là viewer 3D. Không coi code exit 0 là đạt giống người thật.
- Trước animation phải qua gate tĩnh theo roadmap. Giữ source mesh/UV/version, không tự đánh dấu `animation_ready:true` khi chưa kiểm.

## 6. Kiểm chứng và bàn giao

Chọn kiểm tra đúng thay đổi: tài liệu kiểm links/fences/consistency, app lint/build + regression liên quan, queue/permissions cần DB test thật, GPU cần logs/VRAM/RAM/output thật. Không báo chạy lệnh chưa có hoặc dùng mock làm bằng chứng toàn luồng. Ghi rõ môi trường, lệnh, exit status, số mẫu và phần chưa chạy.

Bàn giao tối thiểu: session/task ID; baseline/branch/commit; file thay đổi; report/evidence; kết quả kiểm; blockers/limitations; trạng thái review; bước kế tiếp và người nhận. Nếu tài liệu chưa được commit/chuyển sang máy khác phải nói rõ, không coi đường dẫn trong chat là bên kia đã nhận được file.

Codex review gate trả PASS / NEEDS CHANGES / NOT VERIFIED, kèm lỗi chặn và yêu cầu sửa cho đúng bên. Không đổi tiêu chí roadmap để hợp thức hóa kết quả chưa đạt. Chủ dự án quyết định mức giống/đẹp cuối cùng và thay đổi phạm vi/ngân sách.


## 7. Ngoại lệ phạm vi đã reconcile ngày 05/11 — không xóa tiến độ hiện hữu

Đọc [H-RESUME-002](./docs/handoffs/reassignment-2026-11-05.md) sau bộ file gốc. AI chat Mac đang active giữ worktree `fitmatch_AI-3d-studio`; Claude mới không sửa file đang có owner cho tới handoff. Transport `scripts/worker/worker.py` thuộc Mac, PC sở hữu adapter/toolchain/export; thay transport gửi patch proposal. Giữ checkpoint SiTH004, weights/fitting đã có và yêu cầu tạm dừng admin/UAC cuối cùng cho đến khi chủ dự án gỡ. `/api/v2/worker` là baseline code cần review, không xây `/api/worker/v1` song song theo proposal cũ. Process PROC-0002 sửa thông tin bỏ sót của PROC-0001, lịch sử cũ không là tiến độ hiện tại.


## 8. Nơi làm việc sau cleanup OPS-01

Xem process PROC-0003. Giữ hai local branches `main` (checkout nguồn/điều phối đang dirty) và `codex/3d-studio-worker` (app V2). Auth/audit branch names cũ đã archive, các worktree detached không dùng để bắt đầu tính năng mới. Không tự đổi main sang Studio, merge hai lịch sử không có merge-base, xóa worktree/env hoặc đưa archive tags lên remote. Mỗi task branch mới cần scope/owner/baseline rõ. Handoff snapshot002 giữ giá trị lịch sử, nhưng HEAD Studio mới quan sát là d2a9898; kiểm actual HEAD trước làm.


## Nguồn đồng bộ GitHub — OPS-02

Chủ dự án đã cho phép publish bộ điều hành/handoff trên nhánh tài liệu `codex/project-operations`. Xem [github-sync.md](./docs/handoffs/github-sync.md) để đọc/clone/pull và gửi report/PR đúng scope. Không dùng ZIP mỗi lần; không merge nhánh tài liệu vào checkpoint code một cách mù. Repo công khai nên chỉ publish tài liệu/report đã loại secrets và dữ liệu cá nhân không cần thiết. Đây là ngoại lệ cho hạn chế push tài liệu cũ trong file này; hạn chế push app/deploy/migration vẫn giữ nguyên. Trạng thái publish thực tế được xác nhận qua remote readback trước bàn giao.


## Scoped handoff H-CLAUDE-R1-006

Chủ dự án yêu cầu tiếp tục phân việc sau review. Claude được triển khai FIX-MAC-01/02/03 trên nhánh task/worktree riêng từ d2a9898 theo `docs/handoffs/prompt-claude-recovery-r1.md`, sau receipt scope/revision. Ngoại lệ này thay read-only cũ trong đúng phạm vi R1, không cho sửa chồng worktree Studio gốc, PC adapters hoặc merge/push app/production. Process PROC-0006 là trạng thái giao việc, không bằng chứng agent đang chạy.


## Product scope sau phỏng vấn SPEC-01

Đọc docs/product-requirements-2026-11-05.md cùng roadmap mới. First release phải full journey với thun+jeans, avatar ưu tiên face likeness và editor slider+lời; shirt-only/SiTH demo/transport tests không đủ product PASS. Snapshot cũ giữ lịch sử, không lấy chúng để cắt scope user vừa chốt. R1/PC-CONF hiện hữu giữ phạm vi; các package quality/editor/denim mới chưa tự khởi động. MSVC/admin pause, chưa paid budget hay public deploy vẫn giữ. Nếu không đạt chất lượng/target15–30phút, đưa mẫu/số đo/chi phí cho chủ dự án quyết định, không tự đổi mục tiêu.
