# H-EXEC-009 — thực thi full áo thun + jeans, tận dụng hiện trạng

05/11/2026. Chủ dự án yêu cầu giao PC setup render/download model/chạy AI, Claude triển khai code, Codex review. Thay chỉ dẫn dừng ở CPU-only của H-PAIR-007 và chưa assign DISC của SPEC-01 trong đúng scope bên dưới; không xóa checkpoint hay tự bỏ yêu cầu sản phẩm. Đọc root rules/roadmap/process và SPEC-01 trước làm.

## 1. Baseline phải tái sử dụng

| Bên | Hiện có | Không làm lại |
|---|---|---|
| PC | Checkpoint SiTH004, SMPL-X/weights/env/body fitting, local adapter disabled và validator; PR1 head60949e8 báo11 targeted CPU cases+2regressions,1symlink Not run | Không tải lại weights/cài lại env hoặc rerun fitting nếu checkpoint hợp lệ |
| Mac | Studio S1/V2 d2a9898, viewer/import/quiz/looks/queue/private storage/worker | Không scaffold app/queue/viewer mới |
| Claude | R1 finalafc37ff từ d2a9898, report/receipt trên nhánh docs/claude-CL-RECOVERY-R1-20261105-01; bundle+diff+logs local Mac | Không viết lại recovery, đọc/review/retest rồi tiếp đúng nhánh task |
| Codex | Repro review baseline, full SPEC-01, roadmap và shared docs branch | Không coi report PASS là independent verification |

R1 bundle trên Mac `claude-handoff-local/worker-recovery-r1/worker-recovery-r1.bundle` đã `git bundle verify` okay, refafc37ff; đây mới là object-integrity check, chưa code acceptance. App R1 source chưa push; docs shared không chứa source bundle/secrets.

## 2. Critical path và deliverables

| Thứ tự | PC | Claude | Cổng kết quả |
|---|---|---|---|
| E0 — tiếp nối / vận hành | Hardware/env delta + model inventory, renderer dùng được, report MSVC cụ thể | Tiếp R1afc37ff, xử lý các gap mapping/Windows fail-closed và scope tests | Lệnh chạy tái lập; partials/blockers riêng, không chờ mọi thứ mới report |
| E1 — người/đồ đầu tiên | Một body/avatar thật từ pipeline hiện hữu, một thun và một jeans tách riêng; texture từ ảnh được phép dùng, chung pose/scale | Slot top/bottom, fixture manifest thật về cấu trúc và adapter E2E + scene load | Turntable/GLB thật và hình thun+jeans trong viewer; mẫu template ghi đúng provenance |
| E2 — wardrobe full flow | Canonical áo/quần + per-avatar fitting, adapter output/error mapping, benchmark | Upload→background jobs→slot swap→save/reopen, selected-only autoapply, xử lý đồ trước avatar | Một bộ đồ thật từ2ảnh mỗi món, mở lại không inference |
| E3 — avatar cá nhân / editor | Video/frame/face/measure processing thật; thông số edit có tác dụng, không chỉ scale | Capture video/ảnh/số đo, draft/retention; slider+lời theo capability thật, version preview | Chủ dự án nhận ra mình; target15–30phút được đo, báo lệch nếu chưa đạt |
| E4 — pilot đầy đủ | Một GPU dispatcher, restart/recovery Windows, self-test capability | Owned3look quiz+occasion, render lookbook góc/nền, remote/two-user privacy | Hai tài khoản dùng từ xa; likeness, quần áo, full flow đủ evidence |

E1 là minh chứng kỹ thuật, không được báo hoàn chỉnh sản phẩm nếu còn demo body/preset clothes hoặc chưa E3/E4. Có thể làm UI/state/contract bằng fixtures đồng thời PC chạy quality spike, nhưng phân biệt rõ fixture và inference thật. Đưa mẫu sớm từng mốc, không polishing toàn UI hoặc thêm8model trước có người+top+jeans.

## 3. Bộ phần mềm/model PC được giao

### P0 — các thành phần 3D và render cần ngay

