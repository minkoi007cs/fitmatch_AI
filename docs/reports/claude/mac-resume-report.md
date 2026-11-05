# Mac resume report — Claude review, chưa tiếp quản code

Session: **CL-REVIEW-20261105-01** · Claude (cloud session, đọc Mac qua bridge) · 05/11/2026 16:30–17:00 America/New_York.
Vai trò: **AI mới, review read-only** theo agent.md §3 và H-RESUME-002 §4. Không sửa file nào trong `fitmatch_AI-3d-studio`, không sửa source/process của checkout điều phối. File mới duy nhất: thư mục `docs/reports/claude/` này.
Task liên quan: APP-00…04 (kiểm kê), QA-01A (review độc lập), INT-01A (proposal). Không claim task nào.

## 1. Baseline thực tế (kiểm lại, không dùng snapshot cũ)

| Vị trí | Kết quả kiểm lúc 16:30 |
|---|---|
| `fitmatch_AI-3d-studio` | branch `codex/3d-studio-worker`, HEAD **`d2a98983391c90c0df0c7decb67bd2b0d8cad9c6`** (16:16:39 −0500, “feat: add private 3D jobs, GPU worker and wardrobe-driven quiz”), **0 file dirty/untracked**. Snapshot `0ec92c6`+dirty của prompt đã lỗi thời: toàn bộ V2 dirty đã được owner commit (38 file, +5638/−1586). |
| Remote GitHub | Chỉ có `main`/`development`/audit = `ac26306`, `codex/app-system-auth` = `c05551c`. **d2a9898 chưa push** — chỉ tồn tại trên Mac. |
| `fitmatch_AI` (điều phối) | main `1ef8f25`, dirty 14 mục (AGENTS/CLAUDE/README, auth/login/landing, `agent.md`, `roadmap.md`, `process.md`, `docs/`, `src/lib/i18n/`, `state/`, `.agentui/`). Giữ nguyên. |
| Owner | Process vẫn ghi chat **Khảo sát app thử đồ 3D** (01a1a9db-…) giữ worktree. Phiên này không thấy được chat đó đang active hay không → **coi như owner vẫn giữ**. Chưa có handoff cho Claude. |

Đọc git bằng `GIT_OPTIONAL_LOCKS=0` để không ghi index của worktree active. Chép read-only 5 file (migration, worker.py, contracts.ts, studio/bundle.ts, package.json) sang máy ảo riêng để repro; hash khớp (xem repro README).

## 2. Code có sẵn và trạng thái APP (đề xuất cho process, không tự đổi)

| Task | Có code tại d2a9898 | Gap chính | Đề xuất trạng thái |
|---|---|---|---|
| APP-00 | `docs/worker-api-contract-v1.md` mô tả đúng code; zod schema `src/lib/v2/contracts.ts` | Chưa có JSON Schema xuất cho PC; chưa version manifest/provenance | In progress (giữ) |
| APP-01 | Migration control plane, `/api/v2/[...path]`, `worker.py`, `manage.mjs`, test DB/HTTP | G1–G6 dưới đây (đã repro) | In progress → **Changes requested** sau review Codex |
| APP-02 | Studio viewer, import ZIP/GLB/IndexedDB, mở model cloud có SHA256 | Chưa load GLB PC thật; validator không ép texture nhúng | In progress (chờ GLB PC) |
| APP-03 | `/prepare`, capture, compute status, cancel/retry | Không có xóa/retention; ảnh PNG trong suốt bị nền đen (G7) | In progress |
| APP-04 | `/looks`, rules-v1, feedback/undo, save/delete look, Studio swap | Fitting cache chết sau 3 lần fail (G5); chưa real integration | In progress |

Recommender là `rules-v1` (`src/lib/v2/recommend.ts`), không phải Qwen/model học feedback — khớp tài liệu owner.

## 3. Contract matrix — yêu cầu → code/test → gap

Baseline là wire `/api/v2/worker` hiện có. Cột “Test hiện có” lấy từ `scripts/test-v2-db.mjs` / `test-v2-http.mjs`.

