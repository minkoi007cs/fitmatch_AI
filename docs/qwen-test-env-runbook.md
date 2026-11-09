# Runbook — chạy thử Qwen garment analysis (pilot có kiểm soát, BACKEND-024)

Backend duy nhất được duyệt cho FitMatch là project **`fitmatch-ai` / `gohczmqykjkrgdblgbog`** (main/pilot, phải **giữ nguyên** dữ liệu wardrobe/auth/storage/user hiện có). `smoke-supabase` (`wqbwwusrhertqktwsxsl`) đã ngừng dùng cho FitMatch: app, script operator và worker đều **từ chối** nó. Kiểm thử phá hủy/fault/migration chỉ chạy trên Docker PostgreSQL dùng một lần với dữ liệu tổng hợp. Không mở cổng/router/tunnel vào PC; PC chỉ gọi ra ngoài (HTTPS). Mọi credential nằm ở secret store/biến môi trường riêng (không commit, không dán vào log, chat hay report).

## 0. Điều kiện trước khi bật

- Codex review contract `docs/qwen-contract-v1.md`, migrations `20261107120000_qwen_analysis_qint.sql` + `20261108090000_qwen_review_qrev.sql` + `20261108150000_qrev_cleanup_claim.sql`, drain fix (PC-QUIESCENCE-01), bản sửa QREV (lock/quota/snapshot/status + collector claim) và **QREV-BIND-02 + ENV-CANON-01** → kết quả PASS.
- PC Qwen ACK conformance: `python scripts/check-qwen-contract.py <result.json thật>` đều PASS; exit codes khớp bảng trong contract.
- PC 3D ACK: tạo `<workspace>/coordination/gpu-coordinator.json` bằng `scripts/worker/gpu_coordinator_policy.py write` (ghi danh tính file của lock `gpu0.lock` đã có, guard `47331c56…`), gửi **sha256 của policy** qua receipt; worker là lock owner duy nhất cho job tích hợp (không gọi guard lồng bên trong); Python worker tests + ma trận binding chạy native trên Windows đúng commit app.
- **Schema project chính đã được kiểm kê và đối chiếu** (mục 1); có bản backup riêng tư; kế hoạch migration bổ sung đã review. Không áp cả chuỗi migration lên DB đang có dữ liệu một cách mù quáng.

Chưa đủ các điều kiện trên thì giữ flag OFF; chỉ chạy CPU/local fixture.

## 1. Project chính — kiểm kê trước, đổi sau

Quy trình đầy đủ: `docs/infrastructure/canonical-schema-reconciliation.md`. Tóm tắt:

1. Đăng nhập Dashboard bằng đúng tài khoản thấy `fitmatch-ai`. Trong SQL editor chạy `scripts/schema-inventory.sql` (chỉ đọc catalog, không đọc dữ liệu người dùng) và câu truy vấn bucket/migration-history trong tài liệu trên. Lưu kết quả **riêng tư**.
2. `node scripts/compare-schema-inventory.mjs docs/infrastructure/schema-manifest.json <file đã lưu>` → trạng thái từng migration (applied/partial/absent/present-differs), object lạ (không xóa), bảng public tắt RLS, bucket public.
3. Backup riêng tư (schema + dữ liệu + danh sách object storage) **trước** mọi thay đổi; thử khôi phục trên Docker.
4. Soạn kế hoạch migration bổ sung đúng phần còn thiếu, chạy thử trên Docker từ ảnh chụp schema; Codex review; chủ dự án duyệt. Dừng nếu trùng tên/xung đột với object không thuộc FitMatch.

## 2. App (HTTPS hiện có, đúng revision đã review)

Env (giá trị thật để trong secret store của nơi deploy, không commit):

```
NEXT_PUBLIC_SUPABASE_URL=https://gohczmqykjkrgdblgbog.supabase.co   # URL công khai, không phải credential
FITMATCH_EXPECTED_SUPABASE_REF=gohczmqykjkrgdblgbog                # bắt buộc (ENV-CANON-01)
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon key của đúng project>
SUPABASE_SERVICE_ROLE_KEY=<secret/service key của đúng project, chỉ server>
QWEN_ANALYSIS_ENABLED=0        # chỉ bật cho pilot có kiểm soát sau khi đủ điều kiện mục 0
```

