# R1 report — worker recovery và capability (CL-RECOVERY-R1-20261105-01)

Trạng thái đề xuất: **R1A / R1B / R1C → Ready for review** (chưa Done sản phẩm). Gắn APP-01, QA-01A. Handoff H-CLAUDE-R1-006. Receipt: [recovery-r1-receipt.md](./recovery-r1-receipt.md) (ghi trước code, commit docs `4cb4bd1`).

## 1. Baseline, nhánh, commit

| Mục | Giá trị |
|---|---|
| Docs đã đọc | `codex/project-operations` @ `87b07b2`, sau đó `17b04e3` (H-PAIR-007) và draft PR #1 head `4ee404d` (`docs/reports/pc/adapter-conformance-r1.md`) |
| App baseline | `d2a98983391c90c0df0c7decb67bd2b0d8cad9c6` (Studio Mac, sạch lúc kiểm, **không bị sửa**) |
| Nhánh R1 | `codex/worker-recovery-r1` |
| **Final SHA** | **`a3d051ad34724fece819017064d7e16fb4968794`** |
| Worktree thật | cloud của Claude `/home/claude/recovery-r1` (lý do trong receipt: bridge không tạo được thư mục ngoài 2 folder đã cấp, và git qua bridge không xóa được `.lock`) |
| Push | **Không** push source app, không merge, không deploy, không migrate thật |

Commits (theo thứ tự):

1. `af8551f` — R1 control plane: migration, receipts, claim redelivery, grants (R1A/R1B/R1C phía server) + test DB
2. `2b06ec6` — `manage.mjs` grant/ungrant/rotate (R1C)
3. `b433f21` — `worker.py` v1-r1 recovery + unit test Python + test phục hồi qua API thật (R1A/R1B/R1C phía worker)
4. `afc37ff` — docs protocol v1-r1 / runbook PC
5. `a3d051a` — phân loại lỗi adapter theo **mã thật của PC** (exit 78 / exit 2 + JSON), bỏ bảng 3/4/5/6 tự đoán (R1C)

### Nhận bàn giao trên Mac

Bundle + diff + log đặt **chỉ trên Mac** ở `fitmatch_AI/claude-handoff-local/worker-recovery-r1/` (có `README-LOCAL-ONLY.md`; chứa source app nên **không** được stage vào nhánh tài liệu công khai). `git bundle verify` trên Mac: okay, ref `codex/worker-recovery-r1` = `a3d051ad34724fece819017064d7e16fb4968794`.

- `worker-recovery-r1.bundle` sha256 `55f242793664d6d1219310fdd35a32e9dd86c568edfc7b6129c0bb858146bf80` (chỉ chứa d2a9898..a3d051a)
- `worker-recovery-r1.diff` sha256 `24722c516d4623bd627578a429765ac100c42cab22d40990a76e3873369a7f99`
- `logs/` — log đầy đủ của mọi lệnh bên dưới

Tạo đúng branch/worktree trong prompt (chạy trên Mac, trong `fitmatch_AI`; không đụng worktree Studio):

```sh
cd /Users/khoihoang/Documents/fitmatch_AI
git bundle verify claude-handoff-local/worker-recovery-r1/worker-recovery-r1.bundle
git fetch claude-handoff-local/worker-recovery-r1/worker-recovery-r1.bundle codex/worker-recovery-r1:codex/worker-recovery-r1
git worktree add /Users/khoihoang/Documents/fitmatch_AI-recovery-r1 codex/worker-recovery-r1
git -C /Users/khoihoang/Documents/fitmatch_AI-recovery-r1 rev-parse HEAD   # a3d051a…
```

File tạm `fitmatch_AI/.git/claude-r1-transfer.bundle` (bundle đọc d2a9898) có thể xóa tay; bridge không xóa được.

## 2. File thay đổi (15 file, +1700/−214)

