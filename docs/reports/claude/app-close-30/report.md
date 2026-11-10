# APP-CLOSE-30 — report (Ready for review, not self-accepted)

Session **CL-APPCLOSE-20261109-01** · Claude (Cowork cloud sandbox, Linux x86_64) · app owner successor of
APP-RESUME-29 · receipt: [receipt.md](./receipt.md) (committed f2cca9e before any source edit).
Branch **`codex/app-close-30-claude-20261109`**. Baseline **0c4c44ea518453b823af50b2b5b0f4f8b0b65878**
(implementation cf902d3). Docs baseline `codex/project-operations` 3e4392d. Final SHA: the branch head that
contains this file (see "Publication" below). Diff: `git diff 0c4c44e..<head>`.

No cloud SQL, migration repair, deploy, Qwen flag, worker grant or GPU work. No credentials used. The 11
historical migrations, the compatibility migration, `cutover-plan.json`, `schema-manifest.json` and
`worker.py` are byte-identical to 0c4c44e (12 plan step hashes + manifest hash re-checked:
[plan-hash-check.log](./logs/plan-hash-check.log)).

## 1. Commits

| Commit | What |
|---|---|
| f2cca9e | Receipt |
| 17c154d | **R-MIGTARGET-29** runner target guard (`scripts/migration-cutover/target.mjs`, `apply.mjs`), offline regression `tests/migration-target.test.ts`, README §4 |
| f591d96 | **NATIVE-FIXTURE-30** test-only fixture order (`scripts/worker/test_worker_unit.py`) |
| 8c425de | **QINT-READSKEW** (new finding): root cause + fix of the intermittent `test:v2` 15 s timeout (`src/lib/v2/analysis-read.ts`, `analysis.ts`, `tests/analysis-read.test.ts`) |
| 155a20a | Runner timeouts sent as `SET`s in the SQL stream (new finding R-TIMEOUT-30), plan values validated; final logs |
| (this) | Report, PC patch, process delta |

## 2. R-MIGTARGET-29 — runner target guard

**Repro (offline, baseline apply.mjs b7273a39…):** `DATABASE_URL=postgresql://postgres.gohczmqykjkrgdblgbog@example.invalid/postgres`,
default dry run, `--psql <fake>` (fake writes a marker, exits 7, no network) → fake **called once**, runner
exit **3** ("cannot connect"). Fixed runner → **exit 2**, `REFUSED: target identity: …`, **0** psql calls, URL
not echoed. Log: [r-migtarget-29-repro.log](./logs/r-migtarget-29-repro.log).

**Fix** (`target.mjs`, called before any subprocess; no override flag):
- Scheme `postgres://`/`postgresql://` only (key=value strings refused), single host, no fragment, database `postgres`.
- **Direct:** host exactly `db.<ref>.supabase.co`, port 5432, user exactly `postgres`.
- **Pooler:** host must be in the reviewed plan's `trustedPoolerHosts` (absent/empty ⇒ pooler refused) and match
  `aws-<n>-<region>.pooler.supabase.com`; port 5432 (session mode; 6543 refused for DDL); user exactly
  `postgres.<ref>`. The username suffix is no longer evidence of the host.
- Query params limited to `sslmode` (require/verify-ca/verify-full), `connect_timeout`, `application_name`;
  `host`, `hostaddr`, `port`, `service`, `options`, … refused (they can redirect psql).
- `PGHOST/PGHOSTADDR/PGPORT/PGSERVICE/…` removed from psql's environment (a `PGHOSTADDR` would otherwise
  redirect the connection while the URL still names the right host — the accepted-case test proves it is dropped).
- Plan `trustedPoolerHosts` entries are validated; isolated tests remain loopback-only; smoke ref refused.

**Regression:** `tests/migration-target.test.ts` (part of `npm test`): 23 refused URL forms unit-checked and
each run through the real runner with the fake psql (exit 2, zero calls); accepted direct and plan-listed pooler
reach the fake exactly once with the exact URL and no `PGHOSTADDR`; bad allowlist and malformed timeouts refused
before psql. On the baseline runner these spawn tests **fail** (4 of the then-32), on the fix all **33 PASS**
([migration-target-test.log](./logs/migration-target-test.log)).