Server kiểm danh tính backend lúc khởi động (log chỉ in project ref hoặc lý do) và **trước mỗi client Supabase phía server**: URL phải đúng `https://<ref>.supabase.co`, ref phải nằm trong danh sách được duyệt (hiện chỉ `gohczmqykjkrgdblgbog`), key dạng JWT phải cùng ref và đúng role; `smoke-supabase` luôn bị từ chối. Sai thì mọi ghi, enrollment, heartbeat/claim trả 503 `BACKEND_IDENTITY_MISMATCH`; trang public vẫn hiển thị. Không có fallback sang project khác. Test tự động chạy với `FITMATCH_BACKEND_MODE=isolated-test`, chế độ này **chỉ** nhận URL loopback và từ chối mọi `*.supabase.co`.

Khi bật flag, mở Wardrobe → mỗi món có ảnh hiện nút "Phân tích với AI". Khi flag OFF thì nút không hiện, `POST /api/v2/analyses` trả 403 `FEATURE_DISABLED`, và heartbeat của worker không lưu capability `garment.analyze`.

## 3. Enroll worker (operator, trên máy có service key, không phải PC)

```
node --env-file=.env.local scripts/worker/manage.mjs create <OWNER_UUID> garment.analyze
```

Script kiểm cùng quy tắc danh tính backend trước khi ghi và in (ra stderr) project đang ghi vào; sai project/smoke thì thoát 5, không tạo token. `scripts/source-cleanup.mjs` và `scripts/gc-dry-run.mjs` cũng vậy.
Lệnh in token một lần. Chuyển token cho PC qua kênh riêng và đặt vào biến môi trường `FITMATCH_WORKER_TOKEN` của tiến trình worker. Không ghi token vào file config, git hay report. Mỗi tài khoản pilot có worker riêng; cả 2 worker dùng **cùng** policy điều phối GPU.

## 4. PC Qwen

- Config mẫu: `scripts/worker/config.qwen-test.example.json`. Pin `revision` đúng commit model đang chạy, `command` trỏ adapter PC (đọc `{input}` theo `analysis-adapter-input`, ghi `{output}` theo `analysis-result`).
- Chạy: `python scripts/worker/worker.py --config <config> --once` để thử từng job; bỏ `--once` khi chạy liên tục.
- `expectedBackend` `{projectRef, appOrigin}` (bắt buộc với `garment.analyze`, ENV-CANON-01): `projectRef` = `gohczmqykjkrgdblgbog`, `appOrigin` = origin HTTPS của bản app đã review. Worker từ chối khởi động nếu `appUrl` khác origin, không phải HTTPS (trừ loopback test) hoặc ref là smoke; mỗi heartbeat app trả `backend.projectRef` và worker dừng (exit 5) **trước khi claim** nếu khác.
- Config bắt buộc (worker **từ chối khởi động**, exit 5, nếu thiếu/sai) khi có engine `garment.analyze`:
  - `gpuCoordinator` `{path, sha256}`: đường dẫn **tuyệt đối** tới `<workspace>/coordination/gpu-coordinator.json` do **PC3D** tạo (bằng `scripts/worker/gpu_coordinator_policy.py write`) và sha256 của đúng file đó lấy từ receipt của PC3D (QREV-BIND-02). File này ghi **danh tính** (volume + file id) của lock `gpu0.lock` đã có sẵn và vị trí tương đối + hash của guard. Worker **suy ra** lock = `coordination/gpu0.lock`, slot = `coordination/gpu0-slot.json`, guard = `<workspace>/<đường dẫn trong policy>`; config **không được** khai `gpuLock`/`gpuSlot`/`gpuGuard` (có là từ chối). Lock mở ra phải đúng danh tính trong policy (bản sao thư mục, file thay thế, symlink/junction trỏ chỗ khác đều bị từ chối; alias trỏ về đúng file thì vẫn cùng một lock). Kiểm trước khi chạy: `python scripts/worker/gpu_coordinator_policy.py verify --config <config>` (không lấy lock, không mạng, không CUDA).
  - `gpuSlotOwner: pc-ai`: trước mỗi lần claim, khi đang giữ lock, worker kiểm lại hash policy + guard, danh tính handle lock đang giữ, rồi đọc slot theo đúng quy tắc của guard (owner khớp, chưa hết hạn, cửa sổ ≤3600 s, lệch giờ ≤5 s, không key trùng/NaN, không phải link). Không có file slot nghĩa là chỉ PC3D được chạy, pc-ai bị từ chối. Bị từ chối thì worker nhả lock và không claim. Nếu lock bị thay sau khi khởi động, worker dừng (exit 5) trước claim.
