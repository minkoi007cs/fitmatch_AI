# CL-MIGRATION-26 — report (resumed after pause; verification complete)

Session: CL-MIGRATION-20261109-01 · Claude/Mac · branch `codex/canonical-migration-26` · baseline `f80749a`
· implementation commit `cf902d3` (logs in `logs/` are bound to cf902d3). **Not applied to any cloud
database, no deploy, no worker grant, no GPU.** Status: **Ready for review** (all checks PASS on cf902d3; see §3 for one intermittent browser timeout).

## 1. What was delivered (diff: `git diff f80749a..cf902d3`)

- `supabase/migrations/20261109093355_legacy_compat_auth_outfits.sql` (new, `supabase migration new`, CLI 3.0.0)
  sha256 prefix 00a1e82284cc — guarded, one transaction, rerunnable: `handle_new_user()` replaced in place
  (same OID, existing trigger, SECURITY DEFINER, `search_path=''`, EXECUTE revoked from public/anon/
  authenticated) to provision `public.fm_users`; adds `fm_outfits.style_category`/`is_saved` only where
  missing. Refuses on unexpected trigger callers, extra required columns, forced RLS, wrong owner/types.
- `src/app/api/outfits/route.ts`, `src/lib/validation.ts`: archive writes the single shared style +
  `is_saved=true`; `MIXED_STYLE_ARCHIVE` / `STYLE_CATEGORY_MISMATCH` refused before write.
- Comparator (`scripts/schema-inventory{.sql,-lib.mjs}`, `compare-schema-inventory.mjs`): defaults, forced
  RLS, permissive/USING/CHECK, anon/authenticated grants, extension-owned functions skipped + placement
  report, legacy names `equivalent` vs owner FK `different-target`, overlapping permissive policies,
  `stepPrecondition` for sequential apply.
- `schema-manifest.mjs` now PG17 + hosted pgcrypto-in-`extensions` + Supabase default privileges
  (finding: without the defaults a correct cloud apply would fail verification after step 1). Manifest
  regenerated (14 steps, 426 objects).
- `scripts/migration-cutover/apply.mjs` + `docs/infrastructure/canonical-cutover/cutover-plan.json`
  (12 steps, all sha256 pinned, manifest sha256 pinned, 20261103 verify-only, dry run default, never runs
  `migration repair` itself).
- Docs: `docs/infrastructure/canonical-cutover/README.md` (order, preconditions, backup/restore commands for
  CLI 3.0.0 incl. storage copy, runner, history adoption, rollback, remaining gates) and `real-qwen-smoke.md`
  (HTTPS revision/env and real-Qwen smoke plan, flag OFF).
- Tests: `scripts/fixtures/legacy-canonical-shape.sql`, `scripts/test-legacy-compat-db.mjs`
  (`npm run test:legacy-compat`), unit tests (schema-inventory, validation), HTTP outfit assertions.

## 2. Immutable migrations (unchanged bytes)
20261103 6779f230da48 (verify-only) · 20261104 72c898950bab · 20261105 149fbcbf3d72 · 20261106025506 8b141146bc25 ·
20261106035951 c539cb075898 · 20261106042143 cfddc2a9ab32 · 20261106044040 8751b4aec051 · 20261106053812 4d9beb5d1776 ·
20261106150000 10581f817603 · 20261107120000 0440dccc8044 · 20261108090000 8f403db32387 · 20261108150000 08227b3fa14a.

## 3. Verification on cf902d3 (Docker, network none, synthetic data)

| Check | Result |
|---|---|
| `npm test` | 76/76 PASS |
| `npm run lint` / `npm run build` | PASS / PASS |
| export-contract --check / qwen contract | PASS (48 files) / PASS |
| python worker unit | 56 OK |
| `schema-manifest.mjs --check` | current |
| `npm run test:legacy-compat` (PG17) | PASS — reproduced signup (`public.users`) + outfit NOT NULL defects; comparator aliases/different-target; runner 11+compat applied+verified, replay refused; data fingerprint unchanged; FK/NOT NULL kept, no duplicates; signup/wardrobe/outfit/cross-owner; analysis reserve→confirm, stale, quota, cleanup claim; refusal cases; fresh baseline |
| `npm run test:v2:db` | PASS |
| `npm run test:http` | PASS (run before commit; outfit legacy assertions) |
| `npm run test:v2` | Run 1 (`logs/test-v2-http-run1.log`): earlier blocks PASS, then the Qwen browser block timed out after 15 s waiting for "Đề xuất của AI". Run 2 (`logs/test-v2-http-run2.log`), same commit, **all blocks PASS**, exit 0. This diff does not touch the analysis UI or routes. The cause of the one 15 s wait was not root-caused: an intermittent browser wait, flagged for Codex. |

Not done: cloud backup, PG17 restore proof, any cloud SQL, history adoption, HTTPS deploy, native PC ACK,
real Qwen. `test:v2:db` / v2 HTTP fixtures still use PG16 minimal stubs (new migration not applicable there;
covered by the PG17 legacy/fresh test).

## 4. Next steps (for the next AI)
1. Codex reviews exact SQL + hashes; owner does §2–3 of the cutover README privately before any execute.