**Limitation:** this sandbox has no web search/fetch, so the pooler host form is from the implementer's knowledge
of Supabase connection strings, not re-read from current docs. It is fail-closed (empty allowlist), and the
owner must copy the exact session-pooler host from the dashboard *Connect* panel into the plan for review.
As far as the implementer knows (not re-checked here), the **direct** endpoint needs IPv6 or Supabase's IPv4
add-on; if neither is available the owner must add the verified pooler host first.

## 3. NATIVE-FIXTURE-30 — Windows fixture

`test_copied_coordination_with_identical_policy_refused_while_canonical_held` now copies the coordination tree
**before** acquiring the canonical lock; the `AdmissionError('identity')` refusal and the "split lock would be
free" assertion still run entirely while the canonical lock is held. No assertion removed; worker.py unchanged
(LF sha ef25136b…). The other `copy_workspace` user (`test_main_refuses_to_start_with_legacy_or_foreign_binding`)
does not hold the lock and is unchanged.

Linux result: **56 run, 56 OK, 0 skipped** ([python-worker-unit.log](./logs/python-worker-unit.log)). This
does **not** prove the native Windows result. Expected Windows skips (from the test source, for PC to confirm):
5 × `QuiescenceTests` (`skipIf(os.name == 'nt')`, POSIX process-group drain; Windows uses the Job Object) and
up to 4 × `symlink_or_skip` (guard link, forged/linked slot, linked lock/policy, aliased workspace) when
symlinks are not permitted = the 9 skips PCs reported. Expected native outcome if nothing else differs:
47 PASS / 9 skip / 0 error — **to be confirmed by PC, not claimed here**.

**For PC (exact, test-only):** [native-fixture-30.patch](./native-fixture-30.patch)
(sha256 50ddd9cb14d893c4f6bdbf7c099e5e4e6c16dc54a333294c8837c2674bde5fd3), or commit **f591d96** on this branch.
Resulting `test_worker_unit.py` sha256 **f178f7f0ff2723b8e0b5f3235c2da71a1565d9138bd04529362f4223d8a86429**
(file unchanged by later commits). Run `cd scripts/worker && python -m unittest -v test_worker_unit` natively and
report run/pass/skip(with reasons)/error. Policy/lock/guard are not to be recreated.

## 4. QINT-READSKEW — root cause of the test:v2 timeout (new finding, fixed)

Reproduced in this environment before any UI change: unmodified `npm run test:v2` on f591d96 **failed** at
`test-qwen-http.mjs:183` waiting for "Đề xuất của AI" ([test-v2-run1.log](./logs/test-v2-run1.log)) — the same
signature as Claude's earlier run1. Three runs with temporary poll instrumentation passed
([run2-4](./logs/)).

**Cause:** `GET /api/v2/analyses` (`listAnalyses`) and the single-analysis read (`analysisOf`) read the analysis
row and its job in two separate queries. `fm_v2_analysis_result` flips analysis `pending→review` and job
`running→succeeded` in one transaction. A poll whose analysis read lands before that commit and whose job read
lands after it sees `(pending, succeeded)`, which `view()` maps to **`failed`**. The panel then shows
"Phân tích thất bại" and, because polling only continues while a state is active, **never polls again** — the
proposal only appears after a manual reload. This is a real user-facing bug, not only a test flake. (A second,
harmless effect was also observed: a poll during the test's `asSecond` window returns 401 because the mock hub's
`/me` is global; the panel recovers on the next poll.)

**Deterministic A/B** with a temporary, uncommitted fixture hold of one poll's job read until the result commit
([diag patch](./logs/diag-instrumentation-not-committed.patch)):
- A, old read order: poll returns `failed`, panel text "Phân tích thất bại…", **timeout, exit 1** ([log](./logs/test-v2-skew-A-old.log)).
- B, fixed: the held poll returns `review`, **exit 0** ([log](./logs/test-v2-skew-B-fixed.log)).

**Fix:** pure read model `src/lib/v2/analysis-read.ts` reads analyses → jobs → analyses again; any job change
visible to the job read is then visible in the re-read analysis (same transaction), and a non-pending analysis
status always wins in `view()`. Analyses deleted between reads are dropped instead of reported `failed`.
No SQL, route, UI component or timeout changed. Unit tests `tests/analysis-read.test.ts` (5) reproduce the skew
deterministically. Cost: one extra indexed query per poll.

