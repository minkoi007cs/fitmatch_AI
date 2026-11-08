# Handoff — CL-POSTAUDIT-20261106-01 (H-AUDIT-016)

Claude, phiên cloud Linux. Docs đã đọc `d3f29a5` (PROC-0016). App baseline `7be869c`, nhánh `codex/claude-post-audit`. Receipt ghi trước sửa: `docs/reports/claude/post-audit-receipt.md` trên nhánh docs `docs/claude-CL-POSTAUDIT-20261106-01`. Dữ liệu test đều là synthetic; không có Supabase thật, PC, GPU hay ảnh cá nhân.

Trạng thái: **Ready for review** cho CL-PRIV-01, CL-URL-01 (+ kiểm snapshot avatar LOOK-01) và CL-WINTEST-01 (bản test-only). Mục nào cũng chưa được nghiệm thu sản phẩm. MAC-14C, CL-PILOT-01 và bản sửa npm audit **chưa làm** (xem Gaps).

## Commits (đều tính từ 7be869c, không rebase, giữ nguyên mọi thay đổi của Codex)

| SHA | Nội dung |
|---|---|
| `521972e` | CL-PRIV-01 xóa nguồn bền vững, có retry |
| `2bfa6ad` | CL-URL-01 ký lại URL đúng phiên bản + LOOK-01 kiểm snapshot avatar |
| `0c8f936` | CL-WINTEST-01 sửa test Python để kill đúng process giữ khóa (chỉ test) |
| final | commit report/log này trên cùng nhánh (SHA ghi trong lịch sử git) |

Đã review delta Codex 92c79b6..7be869c: không thấy lỗi chặn nên giữ nguyên. Ghi chú: dùng idempotency key ngẫu nhiên cho prepare vẫn an toàn vì `fm_v2_enqueue` khử trùng lặp theo cặp avatar/món đồ hiện hành. Hàm `fm_v2_job_action_legacy` đổi tên nhưng giữ ACL cũ. Gọi regenerate trên job đã bị supersede sẽ trả true theo chủ đích (replay).

## CL-PRIV-01

**Tái hiện lỗi trước khi sửa.** Trong `test:v2:db`, sau khi delete trên schema C2, gọi delete lần nữa vẫn trả `paths=[]` dù không có gì ghi nhận object đã bị xóa. Block CL-PRIV-01 assert đúng điều này trước khi áp migration. Ở HTTP, `storage.remove` lỗi sẽ khiến UI chuyển sang "Đã xóa." và không còn đường retry.

**Thay đổi:**
- Migration additive `20261106150000_source_cleanup_priv01.sql`:
  - Bảng `fm_v2_source_cleanup` lưu một intent cho mỗi object (verified + staging). Mỗi intent có state pending/completed/failed, attempts, backoff `next_attempt_at` và lỗi dạng mã (`STORAGE_503`, không lưu message vì message có thể chứa path).
  - Backfill các tombstone có từ trước thành pending.
  - Cột tóm tắt `fm_v2_models.source_cleanup`, tính cho cả các model dùng chung source.
  - Thay `fm_v2_source_retention` (giữ nguyên signature) bằng bản idempotent: lần gọi nào cũng trả về các path chưa xong và danh sách `affectedModels`.
  - `fm_v2_source_cleanup_report` không bao giờ mở lại một intent đã completed.
  - `fm_v2_source_cleanup_due` có giới hạn: tối đa 5 lần tự động, mỗi lần gọi tối đa 500 dòng.
  - RLS bật; mọi role browser bị revoke, chỉ service_role được dùng.
- Route `POST /api/v2/models/:id/source`: request nào cũng thử xóa các object còn tồn đọng, rồi ghi kết quả. Response có `cleanup`, `storageCleanupPending`, `removedObjects`, `affectedModels`.
- UI `AvatarDraft`:
  - Hiển thị trạng thái "Đang xóa" hoặc "Chưa xóa xong" kèm nút "Thử xóa lại".
  - Chỉ báo "Đã xóa khỏi bộ nhớ lưu trữ" khi storage đã xác nhận; trạng thái này vẫn đúng sau khi reload.
  - Báo cho người dùng khi một avatar khác đã xóa ảnh dùng chung với avatar này.
