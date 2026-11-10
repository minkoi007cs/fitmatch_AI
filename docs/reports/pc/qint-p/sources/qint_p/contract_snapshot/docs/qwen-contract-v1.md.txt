# Qwen garment analysis — contract v1 (PROPOSAL, QINT-C)

`fitmatch.qwen-garment-analysis.v1`, policy `qint.1`. **Trạng thái: proposal.** Chưa phải wire đã chốt cho tới khi PC Qwen ACK conformance producer→consumer, PC 3D ACK vị trí lock, và Codex review (H-QWEN-018). Feature flag `QWEN_ANALYSIS_ENABLED` mặc định OFF; worker chỉ claim được `garment.analyze` khi operator đã grant trên **test server**.

Nguồn máy đọc được: `src/lib/v2/qwen.ts` → `schemas/qwen-v1/*.json` (Draft 2020-12, có cả rule liên trường) và `fixtures/qwen-v1/` (4 valid, 16 invalid kèm lý do, adapter input mẫu, error envelope). Kiểm: `python scripts/check-qwen-contract.py [result.json ...]` (cần `jsonschema`), `node --import tsx scripts/export-contract.mjs --check`.

## Luồng

```
browser (owner) ── POST /api/v2/analyses {itemId} ──► server: owner check, flag ON,
   tải ảnh wardrobe (≤10 MB, JPEG/PNG/WebP → JPEG chuẩn hóa), sha256,
   RPC reserve (dedupe không tốn quota; quota job 50/ngày UTC + 20 active chung với 3D; quota asset 100/24h;
   ghi asset pending + cleanup intent có hạn 15 phút TRƯỚC khi upload) → upload snapshot bất biến vào private
   bucket fitmatch-v2 → RPC enqueue (kiểm lại item + quota, finalize asset ready, xóa intent, tạo
   fm_v2_analyses + fm_v2_jobs kind garment.analyze). Lỗi giữa chừng → RPC abort + xóa object ngay; nếu lỗi tiếp
   thì intent vẫn còn cho collector (QREV-QUOTA/SNAPSHOT)
PC worker ── outbound HTTPS, poll ──► POST /api/v2/worker/claim (đang giữ host GPU lock)
   ◄── envelope: input.binding, 1 asset signed URL (chỉ snapshot), outputContract {format: "json-v1"}
worker: tải + kiểm sha/bytes → input.json → adapter (OwnedProcessTree) → result.json ≤ 8192 B
   → drain toàn cây process → POST /api/v2/worker/jobs/:id/result {leaseToken, sha256, resultJson}
server: lease fencing + sha + schema + binding/modelRevision/policy khớp job → analysis.status = review
browser: xem đề xuất, sửa/chấp nhận từng trường → POST /api/v2/analyses/:id/confirm
   → RPC nguyên tử: owner, item còn tồn tại và cùng image_path, result digest, confirmationId replay
```

Heartbeat của worker có thêm trường **tùy chọn** `gpuBusy: boolean` (QREV-STATUS, mở rộng của transport app, không đổi schema v1-r2 xuất cho PC adapter): `true` khi lần claim gần nhất thấy GPU dùng chung đang bị giữ (lock bị process khác giữ, hoặc slot đang cấp cho owner PC kia). `GET /api/v2/analyses` trả `gpuBusy` chỉ dựa trên worker online của **chính owner**; UI nói "PC đang bận GPU với việc khác" mà không tiết lộ việc của ai, không tốn attempt.

Không có API công khai trên PC, không cổng inbound, không service-role ở browser. Ảnh là **dữ liệu không tin cậy**, không phải chỉ dẫn (`policy.imageIsUntrustedData: true`): adapter không được thực thi tool call/URL/lệnh nào đọc được trong ảnh.

## Claim envelope cho `garment.analyze`

Giống v1-r2 (`protocolVersion` 1, `lease`, `modelRevision` = capability đã grant), khác ở:

- `input.binding` = `{jobId, analysisId, itemId, imageAssetId, imageSha256}` — không gửi owner id cho worker (least privilege; server tự giữ owner). Khác PR7 `binding.owner_id/source_revision`: `imageAssetId` + `imageSha256` của snapshot bất biến thay cho `source_revision`.
- `input.assets` đúng 1 phần tử `{role: "garment_image", assetId, url, sha256, bytes, mediaType: "image/jpeg"}`; `input-url` chỉ ký lại đúng asset này.
- `input.policy` = `{policyRevision, maxOutputTokens 192, maxSchemaAttempts 2, maxResultBytes 8192, timeoutSeconds, imageIsUntrustedData true}`.
- `outputContract` = `{format: "json-v1", schema: "fitmatch.garment-analysis.result.v1", maxBytes: 8192}`. Worker không gọi output-intent/finalize/complete cho kind này.

## Adapter