1. **SiTH + SMPL-X/checkpoints hiện hữu:** giữ checkpoint/body fitting, kiểm hash những file cần stage tiếp; chỉ tải thành phần thiếu thật từ nguồn chính thức có quyền dùng. SiTH là ứng viên textured-human baseline, không tự là clean body/clothes separation/face editor. Nguồn: https://github.com/SiTH-Diffusion/SiTH .
2. **GarmentCode + simulator đúng bản:** tận dụng env/repo PC đã có, template top và pants làm baseline có kiểm soát. Repo có Pants program, không tự nhận jeans từ ảnh đã giải quyết; denim silhouette/texture/pockets/seams phải adapter/QA. Không yêu cầu thêm số đo áo/quần âm thầm ngoài capture front/back đã chốt. Nguồn: https://github.com/maria-korosteleva/GarmentCode .
3. **Blender renderer/export/QA:** dùng bản installed hợp lệ hoặc portable chính thức, pin version và executable path. Script headless test tải GLB/body+top+jeans và render front/side/back/turntable, ánh sáng/nền trung tính; output log cho biết CPU/CUDA/OptiX thực tế, không nói GPU vì torch chạy được. Một tiny scene smoke trước scene người. Không cài installer không rõ nguồn hoặc system-wide nếu portable đủ.

### P1 — AI đọc ảnh/lời, không chặn thun+jeans

4. **Qwen3-VL-4B-Instruct**: tải **một** checkpoint/model revision phù hợp từ https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct , đọc model card/license và runtime hỗ trợ. Đây là Image-Text-to-Text, không tạo mesh người/áo/quần. Dùng để thử garment attributes JSON, hiểu yêu cầu edit/ranking candidates; rule-based owned-item recommender vẫn chạy được trong lúc chưa có VLM.
5. Tách env serving khỏi SiTH torch2.1; không upgrade torch đang chạy SiTH để đáp ứng Qwen. Kiểm RAM16GB/VRAM12GB và headroom hiện tại, chọn quantization/offload được runtime hỗ trợ; không hứa fit chỉ từ4B. Nếu tải full precision rồi quantize on-load thì ghi đúng, không giả file đã4bit. Nếu dùng artifact lượng tử bên khác, kiểm nguồn/license/hash và lý do thay thế; không tự chạy remote code tùy ý.
6. Smoke một ảnh áo và một yêu cầu text→JSON có schema, đo time/VRAM/RAM và chất lượng/malformed outputs. Unload rồi chạy3D, không giữ VLM và diffusion cùng VRAM. Chưa có protocol capability cho VLM thì dùng local CLI/batch riêng, không quảng cáo `avatar.reconstruct` để nhận text jobs hoặc mở public model port.

Không tải Qwen image/video diffusion, ChatGarment7B/ReWeaver và nhiều checkpoint khác hàng loạt trong đợt đầu. Chỉ thêm engine khi quality blocker có bằng chứng và lý do; nếu model license/account gate cần chủ dự án thì báo thao tác, không tự accept thay. Không dùng cloud/API trả phí hoặc mua phần cứng trong scope này.

## 4. Ranh giới cài đặt và UAC

Lệnh mới cấp quyền tiếp tục **setup/download/inference/render trong môi trường user/project** cần cho roadmap, thay việc CPU-only đứng chờ cũ. Kiểm compiler hiện có; nếu đã đủ, chạy smoke rasterizer thật rồi stages tiếp. MSVC Administrator từng được chủ dự án tạm dừng vì không ở gần PC: **chưa tự suy ra quyền bấm UAC** từ yêu cầu setup tổng quát.

Nếu còn thiếu: đọc script install-msvc-admin.ps1/log và trình bày chính xác chủ dự án cần mở Admin PowerShell/chạy gì; chờ bước OS đó, không liên tục popup/bypass. Không giữ toàn bộ PC idle: render Blender, GarmentCode/Pants baseline, video frame preprocessing và VLM setup/user-level có thể làm độc lập nếu không phụ thuộc compiler. Không đổi driver, reboot, power/overclock, xóa env/weights hay sửa router/firewall.

Dependency compiler/license/input nào thiếu thì task phụ thuộc Blocked, các phần còn lại tiếp tục. Không tự claim back reconstruction thành công nếu vẫn kẹt nvdiffrast. Không chạy lặp fitting cũ để làm báo cáo trông tiến bộ.

## 5. Interface bàn giao bắt buộc giữa PC và Claude

Claude sở hữu **server/transport/schema/UI**, PC sở hữu **engine adapter/exporter/render toolchain**. Core route giữ `/api/v2/worker`; wire revision phải được hai bên xác nhận trước live. Chưa tự thêm public inbound endpoint hoặc service-role lên PC.

