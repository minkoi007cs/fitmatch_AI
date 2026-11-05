# FitMatch worker contract v1 — bản đề xuất lịch sử

> Reconcile PROC-0002: bản đề xuất này không khớp V2 code đang có trên Mac. Không triển khai prefix này song song. Xem [H-RESUME-002](./reassignment-2026-11-05.md) và [snapshot giao thức hiện thực](./resume-snapshot-20261105/docs/worker-api-contract-v1.md). Các yêu cầu idempotency/scope giữ làm checklist gap review; wire baseline chưa PASS.

Ngày 05/11/2026. Đây là contract đề xuất đã dùng để giao việc, chưa có server/worker triển khai. Hai bên triển khai cùng v1; bất kỳ thay đổi field/semantics phải ghi proposal và thống nhất trước tích hợp. Claude sở hữu server/schema, PC sở hữu worker/exporter.

## Transport và identity

- HTTPS JSON, prefix `/api/worker/v1`; PC chủ động kết nối ra ngoài, không inbound port.
- `Authorization: Bearer <worker credential>` riêng, do server provision, có revoke/rotate; không dùng user session hoặc Supabase service-role key trên PC. Server lưu verifier/hash phù hợp, không log credential. Chỉ claim trong owner allowlist/capabilities được cấp phía server, không tin owner do worker tự gửi.
- Claim/heartbeat/complete/fail có runtime validation và giới hạn body. Lỗi JSON thống nhất `{ "error": { "code": "...", "message": "...", "retryable": false } }`, message không lộ stack/secret. Các endpoint không thuộc worker tiếp tục kiểm session/owner theo app.
- `401/403`: lỗi identity/permission; dừng retry dồn dập. `409`: stale lease/version hoặc completion xung đột. `429/503`: backoff có jitter và tuân thủ Retry-After nếu có. Timeout không đồng nghĩa job chưa được server ghi nhận.

## Job lifecycle và envelope

`queued → leased → running → succeeded | failed | canceled`; `needs_input` là trạng thái chờ bổ sung, lần submit ảnh sửa tạo snapshot/job mới. Server giữ attempt/max_attempts, worker không tự requeue vô hạn.

`POST /claim` body `{ "capabilities": ["avatar.static.v1", "garment.static.v1", "fitting.static.v1"], "worker_version": "..." }`; server intersect capabilities với registry. Một worker chỉ có một GPU job active. Atomic claim trả `200` envelope bên dưới hoặc `204` khi không có job. Claim retry trong khi còn active lease phải trả lại active assignment của worker, không lấy job thứ hai. Nếu reply thất lạc trước heartbeat, lease sẽ hết hạn và server recover có giới hạn.

```json
{
  "contract_version": "1.0",
  "job_id": "uuid",
  "owner_id": "uuid",
  "type": "avatar.static.v1",
  "attempt": 1,
  "lease_token": "opaque-secret",
  "fencing_token": 1,
  "lease_expires_at": "ISO-8601 UTC",
  "input_hash": "sha256",
  "input": {
    "avatar_version_id": "uuid-or-null",
    "garment_version_id": null,
    "pose_id": "rest-v1",
    "height_m": 1.7,
    "sources": [
      { "asset_id": "uuid", "role": "person_front", "sha256": "sha256", "mime_type": "image/jpeg" }
    ],
    "dependencies": [],
    "parameters": {}
  }
}
```

Đây là ví dụ field, không phải payload hợp lệ để chạy nguyên văn. Server xác định UUID/hash thật, kiểm input theo type. `avatar.static.v1`: avatar version + person sources + height; `garment.static.v1`: garment version + front/back/optional detail + parameters category và số đo nếu có; `fitting.static.v1`: cả avatar/garment version + dependency manifest asset IDs của hai phiên bản ready + pose. Dependencies dùng cùng quy tắc hash/asset scoping như sources. Role enum và parameters allowlist được Claude định nghĩa JSON Schema theo type, PC review trước run end-to-end; không nhận dict tùy ý thành CLI/code.

