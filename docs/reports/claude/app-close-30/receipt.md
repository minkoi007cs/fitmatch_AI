# APP-CLOSE-30 — receipt (written before any source edit)

- Session: **CL-APPCLOSE-20261109-01** — Claude (Cowork cloud sandbox, Linux x86_64), app owner successor of APP-RESUME-29 per owner request and `docs/handoffs/prompt-claude-next-20261109.md` (ops 3e4392d).
- Recorded: 2026-11-09T21:39-05:00 (America/New_York).
- Ownership check: `git ls-remote` at start shows no other APP-RESUME-29 / APP-CLOSE-30 branch or receipt; the only app source branch is `codex/canonical-migration-26` at 0c4c44e. Previous Claude stopped by owner. Codex keeps independent review; PC3D/PCAI keep coordinator/guard/render and Qwen runtime/adapter.
- Docs baseline: `codex/project-operations` **3e4392d4be693c3df1835f5c8417b7b8ce9441af** (read AGENTS → agent → roadmap → process PROC-0030, handoff, progress, 847aeea checkpoint).
- Source baseline: `codex/canonical-migration-26` **0c4c44ea518453b823af50b2b5b0f4f8b0b65878** (implementation cf902d3). Work branch: `codex/app-close-30-claude-20261109`.
- Baseline hashes: apply.mjs b7273a39…067a2; test_worker_unit.py dea997fc…bec1ef; worker.py ef25136b…4016b6 (must stay unchanged).
- Environment: Node 22.23.4, npm 10.9.9 (`npm ci` from lockfile), Python 3.13.18, Docker 29.9.2 (daemon started in sandbox), no cloud credentials.

## Tasks taken
1. **R-MIGTARGET-29** — runner hosted-target guard: refuse unverified hosts/usernames/schemes/connection-overriding parameters **before** any psql call (exit 2); isolated tests stay loopback-only; no bypass.
2. **NATIVE-FIXTURE-30** — test-only: copy coordination workspace before acquiring the canonical lock; keep lock held through admission refusal + split-lock assertions.
3. Review of the migration package (pre/postconditions, history adoption, backup/restore commands).

## File scope
`scripts/migration-cutover/apply.mjs`, new `scripts/migration-cutover/target.mjs`, new unit/regression tests (`tests/*.test.ts`, offline runner regression script), `scripts/worker/test_worker_unit.py` (test only), `docs/infrastructure/canonical-cutover/*` (docs; plan only if needed with hash updates), `docs/reports/claude/app-close-30/**`. Not touched: the 11 historical migrations, compat SQL, worker.py, guard/PC repos, RLS of other apps, src/ UI.

## Verification plan
Offline runner regression with a fake psql (refused/accepted cases, call counter); `npm test`; `npm run lint`; Python worker unit suite (count + skips with reasons); `npm run test:legacy-compat` (PG17 Docker, network none); `test:v2:db`/build/HTTP/browser only if changes touch them or a suspicion needs it. No cloud SQL, migration repair, deploy, Qwen flag, worker grant or GPU.

Note: this sandbox's git proxy refused push to minkoi007cs/fitmatch_AI (403, repository not authorized for the session); publication path recorded in the final report.
