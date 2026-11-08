# Runbook — chạy thử Qwen garment analysis trên test env (QINT-C)

Chỉ dành cho **môi trường test dùng một lần**: một Supabase project riêng và một bản deploy riêng có HTTPS. Không dùng project production, không migrate production, không mở cổng/router/tunnel vào PC. PC chỉ gọi ra ngoài (outbound HTTPS). Mọi credential nằm ở file env riêng (không commit, không dán vào log hay report).

## 0. Điều kiện trước khi bật

- Codex review contract `docs/qwen-contract-v1.md`, migrations `20261107120000_qwen_analysis_qint.sql` + `20261108090000_qwen_review_qrev.sql`, drain fix (PC-QUIESCENCE-01) và bản sửa QREV (lock/quota/snapshot/status) → kết quả PASS.
- PC Qwen ACK conformance: `python scripts/check-qwen-contract.py <result.json thật>` đều PASS; exit codes khớp bảng trong contract.
- PC 3D ACK: hash guard (hiện `47331c56…`), đường dẫn tuyệt đối của lock dùng chung `…/Fitmatch-GPU/coordination/gpu0.lock` (msvcrt byte 0) và slot `gpu0-slot.json` cùng thư mục; worker là lock owner duy nhất cho job tích hợp (không gọi guard lồng bên trong); Python worker tests chạy native trên Windows đúng commit app.

Chưa đủ 3 điều kiện trên thì giữ flag OFF; chỉ chạy CPU/local fixture.

## 1. Supabase test project

1. Tạo project mới và một bucket **private** `fitmatch-v2`. Bucket `fitmatch-wardrobe` đã có trong schema app gốc.
2. Áp migrations theo thứ tự (SQL editor hoặc `supabase db push` **trỏ vào test project**):
   `20261103_app_system_identity` → `20261104_ai_daily_quota` → `20261105_studio_control_plane` → `20261106025506_worker_recovery_r1` → `20261106035951_full_look_c1` → `20261106042143_capture_retention_c2` → `20261106044040_gc_dry_run_c3` → `20261106053812_fitting_generations` → `20261106150000_source_cleanup_priv01` → `20261107120000_qwen_analysis_qint` → `20261108090000_qwen_review_qrev`.
3. Kiểm: `select 1 from fm_v2_analyses limit 1;` không lỗi, và `anon`/`authenticated` không đọc được `fm_v2_analyses` hay `fm_v2_source_cleanup`.

## 2. App test deploy

Env (giá trị thật để trong secret store của nơi deploy, không commit):

```
NEXT_PUBLIC_SUPABASE_URL=<test project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<test anon key>
SUPABASE_SERVICE_ROLE_KEY=<test service role, server only>
QWEN_ANALYSIS_ENABLED=1        # chỉ ở test deploy; production giữ unset/0
```

Khi bật flag, mở Wardrobe → mỗi món có ảnh hiện nút "Phân tích với AI". Khi flag OFF thì nút không hiện, `POST /api/v2/analyses` trả 403 `FEATURE_DISABLED`, và heartbeat của worker không lưu capability `garment.analyze`.

## 3. Enroll worker (operator, trên máy có service role, không phải PC)

```
node --env-file=.env.test scripts/worker/manage.mjs create <OWNER_UUID> garment.analyze
```

Lệnh in token một lần. Chuyển token cho PC qua kênh riêng và đặt vào biến môi trường `FITMATCH_WORKER_TOKEN` của tiến trình worker. Không ghi token vào file config, git hay report. Mỗi tài khoản test có worker riêng. Để thử isolation, tạo 2 tài khoản và 2 worker; cả 2 worker dùng **cùng** GPU lock.

## 4. PC Qwen

- Config mẫu: `scripts/worker/config.qwen-test.example.json`. Pin `revision` đúng commit model đang chạy, `command` trỏ adapter PC (đọc `{input}` theo `analysis-adapter-input`, ghi `{output}` theo `analysis-result`).
- Chạy: `python scripts/worker/worker.py --config <config> --once` để thử từng job; bỏ `--once` khi chạy liên tục.
- Config bắt buộc (worker **từ chối khởi động**, exit 5, nếu thiếu/sai) khi có engine `garment.analyze`:
  - `gpuLock`: đường dẫn **tuyệt đối** tới lock **đã có sẵn** của PC3D (`…/coordination/gpu0.lock`). Không chấp nhận `default`, đường dẫn tương đối, hay file chưa tồn tại (worker không tự tạo lock, nên gõ sai không thể sinh ra lock thứ hai).
  - `gpuGuard.path` + `gpuGuard.sha256`: guard dùng chung đúng revision PC đã ACK; mỗi lần trước khi claim, worker kiểm lại hash.
  - `gpuSlot` (mặc định `gpu0-slot.json` cạnh lock) và `gpuSlotOwner: pc-ai`: trước mỗi lần claim, khi đang giữ lock, worker đọc slot theo đúng quy tắc của guard (owner khớp, chưa hết hạn, cửa sổ ≤3600 s, lệch giờ ≤5 s, không key trùng/NaN). Không có file slot nghĩa là chỉ PC3D được chạy, pc-ai bị từ chối. Bị từ chối thì worker nhả lock và không claim.
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
- Rollback dữ liệu test: bảng/cột đều additive. Nếu cần gỡ, hủy job analysis đang chạy trước, rồi `drop table fm_v2_analyses cascade` và bỏ cột `analysis_id/not_before/deferrals` trên test project. Production không có gì để rollback vì chưa áp ở đó.
- Snapshot ảnh: xóa analysis hoặc món đồ sẽ tạo cleanup intent; dọn bằng `node scripts/source-cleanup.mjs` (mặc định dry-run, thêm `--execute` để xóa) **trên test project**. Bản copy trong thư mục job trên PC không được xóa từ app; PC cần có receipt riêng.

## 7. Giới hạn đã biết

- Test trong repo dùng **CPU mock adapter**: chứng minh plumbing (queue, lease, fencing, review), không chứng minh chất lượng Qwen, thời gian GPU hay hành vi native Windows.
- Ánh xạ sang wardrobe: tshirt→`t-shirt`, jeans→`jeans`; pattern solid/striped/printed/checked/other → plain/striped/graphic/plaid/other; màu dùng từ vựng contract. Logo text người dùng xác nhận chỉ lưu trên analysis (wardrobe chưa có cột cho nó).
- HTTP test đã kiểm tài khoản thứ hai qua auth mock (không thấy và không thao tác được analysis của người khác), nhưng wardrobe vẫn là fixture; isolation với 2 tài khoản Supabase thật là kịch bản 5.2 trên test env.