| # | Yêu cầu (roadmap / proposal cũ) | Code | Test hiện có | Gap | Repro |
|---|---|---|---|---|---|
| C1 | Claim nguyên tử, một job/worker | `fm_v2_claim` SKIP LOCKED + check running | Có (claim song song, one job per worker) | — | — |
| C2 | Claim retry khi reply mất trả lại assignment, không job thứ hai | Trả `null` khi worker đã có job running | Không | **G2** job treo tới hết lease 120s, tốn 1 attempt | R2 |
| C3 | Lease/fencing, late completion bị chặn | lease_token UUID + lease_until, transition kiểm token | Có (expiry, stale, cancel) | — | — |
| C4 | Complete replay idempotent, timeout phải retry cùng completion | complete xóa token → replay trả false/409; worker gọi `fail` khi complete lỗi mạng | Không | **G1** output đã finalize bị hủy, job `failed`, user retry = chạy model lần 2 | R1, R1b, W1 |
| C5 | Upload/finalize đứt mạng: retry giữ mapping, refresh URL | finalize idempotent theo assetId; worker không retry upload/finalize, mọi lỗi → `fail` | Không | **G3** đứt mạng 1 lần = mất kết quả inference | (cùng cơ chế W1) |
| C6 | Input URL hết hạn được ký lại, checksum | `input-url` + kiểm bytes/SHA256 | Có (HTTP) | Timeout/URLError không renew, chỉ HTTPError | — |
| C7 | Capability: server intersect với registry được cấp | Heartbeat ghi thẳng capability tự khai vào DB; claim dùng nó | Có (filter theo khai báo) | **G4** không có allowlist phía server | R3 |
| C8 | Engine revision không khớp → fail rõ | `execute` raise trước `try` → không gửi `fail` | Không | **G4b** job kẹt running, lặp claim đến hết 3 attempts | W2 |
| C9 | Cancel/revoke ưu tiên hơn late result | cancel xóa token; revoke khóa worker row | Có | Output đã finalize sau cancel thành orphan | — |
| C10 | Delete/tombstone/retention, completion cũ không khôi phục | **Không có API xóa model/asset**; chỉ xóa look | Không | **G6** ảnh cá nhân giữ vô hạn, staging + verified cùng tồn tại; chưa có tombstone để fencing khi thêm xóa | — |
| C11 | Hai user / một GPU, không hai inference cùng lúc | Worker bound 1 owner; 2 owner = 2 process | Không | **G5b** 2 process giữ 2 job running cùng lúc trên một máy | R5 |
| C12 | Cache key gồm engine/pipeline version | Unique (user, avatar, garment) | Có (reuse) | **G5** cache không theo engine; job fail 3 lần → cặp avatar/áo không thể làm lại | R4 |
| C13 | Idempotency key + payload conflict | `fm_v2_enqueue` | Có | — | — |
| C14 | Owner isolation API/DB/storage | Admin client + `.eq(user_id)`, RLS read-only | Có (fixture) | Chưa test trên Supabase thật | — |
| C15 | Output GLB tự chứa, đúng trục/scale | `validateOutputGlb` kiểm mesh/buffer/finite; không Draco/KTX2 | Có | Không ép `embeddedTextures`, không kiểm trục/scale/bounds; không lưu provenance/`animation_ready` | — |
| C16 | Failure code có ý nghĩa (OOM…) | Worker luôn gửi `INFERENCE_FAILED` | Không | Không phân biệt OOM → retry mù | — |

## 4. Bằng chứng repro (đã chạy trong phiên này)

Môi trường: máy ảo cloud, PostgreSQL 16.15 cục bộ (socket, không network), Python 3, bản sao migration/worker.py không sửa. Lệnh và log đầy đủ trong `repro-20261105/`.

