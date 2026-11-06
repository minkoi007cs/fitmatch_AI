# Receipt — CL-POSTAUDIT-20261106-01 (H-AUDIT-016)

Ghi trước lần sửa source đầu tiên. Đây là receipt, không phải bằng chứng hoàn thành.

| Mục | Giá trị |
|---|---|
| Session | CL-POSTAUDIT-20261106-01 — Claude (cloud session, Linux workspace), owner app theo prompt-claude-post-audit-20261106 |
| Docs SHA đã đọc | `d3f29a5` (`codex/project-operations`, PROC-0016) — AGENTS → agent → roadmap → process, audit project-audit-20261106, prompt post-audit |
| App baseline | `7be869c989bc8c2b13d8b9ce621c9f70d487e57c` = HEAD `origin/codex/full-look-reviewed` lúc clone; working tree sạch |
| Branch/worktree | `codex/claude-post-audit` tạo từ 7be869c trong clone riêng của phiên cloud; không chạm canonical Studio d2a9898, không merge nhánh docs vào app |
| Baseline re-check | `npm test` 48/48 PASS; `npm run test:v2:db` 6 blocks PASS (PostgreSQL16 container network none) trước khi sửa |
| Next docs | Đã đọc `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (params là Promise) và dynamic-routes; dependencies/lockfile giữ nguyên |

## Task IDs và file scope

- **Review Codex delta 92c79b6..7be869c** — đọc, không revert.
- **CL-PRIV-01** — migration additive mới (deletion intent/retry), `src/app/api/v2/**` routes liên quan source retention, `src/lib/studio/cloud.ts`, UI AvatarDraft/Prepare liên quan trạng thái xóa, `scripts/test-v2-db.mjs`, `scripts/test-capture-retention-http.mjs`/HTTP fixture, unit tests.
- **CL-URL-01 (+LOOK-01)** — `src/lib/studio/cloud.ts` (modelBytes/openCloud), route metadata model nếu cần, tests.
- **CL-WINTEST-01** — chỉ `scripts/worker/test_worker_unit.py` (test-only), không đổi chiến lược containment/kill production.
- Sau đó nếu còn thời gian: MAC-14C proposal (doc), CL-PILOT-01 runbook (doc). Không đổi wire PC trước ACK.

Ngoài scope: PC adapters/engine/GPU guard, `tools/acceptance/`, process chính (chỉ gửi delta), migrate/deploy/merge production, `npm audit fix --force`.

## Kiểm chứng dự kiến

`npm test`, `npm run lint`, `npm run build`, `npm run test:v2:db`, `npm run test:v2`, `node scripts/export-contract.mjs --check`, Python worker unit trên Linux. Windows native: NOT RUN ở phiên này, giao PC. Ghi mọi fail/fix/rerun trong report cuối `docs/reports/claude/post-audit-report.md`.