## 5. R-TIMEOUT-30 — runner timeouts were not reaching the server (new finding, fixed)

`apply.mjs` passed `lock_timeout/statement_timeout` via `PGOPTIONS`. Through `docker exec -i` (the PG17 test
path) that variable never reaches the server: `show lock_timeout` = **0** ([timeout-delivery-check.log](./logs/timeout-delivery-check.log)),
so the timeouts were never exercised by tests, and a pooler may not honor startup options. Now the runner prepends
`SET lock_timeout`/`SET statement_timeout` to each step's SQL stream (verified `5s`/`2min`), and validates the
plan values (they are interpolated) before any psql call. Migration file bytes are unchanged.

## 6. Verification (this sandbox; synthetic data only)

| Check | Command | Result |
|---|---|---|
| Unit | `npm test` | **114/114 PASS**, 0 skipped ([log](./logs/npm-test.log)) — 76 previous + 33 target + 5 read-model |
| Lint | `npm run lint` | PASS ([log](./logs/lint.log)) |
| Python worker | `python3 -m unittest -v test_worker_unit` | **56 OK, 0 skip**, Linux ([log](./logs/python-worker-unit.log)) |
| PG17 legacy/fresh cutover | `npm run test:legacy-compat` | **PASS**, includes runner execute with the new SETs ([log](./logs/legacy-compat-db.log)) |
| V2 DB | `npm run test:v2:db` | PASS ([log](./logs/test-v2-db.log)) |
| Build | `next build --webpack` + font mock | PASS ([log](./logs/build-webpack-fontmock.log)); default Turbopack build **not run** (Google Fonts blocked, [log](./logs/build-turbopack-fonts-blocked.log)) |
| HTTP/browser | `npm run test:v2` unmodified harness | before fix 1 FAIL (run1) + 3 PASS (diag); after fix **2/2 PASS** ([final-run1](./logs/test-v2-final-run1.log), [final-run2](./logs/test-v2-final-run2.log)) |
| Hashes | plan steps + manifest | 12/12 + manifest OK |

**Environment substitutions (state them in any review):** Docker Hub, GHCR, ECR and the PGDG apt repo are
blocked here, so `postgres:17-alpine`/`postgres:16-alpine` are **local stand-in images** built by
`docker import`: server 17 = `@embedded-postgres/linux-x64@17.11.0-beta.19` (npm tarball sha256
5296077a…4f18), server 16 = host Ubuntu PostgreSQL 16.15; clients psql/pg_isready = Ubuntu 16.15 in both. Not the
official Alpine images. Next build used `--webpack` with `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` (one local TTF), not
the default Turbopack build. Playwright 1.64.1 used the preinstalled headless shell 1243 aliased as 1248
(download blocked). Node 22.23.4, Python 3.13.18, Docker 29.9.2. Codex should rerun on its reference environment.

## 7. Migration package review (static + synthetic)

- **Pre/postconditions, adoption, rerun/refusal, partial failure:** runner refuses on manifest/file hash
  mismatch, non-ready precondition, already-applied non-rerunnable step (exit 4), stops at first failed verify
  (exit 5); each file is one transaction; history adoption is printed, never executed. The PG17 test covers
  apply 11 + compat with per-step verify, replay refused, partially-present step refused, compat rerun no-op,
  three abort cases with nothing changed, data fingerprint unchanged, FK to `fm_users` and legacy NOT NULL kept,
  private buckets, unrelated table untouched, fresh baseline. **Not covered:** a mid-chain failure on a real
  hosted project (later steps are not attempted; recovery is restore/forward-fix per README §5).
- **Backup/restore commands vs actual CLI:** installed `supabase@3.0.0` in the sandbox (no login) and checked
  `--help`: `db dump --remote[=<ref|branch|url>] --role-only|--data-only --use-copy -f`, `storage cp -r
  --remote[=<ref|branch>] ss:///…`, `migration repair --status applied <versions> --remote=<ref>` all exist as
  written in README §2/§4. Not executed against any project.
