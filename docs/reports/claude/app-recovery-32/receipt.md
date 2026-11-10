# APP-RECOVERY-32 — receipt (before any edit)

- Session **CL-APPRECOVERY-20261109-01** — same Claude app owner and same cloud checkout as APP-CLOSE-30
  (CL-APPCLOSE-20261109-01). Recorded 2026-11-09 ~22:50 America/New_York.
- Docs: `codex/project-operations` **f0db00cc87172871cbe5180a722f1c12f37255c6** (read agent.md → roadmap.md →
  process.md PROC-0032, `docs/reports/review/app-close-30-review-20261109.md`,
  `docs/handoffs/prompt-claude-recovery-ready-20261109.md`).
- Source: base **499ead01e7f9274ddf310ab346fda4c2464588bd** (= remote `codex/app-close-30-claude-20261109`, pushed
  by owner/Codex; local checkout clean, identical). Task branch **`codex/app-recovery-32-claude-20261109`**.
- Ownership: no other APP-RECOVERY-32 branch/receipt on remote. PC tasks AI-NATIVE-COMPOSE-31 / PC-CPU-FACE-31
  untouched.

## Scope (own)
`docs/infrastructure/canonical-cutover/README.md` and related recovery docs; new local rehearsal/verification
scripts in `scripts/migration-cutover/`; matching tests; `docs/reports/claude/app-recovery-32/**`.
Runner (`apply.mjs`/`target.mjs`) only if a defect directly blocks the rehearsal (repro + test).

Not touched: historical SQL, compat SQL, plan/manifest bytes (unless justified + hashes updated), `worker.py`,
PC adapters/coordinator, UI. No cloud SQL/backup/deploy/history repair/enrollment/flag/GPU.

## Plan
1. Verify Supabase CLI 3.0.0 behaviour (`--help` and `db dump --dry-run` scripts) + official backup/restore docs.
2. Rewrite README §2–3: reserved vs custom roles, which schemas each dump includes (auth/storage data yes, schema
   no), Storage bytes outside SQL, data fingerprint instead of raw dump hash, narrow handling of expected errors.
3. `scripts/migration-cutover/rehearse-restore.mjs`: disposable local PG17 source (Supabase-like stub +
   canonical legacy shape + synthetic auth/fm_users/wardrobe/outfits/identity/refresh + private storage metadata
   + synthetic object bytes) → dump with the CLI's own pg_dump/pg_dumpall flags → restore into a fresh
   Supabase-like target → inventory/compare → runner dry-run → execute → data/owner/private-asset invariants →
   signup + outfit save/reopen; fault cases (truncated/missing dump, missing Storage bytes, wrong target,
   restore SQL error, role conflict).
4. Execution checklist with exact hashes and stop/rollback conditions.

Verification: rehearsal run(s) with logs, `npm test`, lint, `test:legacy-compat` (runner unchanged ⇒ only if
touched). Environment: PG17 = conda-forge PostgreSQL 17.9 (server + pg_dump/psql 17.9) in a local stand-in
image because Docker Hub is blocked here; stated in the report.