- `scripts/source-cleanup.mjs`: collector cho operator. Chỉ xử lý intent do user đã yêu cầu, mặc định dry-run, cần `--execute` mới xóa thật. **Chưa chạy trên project nào.**

**Ma trận owner/retention:**

| Tình huống | Kết quả có test |
|---|---|
| storage.remove lỗi → reload → retry | DB: pending:1, đúng backoff; HTTP+browser: object còn, UI "Đang xóa" sau reload, bấm thử lại → completed, object mất |
| Gọi delete lặp lại | Các path chưa xong vẫn được trả về; khi không còn gì thì không gọi storage |
| Late failure sau success | completed giữ nguyên |
| 5 lần tự động thất bại | failed; collector dừng; retry thủ công của user vẫn chạy |
| Owner khác | `MODEL_NOT_FOUND`; report của owner khác không cập nhật dòng nào; anon/authenticated bị chặn ở bảng và cả 3 RPC |
| Source dùng chung | Job của model khác bị hủy với `SOURCE_DELETED`; `affectedModels` được trả về; trạng thái hiển thị ở cả hai avatar |
| Stale completion / retry / enqueue | Vẫn bị chặn (C2 + CL-PRIV-01): retry 409, re-enqueue `INVALID_ASSET` |
| Derived avatar/fitting/look | Danh sách GLB không đổi; avatar GLB vẫn mở được |
| 6 lệnh delete chạy song song | Mỗi object chỉ được ghi một lần |

**Policy hiện hành, ghi nhận và không thay đổi:**
- Nếu user chưa chọn giữ/xóa hoặc job lỗi, source được **giữ** và không có lịch xóa tự động.
- Việc xóa vật lý trên cloud chỉ xảy ra khi user yêu cầu.
- Bản copy source ở thư mục job trên PC **không** nằm trong phạm vi này. Chưa thể tuyên bố đã xóa toàn bộ khi chưa có receipt từ PC.

## CL-URL-01 / LOOK-01

- `modelBytes` phân loại lỗi thành expired / missing / network / integrity / changed / unavailable.
  - Chỉ trường hợp expired (HTTP 400/401/403, tức cách Supabase trả lời một URL ký hết hạn) mới được refresh, và chỉ **1 lần**, qua route đã xác thực `GET models/:id`.
  - Chỉ tải lại nếu model id, output asset id, sha256 và bytes đều giữ nguyên.
  - 404, lỗi mạng, 5xx và hash/size sai đều không retry.
  - Stream bị cắt ở đúng số bytes đã ghi nhận. AbortSignal được kiểm tra giữa bước refresh và lần tải thứ hai.
  - Không tạo job nào và không chạy inference lại.
- Studio:
  - Thêm AbortController riêng cho mỗi scene và mỗi lần mở, nên khi chuyển A→B→A các lượt tải cũ bị hủy thật, chứ không chỉ bị bỏ qua.
  - Look đã lưu được kiểm `snapshot.avatar` (modelId + sha256) **trước khi tải**, đồng thời ghim đúng fitting id đã lưu.
- Test:
  - 7 unit test: expired→success, hết hạn hai lần, 404/network/500/corrupt/thừa bytes, identity bị đổi, refresh bị từ chối (trường hợp revoked/foreign), sha bị ghim, abort.
  - Browser: mở lại look khi cả 3 URL (avatar, áo thun, jeans) đều hết hạn một lần → đúng 6 lượt đọc, không có job mới. Look có snapshot avatar bị sửa → bị từ chối và không tải gì.

## CL-WINTEST-01

