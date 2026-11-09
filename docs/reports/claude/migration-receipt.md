# Receipt — CL-MIGRATION-20261109-01 (CL-MIGRATION-26)

| Mục | Giá trị |
|---|---|
| Session | CL-MIGRATION-20261109-01 — Claude (cloud Linux), owner app/migration/transport theo `docs/handoffs/prompt-claude-migration-prep-20261109.md` |
| Docs đã đọc | ops `1bebba5` (PROC-0026): AGENTS→agent→roadmap→process; `qwen-migration-preparation-20261109/{plan.md,migration-plan.json,preflight.sql,rehearsal.log}`; `canonical-binding-20261109/review.md`; `backend-canonical-20261109.md` |
| App baseline | `f80749a65b47441958e7c6fc485034d7efe446df` (= origin `codex/qwen-review-fixes`, không có commit mới hơn). Giữ R1/full-look/cleanup claim/QREV/binding/ENV-CANON |
| Branch | mới `codex/canonical-migration-26` từ `f80749a` (không ghi đè `codex/qwen-review-fixes`, không dùng worktree Studio gốc) |
| Truy cập cloud | Phiên này **không** có connector/credential tới `gohczmqykjkrgdblgbog`; dùng sự kiện đã làm sạch trong plan/rehearsal + fixture legacy tổng hợp. Không xin key trong chat |
| Supabase CLI | 3.0.0 (cài tạm qua npx ngoài repo, không đổi package.json); `migration new`/`db dump` help đã kiểm |

## File scope (chính xác)
- Mới: `supabase/migrations/<CLI timestamp>_legacy_compat_auth_outfits.sql` (tên do `supabase migration new` sinh).
- Sửa: `src/app/api/outfits/route.ts`, `src/lib/validation.ts` (payload outfit), `tests/*.test.ts` liên quan outfit.
- Sửa/mở rộng: `scripts/schema-inventory.sql`, `scripts/schema-inventory-lib.mjs`, `scripts/compare-schema-inventory.mjs`, `scripts/schema-manifest.mjs`, `docs/infrastructure/schema-manifest.json`, `tests/schema-inventory.test.ts`.
- Mới: `scripts/test-legacy-compat-db.mjs` (fixture legacy tổng hợp + fresh, Docker), `scripts/fixtures/legacy-canonical-shape.sql`, `scripts/migration-cutover/` (preflight/apply runner/postflight/history-adoption), `docs/infrastructure/canonical-cutover/` (plan, backup/restore, HTTPS/env + smoke handoff), báo cáo `docs/reports/claude/migration/`.
- Có thể sửa: `scripts/test-v2-db.mjs`, `scripts/v2-http-fixture.mjs`, `scripts/test-auth-http.mjs` (thêm migration mới vào chuỗi test), `package.json` chỉ thêm script npm (không thêm dependency).

Ngoài scope: áp SQL lên cloud, deploy, cấp quyền worker/GPU, PC adapter/guard, transport worker (chỉ sửa nếu PC repro lỗi thật), bảng không thuộc FitMatch, migration lịch sử (bất biến).