| File | Nội dung |
|---|---|
| `supabase/migrations/20261106025506_worker_recovery_r1.sql` | **mới**, tạo bằng `supabase migration new` (CLI 3.0.0). Additive |
| `src/lib/v2/contracts.ts` | `claimRequest`, `outputIntentRequest` (sha256), `TIMEOUT`, `protocolRevision`, types |
| `src/lib/v2/server.ts` | `outputIntent()`, finalize kiểm sha256/bytes, đánh dấu `rejected`, 404 `ASSET_NOT_UPLOADED`, map `LEASE_LOST` |
| `src/app/api/v2/[...path]/route.ts` | claim → `fm_v2_claim_r1`; output-intent idempotent (legacy khi thiếu sha256); heartbeat trả `grantedCapabilities`; `compute/status` chỉ hiện declared ∩ granted |
| `scripts/worker/worker.py` | checkpoint bền vững, retry phân loại, redelivery, lock, phân loại lỗi, lọc env |
| `scripts/worker/manage.mjs`, `config.example.json` | create kèm quyền, grant/ungrant/rotate/revoke |
| `scripts/worker/test_worker_unit.py`, `tests/worker-transport.test.ts` | unit test Python chạy trong `npm test` |
| `scripts/test-worker-recovery.mjs` | **mới**: route thật + SQL thật + worker Python thật + proxy gây lỗi |
| `scripts/test-v2-db.mjs`, `test-v2-http.mjs`, `v2-http-fixture.mjs` | regression R1; fixture nạp migration mới, cấp quyền worker, giả lỗi storage |
| `docs/worker-api-contract-v1.md`, `docs/pc-worker-connect.md` | revision v1-r1, policy phục hồi, rollout/rollback |

Không đụng viewer/quiz/recommender/cache-generation/ảnh/privacy/animation/PC adapter.

## 3. Migration, tương thích, rollback

- Thứ tự: `20261105_studio_control_plane.sql` → `20261106025506_worker_recovery_r1.sql`. Chỉ thêm cột/bảng/RPC; thay `fm_v2_transition` và `fm_v2_claim(uuid)` **cùng chữ ký** (giữ grants). RPC mới đặt tên riêng (`fm_v2_claim_r1`, `fm_v2_output_intent`) để PostgREST không phải chọn giữa overload. Cuối file `notify pgrst, 'reload schema'`.
- **Default deny:** sau migration worker không nhận job cho tới khi `manage.mjs grant`. Đây là thay đổi hành vi có chủ đích.
- Worker cũ (`worker.py` của d2a9898) **vẫn chạy được** với server mới khi đã cấp quyền: đã chứng minh bằng test (`v2-with-legacy-worker.log`). Khác biệt duy nhất: complete trùng lặp giờ trả 200 thay vì 409.
- Rollback: deploy lại app cũ, **giữ schema** (không xóa dữ liệu). App cũ gọi `fm_v2_claim(uuid)` — vẫn tôn trọng quyền đã cấp.
- Thay đổi phụ: finalize ảnh (browser) khi object chưa upload giờ trả 404 `ASSET_NOT_UPLOADED` thay vì 503.

## 4. Protocol revision v1-r1 và policy phục hồi

Chi tiết trong `docs/worker-api-contract-v1.md` mục “R1 changes”. Tóm tắt:

- **Complete:** receipt bền vững (`fm_v2_job_receipts`, chỉ service role). Replay cùng worker + lease token + asset sau success → 200. Token/asset/worker khác, worker bị thu hồi, job đã cancel, token cũ → 409. Không đưa receipt/token ra API browser.
- **Fail:** bị từ chối nếu attempt đó đã có output verified (chặn “fail mù” cả phía server).
- **Output-intent:** cùng job + bytes + sha256 → cùng asset (URL mới mỗi lần). Asset đã `ready` (kể cả từ attempt trước) được dùng lại → không tạo artifact logic mới.
- **Finalize:** kiểm bytes **và** sha256 so với intent; sai → asset `rejected`, worker xin intent mới.
- **Claim redelivery:** cùng worker + cùng `instanceId` + lease còn hạn + chưa heartbeat job → nhận lại đúng job/token/attempt. Instance khác, claim legacy, hay job đã báo tiến độ → 204. Không cần fencing số: UUID lease + attempt + `claim_instance` đủ, đã kiểm 8 claim song song.
- **Worker checkpoint** `workDir/jobs/<jobId>/checkpoint.json` (ghi atomic): `inferring → output_ready → uploading → finalized → completed`. Output chỉ được dùng lại khi job/model/kind/engine revision/input digest/bytes/GLB header/sha256 khớp và file nằm trong thư mục job. Checkpoint hỏng/lạ → đổi tên `checkpoint.rejected.*`, không tin, không xóa.
- **Retry:** lỗi mạng/timeout/429/5xx → backoff mũ + jitter, có giới hạn. 409 → dừng, giữ checkpoint. 401/403 → credential mất. Hết retry khi đã có output → **không fail**, giữ checkpoint; vòng sau: replay complete nếu đã finalize, else heartbeat lease cũ rồi publish tiếp; lease mất → server requeue → claim mới dùng lại output.
- **Restart giữa inference:** không có output tin cậy → chạy lại chỉ khi có lease mới. Một worker / `workDir`; trên POSIX adapter thừa kế lock nên adapter mồ côi chặn inference thứ hai. Windows: job object kill-on-close (**chưa kiểm trên PC**).
- **Lỗi:** revision không khớp → `MODEL_UNAVAILABLE` ngay. Phân loại adapter theo report PC-CONF-01 (draft PR #1, adapter `37213bc`): một exit chỉ được ánh xạ khi nằm trong bảng **và** dòng stderr cuối là một JSON `{"success":false,"code":<cùng mã>}`. Mặc định: **78 → MODEL_UNAVAILABLE**, **2 → INVALID_INPUT** (đúng adapter thật). Usage argparse, mã lạ, JSON hỏng/không khớp → INFERENCE_FAILED. Không dò traceback. Mã khác (ví dụ OOM) chỉ qua `exitCodes` do operator khai báo sau khi hai bên thống nhất. Exit 0 mà không có GLB hợp lệ → EXPORT_FAILED. Quá giờ → `TIMEOUT` (mã mới v1-r1; **PC đề xuất INFERENCE_FAILED — cần chốt**). Stderr thô giữ riêng trong thư mục job, không chuyển đi. **Mapping là tạm thời cho tới khi PC và Mac ghim cùng revision.**
- **Env adapter:** bỏ mọi biến tên giống secret, mọi `FITMATCH_WORKER*`, mọi giá trị chứa token.

## 5. Kiểm thử

Môi trường: máy ảo cloud Linux, Node 22.23.4, Python 3, Docker 29.9.2 (`postgres:16-alpine`, network none), Playwright Chromium headless 1248. Không Supabase/PC/GPU thật.

### (a) Báo cáo session trước

`docs/v2-s1-s2-status.md` của owner Mac (không lặp lại ở đây).

### (b) Chạy trong phiên này

Baseline d2a9898 trước khi sửa: lint 0, unit 30/30, build 0, `test:v2:db` 0, `test:v2` 0 (`baseline-d2a9898-*.log`).

**Revision cuối `a3d051a`:**

| Lệnh | Exit | Ghi chú |
|---|---|---|
| `npm run lint -- --max-warnings=0` | 0 | |
| `npm test` | 0 | 31/31 (gồm 10 unit Python, có các trường hợp exit 78/2/usage/mismatch) |
| `npm run build` | 0 | Next 16.4.5 |
| `npm run test:v2:db` | 0 | PASS R1 PostgreSQL + PASS S1 |
| `npm run test:v2` | 0 | 11 dòng PASS, gồm “PASS R1 worker recovery” |
| `npm audit --omit=dev` | 0 | 0 vulnerabilities |
| `node scripts/test-quota-db.mjs` | 0 | job CI quota |
| `python3 -I scripts/worker/test_worker_unit.py -v` | 0 | 10 test |
| `R1_LEGACY_WORKER=<d2a9898 worker.py> npm run test:v2` | 0 | worker cũ vẫn hoàn tất job |

**Test bắt được lỗi trên code cũ** (exit 1 thật; chạy với bộ test ở `afc37ff`, phần phân loại lỗi bổ sung ở `a3d051a` không chạy lại âm tính):

- `test:v2` dùng `worker.py` của d2a9898 → exit 1, assertion đầu tiên ở S1 (`negative-v2-oldworker.afc37ff-tests.log`).
- `test:v2:db` với `fm_v2_transition` của d2a9898 → exit 1, `identical complete replay is idempotent: 'f' !== 't'` (`negative-v2db-oldtransition.afc37ff-tests.log`).

**Kịch bản phục hồi qua API thật** (`scripts/test-worker-recovery.mjs`; adapter đếm số lần chạy):

| # | Kịch bản | Kết quả kiểm | Số lần inference |
|---|---|---|---|
| S1 | complete đã commit, mất reply | succeeded, 1 receipt, ≥2 complete, 0 fail | 1 |
| S2 | complete không tới server (503 ×2) | succeeded, 0 fail | 1 |
| S3 | finalize đã commit, mất reply | succeeded, 1 asset GLB | — |
| S4 | PUT đã lưu nhưng mất reply; URL upload hết hạn | succeeded, 1 asset, intent lần 2 cùng asset | — |
| S5 | claim reply mất | “same assignment again”, attempt 1 | 1 |
| S6 | worker restart khi lease còn hạn | reconcile bằng lease cũ, attempt 1 | 1 |
| S7 | restart sau khi mất lease | attempt 2 dùng lại output, token cũ → 409 | 1 |
| S8 | engine revision không khớp | failed `MODEL_UNAVAILABLE` | 0 |
| S9 | exit 78+JSON; exit 2+JSON; usage exit 2; exit 3 chưa khai báo; exit 3 có `exitCodes`; quá giờ | `MODEL_UNAVAILABLE`; `INVALID_INPUT`; `INFERENCE_FAILED`; `INFERENCE_FAILED`; `OOM`; `TIMEOUT` — không publish output | — |
| S10 | khai báo nhưng chưa cấp quyền | `grantedCapabilities: []`, claim 204; cấp quyền rồi chạy được | — |
| S11 | worker bị kill giữa inference | worker thứ hai thoát mã 2 (lock adapter mồ côi); sau lease mới chạy lại | 2 (đúng policy: chưa có output tin cậy) |
| S12 | `manage.mjs` create/ungrant/grant/rotate/revoke | token cũ 401 sau rotate; revoke 401; kind lạ bị từ chối | — |

Tất cả kịch bản đều kiểm adapter **không nhận** biến chứa secret hay token.

DB (`test:v2:db`, PostgreSQL thật): default deny; 8 claim song song cùng instance → cùng job/token, attempt 1, không job thứ hai; instance khác, claim legacy, hay sau heartbeat → null; hết lease → attempt 2; output-intent idempotent và kiểm lease/owner; fail bị chặn sau publish; 6 complete song song → tất cả `t`, 1 receipt; token cũ/asset khác/worker khác/worker bị thu hồi/job đã cancel → `f`; reclaim dùng lại asset đã ready; role browser không đọc receipts, không gọi RPC mới; ràng buộc kind lạ.

### (c) Chưa chạy

- Supabase thật (PostgREST schema cache, Storage signed upload thật), migration trên project test.
- PC Windows thật: job object kill-on-close, `msvcrt` lock, mã exit adapter SiTH thật, GPU/VRAM.
- CI GitHub (nhánh chưa push).
- Two-owner GPU scheduler, cache regenerate, alpha PNG, privacy — **ngoài phạm vi R1**.

## 6. Còn tồn tại

1. Restart **trước khi** nhận được envelope (instance mới) vẫn phải đợi lease 120s hết hạn và tốn 1 attempt; chưa có output nên không mất kết quả.
2. Kill-on-close trên Windows viết bằng `ctypes` nhưng **chưa chạy thử**; nếu thất bại chỉ in cảnh báo. PC cần xác nhận trước live.
3. Mapping lỗi adapter theo mã thật của PC nhưng **chưa được hai bên chốt**; `TIMEOUT` (Mac) khác đề xuất INFERENCE_FAILED (PC). OOM chưa có mã thật.
4. Checkpoint/output trên PC không tự dọn; chưa có retention (thuộc R2/privacy).
5. Checkpoint của job đã bị cancel/hết attempt nằm lại; mỗi vòng worker thử heartbeat lại (rẻ, nhưng lặp).
6. Asset `rejected` và staging object không được dọn (GC dry-run thuộc FIX-MAC-07).
7. Job requeue sau mất lease vẫn tốn 1 attempt (tối đa 3); output không mất nhưng attempt thì có.

## 7. Process delta (để Codex nhập)

```text
### L-<id> — 05/11/2026 16:53 America/New_York — START — CL-RECOVERY-R1-20261105-01 / R1A,R1B,R1C (APP-01, QA-01A)
Receipt docs 4cb4bd1. Docs 87b07b2; app d2a9898 (Studio sạch, không sửa). Branch codex/worker-recovery-r1, worktree cloud Claude (lý do trong receipt).

### L-<id> — 05/11/2026 ~18:30 America/New_York — END / HANDOFF — CL-RECOVERY-R1-20261105-01
Final a3d051a (5 commits). lint/unit/build/test:v2:db/test:v2/audit/quota-db/python-unit exit 0 trên a3d051a; mapping lỗi theo adapter PC thật (78/2+JSON), tạm thời; test mới exit 1 với worker/transition d2a9898. Kịch bản S1–S12 qua route thật + SQL thật + worker thật; inference count giữ 1 ở S1/S2/S5/S6/S7. Chưa Supabase/PC/Windows/CI thật. Bundle+diff+logs local-only ở fitmatch_AI/claude-handoff-local/worker-recovery-r1/. Không push app/merge/deploy/migrate.
R1A/R1B/R1C: Assigned → Ready for review. Bước kế tiếp: Codex review + retest; owner/chủ dự án tạo worktree Mac từ bundle; PC xác nhận exit codes và chạy unit/kill-on-close trên Windows trước live.
```