- Input: `schemas/qwen-v1/analysis-adapter-input.json` (ví dụ `fixtures/qwen-v1/adapter-input.json`). Argv do operator cấu hình (`{input}`/`{output}`), không bao giờ từ app/user.
- Output: `outputPath` chứa **đúng một object** `analysis-result` ≤ 8192 byte UTF-8. Binding/modelRevision/policy copy nguyên từ input. `approvedForAutoApply` luôn `false`. OCR chỉ nằm ở `candidateLogoTexts` (≤4 × ≤32 ký tự, `ocrStatus: unverified`), không bao giờ là giá trị đã duyệt. Không chắc thì `unknown` hoặc `outcome: abstained` + `abstainReason`.
- Lỗi: exit code + dòng stderr cuối `{"success": false, "code": ...}`, cả hai phải khớp, không thì worker coi là `INFERENCE_FAILED`.

| Exit | Code | Server xử lý |
|---|---|---|
| 75 | GPU_BUSY | retryable: requeue sau backoff, **không** tốn attempt; tối đa 5 lần rồi `failed` |
| 74 | MEMORY_PRESSURE | như GPU_BUSY (admission RAM/VRAM không đạt trước khi load) |
| 70 | INVALID_OUTPUT | terminal (đã hết 2 schema attempt) |
| 71 | OOM | terminal |
| 78 | MODEL_UNAVAILABLE | terminal |
| 2 | INVALID_INPUT | terminal |
| khác / timeout | INFERENCE_FAILED / TIMEOUT | terminal; user có thể bấm phân tích lại (tối đa 3 attempt) |

## GPU: một lock owner

Worker là **lock owner duy nhất** cho mỗi lần thực thi GPU: nó chỉ claim khi đã giữ đúng lock dùng chung của PC3D (`<workspace>/coordination/gpu0.lock`, msvcrt byte 0) — được **ràng buộc** qua policy của điều phối viên `gpu-coordinator.json` (pin sha256) ghi danh tính file của lock; config không được khai đường dẫn lock/slot/guard (QREV-BIND-02) — guard khớp hash trong policy và slot `gpu0-slot.json` cùng thư mục đang cấp cho `pc-ai`, và chỉ nhả sau khi `OwnedProcessTree.drain()` chứng minh launcher, interpreter thật và mọi descendant đã exit (PC-QUIESCENCE-01). Không chứng minh được thì worker **quarantine**: giữ lock, không claim, kiểm lại mỗi chu kỳ. Adapter nhận `FITMATCH_GPU_LOCK_HELD_BY=worker` và `FITMATCH_GPU_LOCK_PATH`: shared guard/runner của PC3D phải thấy biến này và **không** lấy lại cùng lock (tránh deadlock lồng). Qwen load chỉ sau khi đã có lock và qua admission RAM/VRAM; unload trước khi exit; không resident sau job. PC3D cần ACK file policy (sha256), danh tính lock + byte 0 + hash guard.

## Kết quả và xác nhận của người

- Server lưu nguyên bytes (`result_json`), `result_sha256` = sha256 của bytes đó, cùng bản đã parse. Kết quả đến muộn sau khi job bị hủy, lease bị fence, item bị xóa hoặc đổi ảnh thì bị từ chối hoặc đánh dấu `stale`, không bao giờ được áp.
- Confirm: `{confirmationId, expectedResultSha256, decision: approve|reject, fields}`. Chỉ ghi những trường người dùng gửi lên (`category` tshirt/jeans → `t-shirt`/`jeans`, `primaryColor`, `secondaryColor`, `pattern` solid/striped/printed/checked/other → plain/striped/graphic/plaid/other, `logoText` người gõ). `unknown` không bao giờ được ghi. Gửi lại cùng `confirmationId` là replay idempotent; một confirmation khác cho analysis đã chốt → 409.
- Dedupe: `(owner, item, imageSha256, policyRevision)` → cùng một analysis; đã confirm thì không chạy lại GPU.

## Khác với proposal PR7 (để PC đối chiếu)

| PR7 | v1 | Lý do |
|---|---|---|
| snake_case, `pc-ai.review-envelope.v2` | camelCase, `fitmatch.garment-analysis.result.v1` | đồng bộ với wire v1-r2 của app |
| `binding.owner_id`, `source_revision` | `analysisId`, `imageAssetId`, `imageSha256` | worker không cần owner id; snapshot bất biến làm source version |
| `material_composition`, pockets (const unknown) | bỏ | model không ground được, không ghi |
| `envelope_digest` do PC tính | server tính sha256 trên bytes nhận được | tránh lệch canonicalization giữa hai bên |
| `policy_revision: quality03.1` | `qint.1` | policy app riêng; PC map nội bộ |
| — | `outcome`/`abstainReason`, `evidence` (attempts/tokens/ms/gpuMiB) | abstention rõ ràng và đo đạc có giới hạn |

## Checklist ACK

- [ ] PC Qwen: adapter đọc `analysis-adapter-input`, ghi `analysis-result`, chạy `check-qwen-contract.py` trên output thật/synthetic, exit codes như bảng; gửi source+hash.
- [ ] PC 3D: guard không nest khi `FITMATCH_GPU_LOCK_HELD_BY=worker`; tạo `gpu-coordinator.json` bằng `scripts/worker/gpu_coordinator_policy.py write`, ACK sha256 policy + danh tính lock + byte 0 + hash guard; chạy native drain + binding tests trên nhánh này.
- [ ] Codex: review contract, migration, drain fix trước khi grant capability trên test server.
