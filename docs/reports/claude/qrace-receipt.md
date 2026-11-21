# Receipt — CL-QRACE-20261108-01 (QREV-CLEANUP-RACE)

| Mục | Giá trị |
|---|---|
| Session | CL-QRACE-20261108-01 — Claude (cloud Linux), owner app/SQL/collector/tests theo `docs/handoffs/prompt-claude-qrev-cleanup-race-20261108.md` |
| Docs đã đọc | `8daabc0` (PROC-0021): AGENTS→agent→roadmap→process, `docs/reports/review/qrev-recheck-20261108/review.md` + race-probe/race.log |
| App baseline | `7631cb00114ddf559c234f1c0f13285dbb7305ab` (code `bf0b6d7`) trên `codex/qwen-review-fixes`; giữ mọi fix QREV-LOCK/QUOTA/SNAPSHOT/STATUS và các checkpoint trước |
| Branch | tiếp tục `codex/qwen-review-fixes` (descendant của 7631cb0), không rewrite history |

## Scope
- Tái hiện fragment của reviewer trên hàm hiện tại trước khi sửa.
- Migration additive: collector **claim** nguyên tử (cùng khóa owner 73→74 như enqueue) tombstone reservation chưa được tham chiếu TRƯỚC khi xóa object; enqueue từ chối sau khi bị claim; asset ready/được analysis tham chiếu không bao giờ được claim; lease + token để collector trùng/mất reply báo cáo an toàn; dry-run không tác dụng phụ; giữ intent ảnh gốc CL-PRIV-01; abort mở lại intent của reservation khi upload đến muộn.
- `scripts/source-cleanup.mjs` dùng claim/claim-report; fixture + DB/HTTP tests các thứ tự xen kẽ.

Ngoài scope: bật collector thật, production, xóa storage ngoài môi trường test, PC adapter/guard, wire worker, `tools/acceptance/`, process chính.

## Kết thúc (Ready for review)
App `codex/qwen-review-fixes`: `997104f` (fix), `ad6d1d7` (runbook, SHA đã kiểm toàn bộ), `579ece2` (report + logs). Kết quả, kiểm thử và blocker chính xác: [qrace/report.md](./qrace/report.md). Worker `scripts/worker/worker.py` không đổi so với 7631cb0. PC native ACK, test env HTTPS/credential và Qwen thật vẫn NOT RUN.
