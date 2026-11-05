# Fitmatch worker protocol v1 — contract để Mac và PC phát triển độc lập

Trạng thái: đề xuất implementation; chưa có các endpoints này chạy trong app. Không thay thế manifest GLB v1 hiện có.

## Transport và danh tính

PC chủ động HTTPS tới control plane. Model serving (Qwen/vLLM/FastAPI) bind loopback trong PC/WSL; web browser không gọi thẳng PC. Worker enrollment tạo credential scoped theo owner/workspace/capability và có thể revoke/rotate. Không dùng service role key trong worker. Endpoint auth kiểm tra machine identity trước đọc job; raw user_id trong body không được quyết định quyền.

## Capabilities

Ví dụ registry sau self-test:

```json
{
  "protocolVersion": 1,
  "workerId": "server-issued-id",
  "capabilities": [
    {"name":"vision.analyze","model":"Qwen3-VL-4B-Instruct","revision":"pinned-hash","profile":"quantized-single-image","status":"ready"},
    {"name":"avatar.reconstruct","model":"sith","revision":"pinned-hash","status":"unavailable","reason":"self_test_pending"}
  ],
  "limits": {"heavyConcurrency":1,"vramMiB":12288}
}
```

Thông số VRAM ví dụ, phải lấy thực từ PC; khai báo ready chỉ sau self-test. Các capability khác: style.rank, image.generate, garment.reconstruct, garment.drape, asset.export. Không suy ra capability từ model đã download.

## Endpoints dự kiến

- POST /api/v2/worker/heartbeat: version/capabilities/current lease/metrics an toàn.
- POST /api/v2/worker/claim: server atomic lấy một job phù hợp capability; không có việc trả 204.
- POST /api/v2/worker/jobs/:id/heartbeat: renew lease có token, stage/metrics; không tự xác nhận phần trăm.
- POST /api/v2/worker/jobs/:id/output-intent: URL upload staging có giới hạn bytes/type/expiry.
- POST /api/v2/worker/jobs/:id/complete: result metadata + output asset IDs; server validate/fence/publish.
- POST /api/v2/worker/jobs/:id/fail: stable reason, retriable boolean đã server chuẩn hóa, safe details.

## Job envelope

```json
{
  "protocolVersion":1,
  "jobId":"uuid",
  "kind":"garment.drape",
  "inputVersion":1,
  "lease":{"token":"opaque-secret","expiresAt":"ISO8601","attempt":1},
  "input":{
    "avatarVersionId":"uuid",
    "garmentVersionId":"uuid",
    "pose":"a-pose-v1",
    "units":"meters",
    "assets":[{"assetId":"uuid","role":"body","sha256":"hex","downloadUrl":"short-lived-signed-url"}]
  },
  "outputContract":{"format":"glb-v2","up":"+Y","front":"+Z","embeddedTextures":true,"maxFileBytes":41943040}
}
```

Secret và signed URL không log hay đưa vào user-visible response. Inputs là dữ liệu/schema, không shell scripts, eval code hoặc URL tùy ý. Worker dùng allow-listed handler, không chạy command từ job body.

## Completion và version safety

Results phải có source job ID/lease token/input hash, exact avatar/garment/model revisions và immutable staging asset IDs/hash/bytes. Server reject lease cũ, owner sai, resource ngoài allow-list, body/garment version mismatch hoặc invalid format. Expired download URL được gia hạn cho cùng input; không tạo job inference khác.

Output mesh GLB: shared origin/scale/pose; riêng body và áo; texture nhúng; bản đầu không Draco/KTX2. Số đo/fit claim không mặc nhiên có từ GLB. Output ảnh PNG/JPEG là image preview, không được đăng ký thành garment mesh.

Job states: waiting_for_worker, queued, leased, running, needs_input, succeeded, failed, canceled. UI ánh xạ theo record persisted. Cancel và retry lấy generation mới; result muộn không khôi phục record đã xóa/canceled. Retry phải kiểm tra lease/attempt policy và idempotency, không replay provider unknown-outcome mù.

## Adapter acceptance

Mac có fixture worker riêng cho test, tên/đầu ra được gắn nhãn synthetic; không chạy trong production như GPU thật. PC chạy conformance tests: no-job, claim, renew, upload, complete, fail, stale lease, cancel, restart, unsupported capability, OOM, expired URL và duplicate submission. Sau đó chạy một bộ ảnh thật với artifact/source rights đúng.