- **Observations for Codex (not changed):** (a) README §3 restores `roles.sql` into a local Supabase stack, which
  already has the Supabase roles — expect "role exists" errors; run without `ON_ERROR_STOP` for roles only or
  filter, and record it. (b) check which schemas `db dump --data-only` includes (e.g. `auth`/`storage` rows) before
  restoring; the restore proof should compare FitMatch tables and storage object counts, as §3 says. (c) The runner connects as
  `postgres`; on the pooler the session role is the same, so `SECURITY DEFINER` ownership checks in the compat
  migration hold — but this is unverified on hosted until the restore proof.
- RLS of the 27 unrelated tables untouched; no change to owner FKs, nullability, `style_category`/`is_saved`.

## 8. Proven vs not run

Proven here (synthetic): target guard offline; fixture order on Linux; read-skew root cause + fix (deterministic
A/B and unit); timeout delivery; PG17 legacy/fresh cutover with stand-in image; unit/lint/DB/HTTP/browser.
**Not run / not proven:** native Windows suite (PC), default Turbopack build, official Postgres images, any cloud
backup/PG17 restore proof, hosted dry run, HTTPS serving revision, scoped worker enrollment, real Qwen/GPU.
This is implementer evidence, **not an independent review PASS**.

## 9. Publication

The sandbox git proxy refused `git push` to `minkoi007cs/fitmatch_AI` (HTTP 403: repository not in the
session's authorized set). If the push succeeded the branch is on GitHub; otherwise a git bundle
(`app-close-30.bundle`, all commits 0c4c44e..head) was handed to the owner to push:
`git fetch app-close-30.bundle codex/app-close-30-claude-20261109 && git push origin codex/app-close-30-claude-20261109`.

## 10. Process delta for Codex to import (do not overwrite process.md with an old copy)

```text
### L-072 - 09/11/2026 - START/HANDOFF - CL-APPCLOSE-20261109-01 / APP-CLOSE-30
Claude (Cowork cloud sandbox) took APP-CLOSE-30 after receipt f2cca9e; no other APP-RESUME-29/APP-CLOSE-30 claim
on remote. Baseline app0c4c44e/docs3e4392d, branch codex/app-close-30-claude-20261109. R-MIGTARGET-29 fixed:
target.mjs, exit2 before psql, 33 offline runner tests (fail on baseline). NATIVE-FIXTURE-30 test-only f591d96,
patch sha50ddd9cb…, test file sha f178f7f0…, worker ef25136b unchanged; Linux56OK/0skip, native NOT RUN.
New QINT-READSKEW: test:v2 timeout reproduced, cause = two-query analysis/job read skew -> 'failed' + polling stop;
deterministic A/B old FAIL/fixed PASS; fix analysis-read.ts. New R-TIMEOUT-30: PGOPTIONS timeouts not delivered
via docker exec; now SET in stream, validated. npm114, lint, PG17 legacy, v2db, test:v2 2/2 after fix PASS on
stand-in images/webpack+fontmock build (environment limits in report). SQL/plan/manifest hashes unchanged.
No cloud/deploy/GPU. Status Ready for review; Codex independent review; PC native rerun of exact patch.
```

| Task | Owner | Status |
|---|---|---|
| APP-CLOSE-30 (R-MIGTARGET-29, NATIVE-FIXTURE-30, QINT-READSKEW, R-TIMEOUT-30) | Claude CL-APPCLOSE-20261109-01 | Ready for review |
| Independent review of this branch | Codex | Planned |
| Native rerun of f591d96 test file on both PCs | PC3D / PCAI (PC-SAVE-30 follow-up) | Planned |

## 11. Next steps

1. Codex: review diff 0c4c44e..head, rerun `npm test`, `test:legacy-compat` and `test:v2` on the reference
   environment (official images, Turbopack build); decide whether the pooler allowlist form is acceptable.
2. PCs: apply the exact test-only patch, run the native suite, report counts/skip reasons.
3. Owner (after review): private backup + PG17 restore proof per README §2–3, then add the verified pooler host
   to the plan if the direct endpoint is not reachable; runner dry run against the restored copy.
4. Still open: HTTPS serving revision of this code, scoped worker enrollment, real-Qwen smoke behind the flag.
