# Patch proposal — V2 worker recovery (CL-REVIEW-20261105-01)

Chỉ là đề xuất cho owner Mac hiện hữu; **chưa áp dụng** vào `fitmatch_AI-3d-studio`. Baseline `d2a9898`. Mỗi mục kèm test cần thêm (chuyển từ `repro-20261105/` vào `scripts/test-v2-db.mjs` / `test-v2-http.mjs`).

## P1, P2, P4 — SQL (đã kiểm trên PG16 cục bộ)

File: [`repro-20261105/proposed_worker_recovery.sql`](./repro-20261105/proposed_worker_recovery.sql), additive trên migration hiện có:

- `fm_v2_jobs.completed_token`: complete lưu token; replay cùng worker + token + asset sau success trả `true`. Token/asset khác vẫn `false`; `fail` sau success vẫn `false`.
- `fm_v2_jobs.claim_instance` + `fm_v2_claim(p_worker, p_instance)`: claim lại từ **cùng instance**, khi job còn `stage='starting'` (worker chưa từng heartbeat) và lease còn hạn → trả lại đúng job/token/attempt, gia hạn lease. Instance khác hoặc job đã có tiến trình → 204 như cũ. Hàm 1 tham số cũ vẫn chạy (không redelivery) để worker cũ không vỡ.
- `fm_v2_workers.allowed_capabilities text[]`: claim yêu cầu `kind` vừa nằm trong khai báo heartbeat vừa nằm trong danh sách operator cấp. **Mặc định rỗng** → worker hiện có không nhận job cho tới khi cấp quyền; cần `manage.mjs grant OWNER WORKER avatar.reconstruct` (lệnh mới).
- Index fitting cache thêm `generation` (chuẩn bị P5).

Kiểm: `bash verify_proposal.sh` → **11/11 OK** (`verify_proposal.log`). Chưa chạy bộ `test:v2:db` gốc trên bản có proposal — owner phải chạy lại toàn bộ.

API cần đổi kèm: `claim` đọc `instanceId` (UUID) từ body (zod `.strict()` hiện tại sẽ từ chối field lạ → phải thêm vào schema); `compute/status` nên trả capability **được cấp**, không phải tự khai.

## P3 — worker.py (phác thảo, chưa chạy)

```python
INSTANCE = str(uuid.uuid4())            # một lần mỗi process
job = client.api('claim', {'instanceId': INSTANCE})

def retrying(call, attempts=6, first=2.0):
    """Lặp lại request idempotent khi lỗi mạng/5xx; 401/403/409 vẫn là LeaseLost."""
    delay = first
    for i in range(attempts):
        try:
            return call()
        except LeaseLost:
            raise
        except Exception:
            if i == attempts - 1:
                raise
            time.sleep(delay); delay = min(delay * 2, 30)

# trong execute(), thay đoạn upload/finalize/complete:
for upload_try in range(3):
    intent = retrying(lambda: client.api(prefix + 'output-intent', {**lease, 'bytes': size}))
    try:
        put(intent['uploadUrl'], output)        # PUT như hiện tại
        break
    except Exception:
        if upload_try == 2: raise
retrying(lambda: client.api(prefix + 'finalize', {**lease, 'assetId': intent['assetId']}))
finalized = True                                 # từ đây KHÔNG gửi fail nữa
retrying(lambda: client.api(prefix + 'complete', {**lease, 'assetId': intent['assetId']}))
```

- Nhánh `except Exception`: nếu `finalized` thì chỉ log, **không** gọi `fail` (để lease hết hạn còn hơn hủy kết quả); server P1 bảo đảm replay complete an toàn.
- Kiểm `modelRevision`/kind **bên trong** `try`, gửi `fail` với `MODEL_UNAVAILABLE` (hiện tại raise trước `try` → job kẹt, repro W2).
- Download: bắt cả `URLError`/`TimeoutError` để renew `input-url`, không chỉ `HTTPError`.
- Exit code adapter → mã lỗi: đề xuất `3=OOM`, `4=INVALID_INPUT`, `5=EXPORT_FAILED`, khác = `INFERENCE_FAILED`. PC xác nhận vì adapter thuộc PC.
- `directory.mkdir(exist_ok=False)` sẽ lỗi khi P2 redelivery cùng attempt → dùng `exist_ok=True` và dọn file cũ trong thư mục của job đó.
- Hồi quy: `worker_repro.py` W1 phải cho chuỗi `…finalize, complete(503), complete` và **không** có `fail`; W2 phải có `fail:MODEL_UNAVAILABLE`.

## P5 — fitting cache

`fm_v2_enqueue` (nhánh fitting): nếu job của generation mới nhất `failed` với `attempt>=3` thì tạo model fitting mới `generation+1`; ngược lại giữ hành vi reuse. Khi PC nâng engine/revision, operator có thể tăng generation để tạo lại thay vì phục vụ output engine cũ. Test: R4 phải trả job mới.

## P6 — hai owner, một GPU (tạm thời, không đổi wire)

Một process worker giữ nhiều token (`FITMATCH_WORKER_TOKENS`, mỗi token vẫn bound một owner, **không** service-role), claim lần lượt round-robin, chạy tối đa một job; thêm khóa file độc quyền `workDir/.gpu.lock` (`msvcrt.locking` trên Windows, `fcntl.flock` nơi khác) để process thứ hai thoát ngay. Hạn chế: không có fairness phía server; lâu dài cần bảng host + grant theo owner — cần Codex và PC duyệt. Test: hai owner enqueue cùng lúc → không bao giờ 2 job `running` có cùng host.

## P7 — chuẩn hóa ảnh

Trong `finalizeAsset`: `.flatten({ background: '#ffffff' })` trước `.jpeg()` (ảnh PNG trong suốt hiện ra nền đen); cân nhắc lưu thêm bản gốc độ phân giải cao cho ảnh chi tiết logo. PC đo ảnh hưởng 2048px/JPEG95 lên texture/logo bằng ảnh thật trước khi chốt.

## P8 — xóa và retention

- `deleted_at` cho `fm_v2_models`/`fm_v2_assets`; `fm_v2_transition('complete')` từ chối khi model đã xóa; claim bỏ qua model đã xóa; API `DELETE /api/v2/models/:id` (chặn nếu look còn tham chiếu, hoặc xóa look theo lựa chọn người dùng).
- GC **dry-run** liệt kê: staging đã finalize, intent pending >24h, output của job canceled/failed không tham chiếu. Chưa xóa thật trong đợt này.
- Worker PC: `retentionDays` cho `workDir`, xóa thư mục job đã kết thúc sau hạn; mặc định chỉ log danh sách.

## Ghi chú tương thích wire

P2 thêm `instanceId` (tùy chọn), P3 dùng thêm mã lỗi đã có trong contract. Đề xuất giữ `protocolVersion: 1` vì tương thích ngược, nhưng ghi changelog trong `docs/worker-api-contract-v1.md`; PC và Mac xác nhận revision trước khi copy `worker.py` sang PC.