- Idempotency tạo job ràng buộc owner + type + canonical input/version hash; cùng key khác payload trả conflict, hai user không chia kết quả.
- `POST /heartbeat`: `{job_id, lease_token, fencing_token, stage, progress?}`; progress chỉ gửi khi có cách đo thật. Heartbeat gợi ý 30s, lease gợi ý 180s, server trả expiry authoritative; cấu hình theo benchmark.
- `POST /inputs/resolve`: lease identity + `asset_ids`; trả URL GET ngắn hạn chỉ cho input/dependency của assignment. Refresh URL không tạo job/model run mới; verify checksum sau download.
- `POST /uploads/prepare`: lease identity + danh sách `{client_asset_key, role, mime_type, size_bytes, sha256}`. Server cấp asset IDs/object keys và URL/method/headers upload đúng scope, không cho worker tự chọn path khác. Retry cùng job/attempt/client_asset_key + cùng metadata giữ mapping; metadata khác trả conflict. Prepare lại có thể làm mới URL hết hạn, không tạo object logic mới.
- `POST /complete`: lease identity + `{result_manifest_asset_id, artifacts:[{asset_id,size_bytes,sha256}]}`. File upload chưa tự ready; server kiểm tồn tại/metadata/checksum bằng quy trình có thực, verify manifest và version/tombstone trước atomic publish + succeeded. Không tin hash do worker báo là bằng chứng server đã xác minh bytes.
- Completion replay cùng accepted attempt/token/result trả success idempotent kể cả lease đã hết sau success; attempt cũ hoặc result khác trả 409. Client timeout phải retry cùng completion, không dựng lại ngay. Lease hết trước accepted completion không được publish.
- `POST /fail`: lease identity + `{code, stage, retryable, safe_message}`. Retryability cuối cùng theo policy server; lỗi OOM không lặp vô hạn cùng cấu hình. POST fail có fencing tương tự completion.
- Nếu heartbeat mất lease/canceled: dừng job an toàn, không publish. Server cancel/tombstone có ưu tiên hơn late completion. Input/output tạm cleanup theo retention và refs.

Lease identity trong mọi body: `job_id`, `lease_token`, `fencing_token`; worker identity lấy từ credential, không chỉ tin field. Atomic claim/renew/complete phải dùng DB transaction hoặc primitive tương đương, kiểm thật concurrency và permission.

## Manifest static v1

Manifest JSON là artifact riêng, private. Mọi model GLB nguồn đã được kiểm tra, không tham chiếu URL/file tùy ý. Ví dụ fitting:

```json
{
  "schema_version": "fitmatch.asset.v1",
  "kind": "fitting.static",
  "owner_id": "uuid",
  "avatar_version_id": "uuid",
  "garment_version_id": "uuid",
  "coordinate_system": { "up": "Y", "handedness": "right", "unit": "meter", "front": "+Z" },
  "pose_id": "rest-v1",
  "assets": [
    { "asset_id": "uuid", "role": "body", "format": "glb", "sha256": "...", "size_bytes": 123 },
    { "asset_id": "uuid", "role": "garment", "format": "glb", "sha256": "...", "size_bytes": 123 }
  ],
  "animation_ready": false,
  "qa": { "status": "pending", "notes": [] },
  "provenance": { "engine": "...", "engine_commit": "...", "checkpoint_hash": "...", "manual_steps": [] }
}
```

- Body/garment GLB cùng origin, scale, pose và transform; materials/textures embedded cho bản đầu, tránh resource fetch ngoài scope. Thumbnail là asset riêng optional. Avatar manifest chỉ body, garment canonical manifest chỉ áo; fitting manifest tham chiếu cả hai asset đã chuẩn bị tương thích.
- Artifact áo canonical và áo đã drape có thể khác mesh; không gán asset canonical chưa fitted thành ready fitting.
- Cache key tối thiểu: avatar version + garment version + pose + material version + pipeline/engine version + export version. Khi thêm animation cần clip/skeleton/codec version, không reuse static cache làm animated asset.
- Viewer tải manifest và URL qua API user-auth owner-checked, không nhận worker credential. Giới hạn mesh/texture/GLB theo fixture và benchmark, reject asset hỏng, bounds/scale bất thường; worker chỉ export output đã kiểm, không chạy code nhúng hoặc đường dẫn từ model.
- `qa.pending` vẫn có thể cho xem preview ghi nhãn; không publish production-ready chỉ từ process exit 0. Review kỹ thuật/chất lượng là bước riêng; fixture luôn có provenance demo.

## Contract tests và giao nhận

Claude cung cấp machine-readable schemas + server fixture theo tài liệu này; PC cung cấp fixture manifest/asset và exporter validator. Mỗi bên có mock của phía kia để phát triển độc lập, nhưng phải chạy ít nhất một luồng thật cùng nhau trước G2 PASS. Test bắt buộc: claim race, active-lease retry, stale completion, duplicate complete, canceled/deleted input, upload interruption và cross-owner access. Các thông số TTL/caps được ghi trong config, không đổi field ngầm.
