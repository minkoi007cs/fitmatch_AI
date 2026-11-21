# Handoff — CL-QINT-20261107-01 (H-QWEN-018 / QINT-C)

Phiên Claude chạy trong cloud Linux. Docs đã đọc: `c5e2429` (PROC-0018). App baseline `d17ca355` (bản post-audit cuối của mình). Nhánh `codex/qwen-app-test`. Source code đã kiểm nằm ở `source-sha.txt` (`ef244e1`, checkpoint 3); commit chứa report này nằm ngay sau đó trên cùng nhánh. Receipt và các checkpoint được ghi ở nhánh docs `docs/claude-CL-QINT-20261107-01`.

**Trạng thái: Ready for review (code/CPU/mock). Chưa có tích hợp thật nào.**
- Chưa chạy Qwen thật, GPU thật, Windows native, hay Supabase/HTTPS test env.
- Feature flag mặc định OFF.
- Quality gate của avatar cá nhân/3D giữ nguyên NOT VERIFIED.

## Commits (tính từ d17ca355; giữ nguyên 521972e/2bfa6ad/0c8f936 và các commit 92c79b6..7be869c của Codex)

| SHA | Nội dung |
|---|---|
| `7d2283b` | PC-QUIESCENCE-01: sửa drain trong production transport |
| `9311099` | Checkpoint 1: proposal contract Qwen v1 + schemas + fixtures |
| `1f4d01f` | Checkpoint 2: job path JSON-result, API, worker, UI, DB/HTTP/browser tests |
| `86f72fa` | Unit test worker json-v1, runbook, operator kinds, config mẫu |
| `ef244e1` | Checkpoint 3: báo PC offline / thiếu bộ nhớ đúng trạng thái, chặn tài khoản thứ hai qua HTTP, unit test khi tắt cờ |

## 1. PC-QUIESCENCE-01 (P1)

`OwnedProcessTree` thay cho `stop_process` dựa vào launcher. Khác biệt theo nền tảng:

| | POSIX | Windows |
|---|---|---|
| Cách cô lập | Mỗi adapter một session/process group | Tạo ở trạng thái suspended → gắn vào Job Object riêng cho từng job (KILL_ON_JOB_CLOSE, nested trong job của worker) → `NtResumeProcess` |
| Cách biết còn chạy | Nhóm còn member không phải zombie | `ActiveProcesses` do kernel báo |

Quy tắc chung cho cả hai:
- Chỉ kill trong group/job của mình, không kill theo PID tra ở nơi khác.
- `drain()` chạy ở cả success, timeout, cancel và lease-loss. GPU lock chỉ nhả khi drain trả True.
- Không chứng minh được drain → **quarantine**: giữ lock, không claim, kiểm lại mỗi lần poll; `--once` exit 4.
- Một lock owner duy nhất: adapter nhận `FITMATCH_GPU_LOCK_HELD_BY=worker` và `FITMATCH_GPU_LOCK_PATH`, nên guard của PC3D không được lấy lại cùng lock.
- Fix này nằm trong production transport, khác với CL-WINTEST-01 (bản đó chỉ sửa test).

## 2. Contract proposal

`docs/qwen-contract-v1.md` kèm `schemas/qwen-v1/*.json` (Draft 2020-12, có cả rule liên trường) và `fixtures/qwen-v1` (4 valid / 16 invalid). PC kiểm bằng `scripts/check-qwen-contract.py`.

Khác với PR7, có bảng đối chiếu trong doc:
- Worker không nhận owner id.
- Snapshot bất biến (`imageAssetId` + `imageSha256`) dùng làm source version.
- Bỏ các trường model không ground được.
- Server tự tính digest trên bytes nhận được.
- Bản v1-r2 đã export **không đổi**.

## 3. App (flag `QWEN_ANALYSIS_ENABLED`, server-side, mặc định OFF)

- **Migration additive `20261107120000`:**
  - `fm_v2_analyses`: snapshot, result bytes + sha, worker/lease đã nộp, confirmation.
  - `jobs.analysis_id`, kèm constraint "đúng một subject" và constraint kind.
  - `not_before`/`deferrals`; `claim_r1` tôn trọng backoff, giữ FIFO.
  - RPC enqueue/result/defer/action/confirm.
  - Trigger khi xóa món đồ: tombstone snapshot qua cleanup intents của CL-PRIV-01.
  - Grant `garment.analyze`.
- **API:**
  - `GET/POST /api/v2/analyses`, `/:id/confirm|cancel|retry`.
  - Claim envelope dạng `json-v1`; `jobs/:id/result`.
  - `GPU_BUSY`/`MEMORY_PRESSURE` → defer, không tính vào attempt; quá 5 lần → `GPU_UNAVAILABLE`.
  - `input-url` chỉ ký lại đúng snapshot.
  - Danh sách job và action của 3D bỏ qua job analysis.
  - Khi flag OFF, heartbeat không lưu capability này.
