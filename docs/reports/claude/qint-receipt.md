# Receipt — CL-QINT-20261107-01 (H-QWEN-018 / QINT-C)

Ghi trước lần sửa source đầu tiên; không phải bằng chứng hoàn thành.

| Mục | Giá trị |
|---|---|
| Session | CL-QINT-20261107-01 — Claude (cloud Linux workspace), owner QINT-C |
| Docs đã đọc | `c5e2429` (`codex/project-operations`, PROC-0018): AGENTS → agent → roadmap → process, H-QWEN-018, prompt-claude-qwen-app-test, H-PC-017, pc-progress-20261107 |
| PR đã đọc | PR6 `eb9b009` (quiescence-finding, launcher patch), PR7 `3aacf25` (review-envelope.v2 / human-confirmation.v1 = proposal), PR8 own report |
| App baseline | `d17ca355` (own final post-audit; giữ 521972e/2bfa6ad/0c8f936 và Codex 92c79b6..7be869c) |
| Branch | `codex/qwen-app-test` tạo từ d17ca355 trong clone riêng phiên cloud; không chạm canonical Studio, không reset/force |

## Thứ tự và file scope

1. **PC-QUIESCENCE-01 (P1, production)** — `scripts/worker/worker.py`, `scripts/worker/test_worker_unit.py`: theo dõi toàn bộ cây process do adapter sở hữu (POSIX process group / Windows per-job Job Object), giữ GPU lock tới khi drain được chứng minh, quarantine fail-closed nếu không chứng minh được; không kill theo PID ngoài cây owned.
2. **Qwen contract v1 + fixtures** — `schemas/qwen-v1/`, `fixtures/qwen-v1/`, `src/lib/v2/qwen*.ts`; publish sớm để PC ACK.
3. **JSON-result job path** — migration additive mới, `src/app/api/v2/**`, `src/lib/v2/**`, worker transport cho JSON result, DB/HTTP tests; flag server-side OFF mặc định.
4. **UI** — wardrobe analyze/progress/review/confirm, rules fallback; runbook testenv + config example không secret.

Ngoài scope: PC runtime/adapter/guard, `tools/acceptance/`, process chính (gửi delta), production deploy/migration, public port, enable 3D capability, paid.

## Kiểm chứng

npm test, lint, build, test:v2:db, test:v2 (không build chồng next start), export-contract --check, Python worker unit (Linux). Windows native và real GPU: NOT RUN ở phiên này — giao PC3D/PCQwen sau contract+guard ACK và Codex review. Mock/CPU sẽ được ghi nhãn riêng với real.