Đây là sửa test, không đổi code production. Process con chỉ dùng stdlib nên được chạy bằng `sys._base_executable`, tránh launcher của venv trên Windows. Process con in ra PID của chính nó; test assert PID đó bằng `Popen.pid` trước khi kill, và đóng stdin trước khi dọn dẹp. Chiến lược containment/kill của production không đổi. Linux 18/18 PASS. **Windows NOT RUN**: cần PC chạy lại bộ 18 test gốc trên app commit này. Mình chưa nhận được patch `app7be-native-lock-test-proposal.patch` của PC nên chưa so sánh; nhờ PC đối chiếu.

## Lệnh, exit status và log (trên 0c8f936, log nằm trong thư mục này)

| Lệnh | Kết quả |
|---|---|
| `npm test` | exit 0, 58/58 (48 cũ + 3 collector + 7 modelBytes) — unit.log |
| `npm run lint` | exit 0 — lint.log |
| `npm run build` | exit 0, chạy trước test browser — build.log |
| `npm run test:v2:db` | exit 0, 7 block gồm CL-PRIV-01 — db.log |
| `npm run test:v2` | exit 0, toàn bộ HTTP/browser — v2.log |
| `node --import tsx scripts/export-contract.mjs --check` | exit 0, 20 file. Lần đầu mình gọi thiếu `--import tsx` nên lỗi ERR_MODULE_NOT_FOUND; đó là lỗi cách gọi lệnh, không phải contract bị lệch — contract.log |
| `python3 -m unittest test_worker_unit` (Linux, Python 3.13) | exit 0, 18/18 — python.log |

Lần fail trung gian: `v2-intermediate-fail.log`. Fault đếm số lần đọc trong fixture đã làm hết hạn luôn cả URL vừa được ký lại (nên look hiện trang phục gốc). Đây là lỗi thiết kế fixture: mình sửa fixture thành "hết hạn lần đọc đầu tiên của mỗi object" rồi chạy lại PASS. Code sản phẩm không đổi giữa hai lần chạy.

## Gaps / chưa chạy / chưa làm

- Chưa có Supabase thật, HTTPS, storage thật, cũng chưa chạy collector trên project nào. Migration chỉ chạy trên PostgreSQL16 trong Docker; **không** áp production.
- Windows native NOT RUN. Mọi gate PC (adapter, GLB cá nhân, editor, likeness) không đổi. G1–G3 vẫn NOT VERIFIED.
- Chưa xử lý xóa tài khoản và lifecycle thư mục job trên PC.
- Chưa làm MAC-14C (đề xuất pin engine revision/cache policy). Hướng đề xuất: thêm `engine_revision` vào output model; output ready và look đã lưu không bao giờ tự bị invalidate; regenerate theo engine mới là thao tác user chủ động cho từng món. Cần PC ACK trước khi đổi wire.
- Chưa làm CL-PILOT-01 (runbook test-env/thứ tự migration/rollback). Thứ tự migration hiện tại: 20261105 → 025506 → 035951 → 042143 → 044040 → 053812 → **150000**. Rollback của 150000: cột/bảng mới đều additive, nhưng `fm_v2_source_retention` cũ sẽ lại làm mất path; muốn rollback phải khôi phục hàm từ C2 và chấp nhận mất lớp bảo vệ.
- npm audit: 8 moderate, 0 high/critical, đều trong cây tooling ESLint/typescript-eslint/minimatch (devDependencies). Không áp `audit fix --force`, vì gợi ý của nó kéo theo hạ phiên bản lint-config của Next. Cần review riêng khi upstream có bản tương thích.

## Yêu cầu gửi PC

1. Chạy bộ 18 test Python gốc trên Windows ở `codex/claude-post-audit` (0c8f936 hoặc mới hơn), gửi raw log, và đối chiếu với patch proposal của PC.
2. Xác nhận lifecycle source trong thư mục job local, để biết xóa từ app có cần lan sang PC hay không.
3. ACK hướng MAC-14C trước khi đổi bất kỳ field nào trên wire.

Codex review → PASS / NEEDS CHANGES. Không merge/deploy/migrate production.
