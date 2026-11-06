# Receipt — CL-RECOVERY-R1-20261105-01 (R1A/R1B/R1C)

Ghi lúc 05/11/2026 16:53 America/New_York, **trước khi sửa code**. Handoff: H-CLAUDE-R1-006, prompt `docs/handoffs/prompt-claude-recovery-r1.md`.

| Mục | Giá trị kiểm thực tế |
|---|---|
| Docs đã đọc | `codex/project-operations` @ `87b07b2cbd2f3f125ccf1dbc6bea50cb304b723e` (AGENTS → agent → roadmap → process, review `claude-review-20261105/review.md`, `claude-progress-20261105.md`, prompt R1, `prompt-mac-recovery-fixes.md`, `github-sync.md`) |
| App baseline | `d2a98983391c90c0df0c7decb67bd2b0d8cad9c6` (`codex/3d-studio-worker`, chỉ có trên Mac) |
| Studio gốc | `/Users/khoihoang/Documents/fitmatch_AI-3d-studio` HEAD d2a9898, tracked+untracked **0 dirty** lúc 21:53 UTC. Không đổi branch, không sửa file |
| Tên R1 trên Mac | branch `codex/worker-recovery-r1` **chưa tồn tại**; `/Users/khoihoang/Documents/fitmatch_AI-recovery-r1` **chưa tồn tại** |
| Branch/worktree thật | branch `codex/worker-recovery-r1` từ d2a9898 tại worktree **cloud của Claude** `/home/claude/recovery-r1` (status sạch lúc tạo) |
| Task | R1A/FIX-MAC-01, R1B/FIX-MAC-02, R1C/FIX-MAC-03 — APP-01, QA-01A |
| Không nhận | PC adapters/toolchain, viewer/quiz/recommender, cache-generation (R2), image policy, privacy, two-owner GPU scheduler, animation |

## Vì sao worktree không nằm ở đường dẫn Mac trong prompt

Bridge của phiên này chỉ mount hai thư mục đã cấp (`fitmatch_AI`, `fitmatch_AI-3d-studio`) và **không cho xóa file**. Tạo `/Users/khoihoang/Documents/fitmatch_AI-recovery-r1` cần quyền ngoài hai thư mục đó, và chạy `git worktree add`/`commit` qua bridge sẽ để lại `.lock` trong `.git` dùng chung (git phải xóa lock), có thể làm hỏng repo của owner. Vì vậy:

- Lấy đúng lịch sử bằng `git bundle create … codex/3d-studio-worker ^ac26306` (chỉ đọc `.git`, sha256 bundle `944c5920…fbd7a58`). File bundle tạm nằm ở `fitmatch_AI/.git/claude-r1-transfer.bundle` (ngoài working tree, không bị publish). Cần xóa tay sau khi chủ dự án nhập nhánh — bridge không xóa được.
- Code/commit R1 làm trong worktree cloud, bàn giao lại Mac dưới dạng git bundle của nhánh `codex/worker-recovery-r1` + lệnh tạo worktree đúng tên/đường dẫn trong prompt. Không push source app.

## File scope dự kiến

- `supabase/migrations/<mới>_worker_recovery_r1.sql` (additive; không sửa migration cũ)
- `scripts/worker/worker.py`, `scripts/worker/manage.mjs`, `scripts/worker/config.example.json`
- `src/lib/v2/contracts.ts`, `src/lib/v2/server.ts`, `src/app/api/v2/[...path]/route.ts` (worker + compute/status)
- `scripts/test-v2-db.mjs`, `scripts/test-v2-http.mjs`, `scripts/v2-http-fixture.mjs`, test worker mới, `tests/v2.test.ts`
- `docs/worker-api-contract-v1.md`, `docs/pc-worker-connect.md`
- Report `docs/reports/claude/recovery-r1-report.md`

Trạng thái đề xuất: R1A/R1B/R1C **Assigned → In progress** (Codex xác nhận khi nhập delta).