- `./repro.sh` → **exit 0, 14/14 kỳ vọng tái hiện**: R1 replay complete trả `f`; R1b `fail` được nhận dù đã có GLB ready → job `failed`, model không có output; R2 claim lại trả null, job `running` attempt 1 không ai chạy, sau hết lease thành attempt 2; R3 không có cột allowlist; R4 retry bị từ chối sau attempt 3 và yêu cầu mới (key khác) vẫn trả đúng job chết đó; R5 hai worker hai owner cùng giữ 2 job running.
- `python3 -I worker_repro.py` (fake server loopback, adapter synthetic ghi GLB 20 byte) → W1: server thấy `claim, output-intent, PUT, finalize, complete(503), fail:INFERENCE_FAILED`; W2: server chỉ thấy `claim`, worker in `ValueError`, không `fail`.
- `bash verify_proposal.sh` (migration gốc + `proposed_worker_recovery.sql`) → **11/11 OK**: allowlist chặn capability chưa cấp; cùng instance nhận lại đúng job/token/attempt, instance khác và job đã có tiến trình không nhận; complete replay trả `t`, asset/token khác trả `f`; claim 1 tham số cũ vẫn chạy. Đây là kiểm proposal riêng, **chưa** chạy cùng bộ `test:v2:db` gốc.
- Normalize ảnh (sharp **0.34.5** trong máy ảo; repo dùng ^0.35.5 — chưa chạy đúng bản): PNG nền trong suốt → pixel nền `[0,0,0]` (đen) sau `.jpeg()`; ảnh 4032×3024 → 2048×1536 (ít hơn 3,9× pixel). Ảnh hưởng texture/logo cần PC đo thật.

## 5. Kiểm thử — tách nguồn

| Loại | Nội dung |
|---|---|
| (a) Report session trước | `docs/v2-s1-s2-status.md`: lint/build/unit, `test:v2:db`, `test:v2` (Chromium + triangle synthetic), `npm audit --omit=dev` 0. Chưa CI GitHub. **Claude chưa chạy lại** trên d2a9898. |
| (b) Phiên này | Chỉ repro ở §4 (exit 0). **Not run** trên d2a9898: `npm run lint -- --max-warnings=0`, `npm test`, `npm run build`, `npm run test:v2:db`, `npm run test:v2` — vì không có thay đổi code và d2a9898 chưa push nên không lấy được bản đầy đủ ngoài worktree active. |
| (c) Chưa chạy | Supabase thật, Storage policy thật, enrollment token, HTTPS endpoint cho PC, PC worker/adapter thật, GLB lớn trong trình duyệt (bộ nhớ/FPS), hai tài khoản thật. |

Screenshot tam giác không chứng minh độ giống avatar; phiên này không chụp screenshot.

## 6. Patch proposal (cho owner hiện hữu thực hiện)

Chi tiết SQL/Python trong [patch-proposal.md](./patch-proposal.md). Thứ tự đề xuất, P1–P3 nên xong **trước PC live**:

1. **P1 complete idempotent** (SQL): lưu `completed_token`; replay cùng worker/token/asset sau success trả true.
2. **P2 claim redelivery có giới hạn** (SQL + worker): worker gửi `instanceId` ngẫu nhiên mỗi lần khởi động; claim lại cùng instance nhận lại đúng assignment/token (gia hạn lease), instance khác nhận 204.
3. **P3 worker transport**: retry có backoff cho finalize/complete/upload (upload hỏng → intent mới, tối đa 3); không bao giờ gửi `fail` sau khi finalize thành công; revision mismatch → `fail MODEL_UNAVAILABLE` ngay; map exit code adapter → OOM/INVALID_INPUT/EXPORT_FAILED.
4. **P4 capability allowlist** do `manage.mjs` cấp; heartbeat lưu giao của khai báo và allowlist.
5. **P5 fitting cache** thêm engine revision vào key; cho tạo version mới khi job đã hết attempts.
6. **P6 hai owner/một GPU** (tạm, không đổi wire): worker.py nhận nhiều token trong một process, claim lần lượt, một job một lúc, khóa file độc quyền trong `workDir` để chặn process thứ hai. Thiết kế lâu dài (host + grant theo owner) cần Codex/PC review.
7. **P7 ảnh**: flatten nền trắng (hoặc giữ PNG) trước JPEG; cân nhắc giới hạn riêng cho ảnh chi tiết logo; PC benchmark.
8. **P8 xóa/retention**: `deleted_at` tombstone cho model/asset, complete từ chối model đã xóa, API xóa, GC dry-run cho staging >24h và output orphan; retention thư mục job trên PC.

