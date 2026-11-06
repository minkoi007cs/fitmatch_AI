# Prompt Claude — full FitMatch áo thun + jeans

Bạn phụ trách code app/server/worker transport; PC phụ trách model, inference, renderer và engine adapters; Codex review. Chủ dự án yêu cầu triển khai theo roadmap mới, tận dụng code đã có và ưu tiên một luồng hoàn chỉnh sớm. Không tạo subagent/chat mới.

## 1. Đọc và tiếp nối đúng baseline

Pull checkout tài liệu riêng `codex/project-operations` mới nhất. Đọc toàn bộ AGENTS.md → agent.md → roadmap.md → process.md, rồi `docs/product-requirements-2026-11-05.md` và `docs/handoffs/execution-thun-jeans-20261105.md` (H-EXEC-009).

Studio canonical ở d2a9898. Bạn đã nộp R1 final afc37ffa2767171f5cb74b33ad8f76315a6275a7 trên codex/worker-recovery-r1; bundle/diff/log nằm tại `fitmatch_AI/claude-handoff-local/worker-recovery-r1/` trên Mac. Codex đã verify bundle, chưa duyệt code. Tiếp đúng nhánh R1 hoặc task branch kế thừa; không viết lại recovery từ đầu. Nếu đã có thay đổi mới hơn, kiểm và giữ chúng. Không sửa/reset canonical Studio hoặc main đang có công việc khác.

Ghi receipt gồm session, docs SHA, actual app SHA, nhánh/worktree và file scope trước code. Nếu bridge không tạo được worktree Mac, tiếp cloud worktree đang có và bàn giao bundle/diff local-only như R1, không giả code đã có trong checkout Mac.

## 2. C0 — hoàn thiện R1 cho review

Đọc PR #1 mới, đặc biệt adapter-conformance-r1.md. Adapter PC thật trả exit78 + JSON MODEL_UNAVAILABLE; exit2 có thể là JSON INVALID_INPUT hoặc argparse usage. Exit3/4/5/6 trong report R1 chỉ là đề xuất. Sửa mapping theo bounded structured JSON với fallback redacted; không suy OOM từ chuỗi traceback tùy ý. Kiểm secrets không vào subprocess.

Windows kill-on-close lỗi không được chỉ warning rồi chạy GPU: fail-closed hoặc explicit disabled mode có giải thích. Giữ durable recovery qua restart, grants, owner, cancel và stale-lease checks. Chạy lại tests liên quan trên final revision, không lấy số PASS của report trước thay kết quả mới. Chuẩn bị code để Codex đọc/retest trước PC live.

## 3. C1 — một full-look flow với top + jeans

Mở rộng entity/category/capture/API/asset schemas cho jeans thật, không gắn nhãn shirt để né validation. Top và bottom có item/version/material/pose/avatar binding riêng. Migration additive bảo toàn dữ liệu cũ. Xuất machine-readable schemas và fixture ba GLB hợp lệ: body, top, bottom cùng hệ trục/mét/pose/origin để PC đối chiếu. Hai bên chốt protocol revision trước tích hợp thật.

Studio chọn hai slot độc lập: đổi áo giữ quần, đổi quần giữ áo. Full outfit áp hai món theo một selection snapshot. Job xong chỉ autoapply nếu owner/avatarVersion/itemVersion/slot/selection còn khớp. Save/reopen cả bộ, camera và asset versions; không inference khi xem lại. Camera front mặc định, orbit/zoom, nút auto-orbit; giày và đồ mẫu ghi nhãn preset.

Giữ viewer/importer, wardrobe, quiz, private assets và queue đang có. Chứng minh một luồng upload/job/model→top+jeans→save/reopen qua fixture trước khi polishing toàn UI. Fixture không thay nghiệm thu đồ/ảnh người dùng thật.

## 4. C2 — wardrobe, capture, avatar/editor