- Asset output: avatar/body, top-only, bottom-only tách mesh/asset; cùng mét,+Y-up,+Z-front,origin/pose/shared calibrated transform; không normalize riêng từng món. Fitting gắn slot + avatar/item/material/pipeline version. LOD/texture budget đo thực tế, cap bytes thống nhất.
- Wardrobe xử lý canonical trước, fitting khi avatar có; cache per-item, không tạo mọi tổ hợp áo×quần. Nếu áo/quần va nhau cần combo stage thì đề xuất có benchmark thay vì giả single-slot luôn đủ.
- PC adapter hiện **exit78+bounded error JSON MODEL_UNAVAILABLE**, exit2 có thể INVALID_INPUT JSON hoặc argparse; Claude R1 hiện report exit3/4/5/6+traceback OOM là proposal. **Không compatible sẵn**: ưu tiên bounded structured JSON validation với fallback redacted; không suy OOM chỉ từ chuỗi traceback có thể do input. Bổ sung TIMEOUT nếu revision agreement cho phép, không tự đổi PC exit code vì ví dụ.
- Windows worker kill-on-close/locking phải fail-closed hoặc explicit safe disabled mode nếu không đảm bảo không orphan; “chỉ cảnh báo rồi chạy GPU” chưa đủ. Một GPU job nặng cả máy; lock theo host/GPU, không chỉ từng workDir, trước pilot hai owner.
- Checkpoints giữ bytes/hash/owner/job/model/input/revision; symlink/traversal/cancel/stale kết quả không bypass. Body debug normalized/UV validator pass chưa chứng minh mét/likeness/fitting.
- Tạo local contract-fixture input/manifest/output và schema allowlist theo slot/capability. Demo assets nhãn rõ, nguồn file có quyền; private photos/models không commit public.

## 6. Chia việc Claude để ra full flow sớm

**C0:** receipt hiện trạng và tiếp nhánh R1afc37ff đã có. Chuẩn bị Mac review worktree từ bundle verify nếu chưa có, không làm lại recovery từ d2a9898. So code/test/report, xử lý mapping PC thực tế và Windows process safety, báo protocol revision. Codex review rồi mới nối worker real; vẫn phát triển UI qua fixture độc lập.

**C1:** mở entity/capture/category/slots cho jeans: schema additive, strict slot/category, owner/version/reference; giữ tops/quiz/local importer hiện có. Không coi garment.kind=shirt là quần để tránh migrate. JSON schema và fixture trước PC tích hợp.

**C2:** Studio top/bottom selection độc lập, chọn slot này giữ slot kia, atomic apply full outfit, late completion chỉ apply đúng selection/avatar. Save/reopen cả bộ, presets ghi nhãn, default front/orbit/zoom/autoorbit, lookbook render cùng scene/frame, không text-to-image đổi logo.

**C3:** mobile/desktop upload, onboarding tùy thứ tự, job states/background, draft/capture video+face+measure, source retention choice; từng capability edit cần hiệu lực thật. Slider edit có preview/apply/version, prompt edit tạo typed intent validate, nếu engine chưa hỗ trợ phải hiện chưa khả dụng, không fake slider. Không đóngfirst release khi mặt/editor chưa đạt.

**C4:** recommender từ owned top+jeans + quiz/occasion,3look có giải thích; thiếu item trả số bộ thực có, không invent. Cache regenerate/revision/recovery, ảnh alpha normalization và privacy/tombstone theo review, scheduler hai owner/test scopes. Ưu tiên một full-look fixture end-to-end trước mở category sơ mi/tây/short.

Chỉ commit local task branches cho code trong scope; không push app/deploy/production migrate/merge baseline khi chưa review. Docs/report/schema proposal sanitized được publish theo quy trình nhánh docs/PR. Nếu code chưa thấy trên Mac, cung cấp bundle/diff local-only hoặc explicit access, không bắt người dùng chuyển ZIP mỗi report.

## 7. Nghiệm thu / tiến độ bắt buộc

Mỗi bên report checkpoint mới có: actualSHA/branch, scope, env/download manifest source/revision/license/bytes/hash, commands/exit, output path/hash, model/renderer thật hay fixture, thời gian/peak VRAM/RAM, giới hạn/input thiếu và task tiếp theo. Report theo mốc có bằng chứng, không hứa ngày xong hoặc inference throughput trước đo.

PC đầu tiên giao model/render readiness report và render smoke có ảnh/GLB/turntable hợp lệ; Claude đầu tiên giao updated R1/conformance/schema + full-look fixture flow. Codex review từng mốc, không yêu cầu chờ mọi feature xong mới đưa mẫu. CPU fixture, template garments và demo body không tự là first-release PASS.

Full acceptance vẫn SPEC-01: avatar giống người dùng (draft user decision), slider+lời, thun+jeans cá nhân đúng màu/logo/form, wardrobe nền/remote/mobile,3look từ quiz/dịp, save/reopen/render; hai account riêng; realPC1GPU; target15–30phút đo rõ. Nếp vải/size physics không là điều kiện; animation sau. Chi phí paid chỉ trình khi có output PC+estimate rồi user quyết định.