Wire thay đổi (P2 thêm field `instanceId`, P3 thêm failure code dùng thật) → tăng `protocolVersion` hoặc ghi rõ tương thích ngược; PC và Mac xác nhận trước khi copy worker sang PC.

## 7. Runbook môi trường test (chưa thực hiện)

1. Tạo **project Supabase test riêng** (không phải FitMatch production). Chạy schema gốc → các migration hiện có theo thứ tự → `20261105_studio_control_plane.sql`. Kiểm bucket `fitmatch-v2` private, 5 RPC chỉ service_role execute.
2. Deploy preview/HTTPS trỏ vào project test; đăng ký origin auth chính xác (không wildcard). `SUPABASE_SERVICE_ROLE_KEY` chỉ ở server.
3. Lấy UUID Supabase của tài khoản thử; trên máy quản trị: `node --env-file=.env.test scripts/worker/manage.mjs create OWNER_UUID`. Token in một lần, chuyển thẳng vào biến môi trường PC; không chat/commit.
4. PC chạy worker `engines: {}` → `/prepare` phải hiện online, không capability. Chỉ bật capability sau self-test adapter thật.
5. Rollback app: redeploy commit trước; migration additive nên **giữ bảng**, không xóa dữ liệu. Thu hồi worker: `manage.mjs revoke OWNER_UUID WORKER_UUID`.

Fixture storage trong `test:v2` không chứng minh Storage policy Supabase thật.

## 8. Điểm nối PC

Chưa nhận GLB nào từ PC. Khi có: kiểm texture nhúng, +Y lên, +Z trước, mét, pose/scale khớp avatar, ≤40 MiB, rồi load bằng **viewer Studio hiện có**. Body fitting/clothed mesh từ SiTH không được gắn nhãn clean body hay cho thay áo. Không mở animation.

## 9. Process delta (để Codex nhập, Claude không sửa process.md)

```text
### L-<id> — 05/11/2026 16:30 America/New_York — START — CL-REVIEW-20261105-01 / QA-01A (review), APP-00…04 (inventory)
Claude mới, read-only. Studio HEAD d2a9898 sạch (V2 đã commit, chưa push); main 1ef8f25 dirty. Không claim; owner Mac giữ nguyên.

### L-<id> — 05/11/2026 ~17:00 America/New_York — END / HANDOFF — CL-REVIEW-20261105-01
Report docs/reports/claude/mac-resume-report.md + patch-proposal.md + repro-20261105/. Repro PG16 local 14/14, worker 2/2 tái hiện G1,G2,G4,G4b,G5,G5b. Lint/test/build/test:v2* Not run trên d2a9898. Không sửa worktree, không push/migrate/deploy.
Bước kế tiếp: owner Mac thực hiện P1–P3 (+ test hồi quy từ repro) trước PC live; Codex review proposal; Claude chỉ sửa code sau handoff ghi revision và file scope.
```

Đề xuất cập nhật bảng: session registry thêm CL-REVIEW-20261105-01 (Kết thúc); OBS-MAC-3D baseline `0ec92c6+dirty` → `d2a9898 clean, chưa push`; B-004 kèm link report này.

## 10. Chưa làm / giới hạn

- Không có quyền tiếp quản → không sửa code, không chạy full suite trên worktree active.
- Không đo GLB lớn/bộ nhớ trình duyệt, chưa xem UI.
- Không kiểm Supabase/PC thật, không enrollment, không push/merge/deploy/migrate.
- Không có secret trong report này.