- **worker.py:**
  - Ghi input adapter theo json-v1.
  - Tự kiểm output: ≤ 8192 byte, binding khớp, `approvedForAutoApply=false`; sai thì `INVALID_OUTPUT` (fail closed).
  - POST result idempotent, kể cả khi resume.
- **UI Wardrobe:**
  - Hiển thị queued / chờ GPU / đang chạy / review / lỗi kèm nút "Thử lại".
  - Review điền sẵn giá trị, trừ `unknown` và OCR; chữ trên áo người dùng phải tự gõ hoặc tự bấm chọn.
  - Chỉ ghi khi bấm "Lưu vào tủ đồ".
- **Fallback:** rules-v1 và 3 owned looks dùng metadata wardrobe đã được người duyệt nên không cần sửa. PC offline thì job nằm ở queued, app vẫn dùng được.
- **Runbook:** `docs/qwen-test-env-runbook.md`, gồm bootstrap, thứ tự migration, enroll, dừng và rollback. Config mẫu không có secret: `scripts/worker/config.qwen-test.example.json`.

## Checkpoint 3 (`ef244e1`)

- `GET /api/v2/analyses` trả thêm `workerOnline`: chỉ true khi có worker của chính owner được grant, đang khai `garment.analyze` và có heartbeat trong 90 giây (cùng cửa sổ thời gian `claim_r1` dùng). PC offline thì UI nói rõ "PC đang offline" thay vì "đang chờ"; `MEMORY_PRESSURE` có thông báo riêng.
- `storableCapabilities()`: khi tắt cờ, heartbeat không bao giờ lưu `garment.analyze`, nên không worker nào claim được job phân tích (có unit test).
- HTTP test với **tài khoản thứ hai đăng nhập thật** qua auth mock: danh sách rỗng, `cancel`/`retry`/`confirm` trên analysis của người khác → 404, action trên job của người khác → 409, và dữ liệu không đổi.

## Lệnh và exit code (trên `ef244e1`, log trong thư mục này)

| Lệnh | Kết quả |
|---|---|
| `npm test` | exit 0 — 64/64 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0, chạy trước test browser, không chạy chồng `next start` |
| `npm run test:v2:db` (PostgreSQL 16, network none) | exit 0 — 8 block, có block QINT-C |
| `npm run test:v2` | exit 0 — 14 dòng PASS, có QINT-C với **real worker.py + CPU MOCK adapter** |
| `node --import tsx scripts/export-contract.mjs --check` | exit 0 — 48 file |
| `python3 scripts/check-qwen-contract.py` | exit 0 |
| `python3 -m unittest -v test_worker_unit` (Linux) | exit 0 — 30/30 |

Trong lúc làm có hai lần sửa test, không phải lỗi sản phẩm. Lần thứ hai là hai lỗi tách biệt:
- Stub quarantine được cấu hình sai số lần drain.
- DB test bị lỗi Docker daemon chết sau một đêm (khởi động lại rồi chạy tiếp); khi chạy lại thì assert constraint dính cả hai check cùng lúc → đổi kind trong case đó để mỗi assert chỉ kiểm một constraint.

Cả hai đều đã sửa và chạy lại PASS.

## Mock và real

Mọi PASS ở trên đều đến từ CPU, PostgreSQL local và mock adapter. Danh sách **chưa** kiểm: Qwen thật, VRAM/RAM/thời gian, Windows Job Object nested, guard của PC3D, Supabase/HTTPS test env. Đã có: 2 tài khoản qua HTTP (checkpoint 3), dù wardrobe của mock vẫn là fixture.

## Blockers và người nhận tiếp

1. **PC3D (QINT-G):**
   - Chạy 30 Python tests native trên Windows ở commit này.
   - Kiểm native: nested Job Object, venv launcher/interpreter/grandchild, foreign sentinel phải sống, quarantine.
   - Guard không lấy lock lồng.
   - ACK hash guard mới, đường dẫn lock tuyệt đối, byte 0.
2. **PC Qwen (QINT-P):**
   - Adapter theo `analysis-adapter-input` / `analysis-result`; output thật đi qua `check-qwen-contract.py`; khớp exit codes.
   - Gửi source + hash; không tải model mới.
3. **Codex (QINT-R):** review contract, migration và drain; cho PASS trước khi grant capability trên test server.
4. **Chủ dự án:** cần một Supabase test project + deploy HTTPS + credential riêng (chưa có trong phiên này). Khi có, làm theo runbook mục 5. Không dùng production.

Không merge, không deploy, không migrate production, không mở cổng public.