Wardrobe là trung tâm. Hỗ trợ chụp/upload trên điện thoại và upload desktop, đồng bộ theo tài khoản riêng. Tạo avatar hoặc thêm đồ trước đều được. Canonical garment xử lý nền khi chưa có avatar; fitting chuẩn bị sau. Hiện trạng thái pending/ready/offline/failed rõ, reload không mất tiến trình, không phần trăm/ETA bịa.

Avatar capture nhận video, ảnh mặt và số đo với upload riêng tư có validation/limits; không nhét video vào JSON request. Dựng draft rồi người dùng chọn dùng tạm, chỉnh hoặc bổ sung ảnh/tạo lại. Editor có slider và typed natural-language edit intents, ưu tiên mặt → dáng → tóc/da theo capability thật. Nếu engine chưa hỗ trợ edit, ghi rõ chưa khả dụng; không fake slider bằng camera scale. Giữ version đang dùng tới khi version mới ready; đổi body invalidates fitting đúng.

Khi tạo xong cho chọn giữ/xóa source ảnh/video; giữ thì xóa sau được. Source và derived avatar/looks có vòng đời riêng, tombstone/ref/cancel checks chặn late completion phục hồi dữ liệu đã xóa. Không public hóa ảnh hoặc video để dễ demo.

## 5. C3 — AI, lookbook, pilot

Quiz + dịp sử dụng → 3 bộ từ top/jeans thật trong wardrobe, có giải thích. Thiếu đồ thì trả số bộ thực có, không invent. Giữ rules-v1 hiện có; Qwen adapter là tùy chọn theo PC benchmark, không chặn full flow. Lookbook render chính scene/avatar/outfit/version với góc máy và nền, không gọi text-to-image đổi mặt/logo/màu.

Tiếp các gap cache regenerate/engine revision/concurrency/quota, alpha PNG, deletion/retention và GC dry-run. Trước pilot hai user cần một GPU dispatcher/host lock và owner-scoped tokens; không cấp service role cho PC. UI trung tính, dễ chọn hai slot, avatar là trung tâm; không đưa CUDA/model internals vào luồng sử dụng.

Chưa mở animation, sơ mi/quần tây/short, generative lookbook hoặc paid cloud. Chưa đạt likeness/editor/đồ cá nhân thì chưa gọi first release hoàn tất; một scene template chỉ là checkpoint kỹ thuật.

## 6. Kiểm chứng và quyền

Đọc Next docs trong node_modules của đúng worktree trước code; Supabase skill/docs/changelog trước DB. Tạo migration additive bằng CLI đúng version; không chạy production migration. Tests phải assert/exit1 khi sai: DB/RPC/owner/lease/concurrency thật; API/worker lost replies/restart; UI hai slot, A→B→A, save/reload, pending autoapply, offline, alpha, source-retention choices.

Chạy lint, unit, build, test:v2:db, test:v2 và các tests meaningful mới trên final revision. Tách fixture/synthetic khỏi PC/GPU/ảnh thật. Không chạy lại hàng loạt khi không có thay đổi hoặc failure cần kiểm.

Commit local theo C0/C1/C2/C3 nhỏ, review được. Không push source app, merge main, deploy, migrate production hoặc enroll live worker khi chưa được review/cho phép. Report/schemas proposal sanitized có thể đưa qua nhánh docs/PR theo github-sync. Nếu thiếu HTTPS/test DB, chuẩn bị runbook và cấu hình placeholder; không báo remote access đã hoạt động. Không đưa env/token/weights/ảnh lên repo công khai.

Bàn giao `docs/reports/claude/full-look-code-report.md`: receipt, baselines/finalSHA/commits/diff, U01–U27→code/test/gap, schema/protocol revisions, migration rollout/rollback, ảnh/video full-flow ghi fixture hay real, commands/logs/exit, capability thật vs stub, blockers. Báo sớm checkpoint đầu tiên có body+top+jeans; tiếp phần độc lập theo phạm vi. Codex review code và output thật trước nghiệm thu.