- Worker giữ GPU lock trong suốt claim → adapter → drain toàn cây process. Exit code 4 nghĩa là quarantine: có process owned chưa thoát. Không tự xóa lock hay kill process ngoài cây owned. Kiểm Task Manager rồi để worker tự kiểm lại.
- Mỗi job ghi log/timestamps lock (acquire/release) và GPU baseline/peak/after (`evidence.gpuMiB`) để Codex đối chiếu không chồng lấn với 3D.

## 5. Kịch bản nghiệm thu tối thiểu (QINT-R)

1. Tài khoản A: thêm áo thun có ảnh licensed → "Phân tích với AI" → UI hiện lần lượt queued → (waiting GPU nếu 3D đang chạy) → running → review. Duyệt hoặc sửa → "Lưu vào tủ đồ" → kiểm `fm_wardrobe_items` chỉ đổi các trường đã duyệt.
2. Tài khoản B: không thấy analysis/ảnh/kết quả của A. Gọi `POST /api/v2/analyses/<id của A>/confirm` → 404.
3. GPU contention cả hai thứ tự (Qwen→3D, 3D→Qwen): log lock + PID tree cho thấy không có khoảng chồng lấn; job còn queued trong lúc 3D giữ lock/slot thì hiện "PC đang bận GPU với việc khác" (heartbeat `gpuBusy`), không claim, attempt vẫn 0.
4. Đổi ảnh món đồ hoặc xóa món đồ trong lúc job đang chạy → kết quả về muộn bị từ chối (`SOURCE_CHANGED`), wardrobe không đổi; xóa món đồ thì snapshot có cleanup intent (`fm_v2_source_cleanup`).
5. PC offline: job nằm ở queued, app vẫn dùng bình thường (rules-v1 và sửa tay).
6. Quota/cleanup: tài khoản đã có 20 job đang chờ/chạy (gồm cả 3D) bấm phân tích → 429 `QUOTA_EXCEEDED`, không có object mới trong `…/analysis/`. Sau khi chạy collector (`scripts/source-cleanup.mjs`), `fm_v2_source_cleanup` không còn intent `pending` quá hạn của snapshot analysis.

## 6. Dừng / rollback

- Dừng: đặt `QWEN_ANALYSIS_ENABLED=0` và redeploy; `manage.mjs ungrant <OWNER> <WORKER> garment.analyze`; hoặc `revoke` worker. Lease đang chạy sẽ hết hạn và không ghi được gì nữa.
- Rollback khẩn cấp trên project chính: **chỉ** `QWEN_ANALYSIS_ENABLED=0` và ungrant/revoke worker pilot. Không drop schema, không tạo lại project; dữ liệu đã có được giữ. Gỡ bảng/cột chỉ theo kế hoạch đã review và sau backup.
- Snapshot ảnh: xóa analysis hoặc món đồ sẽ tạo cleanup intent; dọn bằng `node scripts/source-cleanup.mjs` (mặc định dry-run không tác dụng phụ; `--execute` trước hết **claim** các intent trong DB — khóa theo owner như enqueue, tombstone reservation bỏ dở để enqueue không thể publish nữa, không bao giờ chọn asset ready/đang được analysis dùng — rồi mới xóa đúng các path đã claim và báo kết quả bằng token; mất báo cáo thì claim hết hạn sau 5 phút và lượt sau làm lại). Trên project chính chỉ chạy dry-run cho tới khi được duyệt riêng; không bật chạy định kỳ. Bản copy trong thư mục job trên PC không được xóa từ app; PC cần có receipt riêng.

## 7. Giới hạn đã biết

- Test trong repo dùng **CPU mock adapter**: chứng minh plumbing (queue, lease, fencing, review), không chứng minh chất lượng Qwen, thời gian GPU hay hành vi native Windows.
- Ánh xạ sang wardrobe: tshirt→`t-shirt`, jeans→`jeans`; pattern solid/striped/printed/checked/other → plain/striped/graphic/plaid/other; màu dùng từ vựng contract. Logo text người dùng xác nhận chỉ lưu trên analysis (wardrobe chưa có cột cho nó).
- HTTP test đã kiểm tài khoản thứ hai qua auth mock (không thấy và không thao tác được analysis của người khác), nhưng wardrobe vẫn là fixture; isolation với 2 tài khoản Supabase thật là kịch bản 5.2 của pilot.
