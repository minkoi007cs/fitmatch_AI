# Full look áo thun + jeans — báo cáo code (CL-FULLLOOK-20261105-01)

Session Claude, cloud worktree. Receipt: [full-look-receipt.md](./full-look-receipt.md). Gửi Codex review. **Chưa push source app, chưa merge, deploy, migrate production hay enroll live worker.**

## 1. Baseline, commits, bàn giao

| Mục | Giá trị |
|---|---|
| Docs đã đọc | `47f521f` (`codex/project-operations`) |
| App baseline | `a3d051a` (R1 `afc37ff` + mapping exit code theo adapter PC) |
| Nhánh | `codex/full-look-c1`, final **`b4e7527`** |
| Diff | 63 file, +4693 / −874 so với `a3d051a` |
| Bàn giao | Mac `fitmatch_AI/claude-handoff-local/full-look-c1/` (LOCAL ONLY): `full-look.bundle` (sha256 `c33ce4eb…7d2651`), `full-look.diff` (`bcd8f6c1…0a61`), logs, ảnh. Đã kiểm `shasum -c` trên Mac: OK. Bundle cần bundle R1 làm tiền đề; lệnh áp dụng ghi trong README |

| Commit | Gói | Nội dung |
|---|---|---|
| `3c51d63` | C0 | Windows kill-on-close **fail-closed**: nếu không gắn được Job Object thì worker thoát mã 3 và không claim. Bỏ qua chỉ khi đặt `processContainment: "unsafe-disabled"` (có cảnh báo mỗi lần chạy). Khai báo Win32 argtypes, xác nhận lại bằng `IsProcessInJob` |
| `27c66a0` | C1 backend | Slot top/bottom, jeans thành bottom thật với kind `bottom.*`, `fm_v2_save_look`, schema v1-r2, fixture 3 GLB |
| `c471e74` | C1 UI | Studio hai slot, áp dụng an toàn theo lựa chọn hiện tại, lưu/mở lại cả bộ cùng góc máy, nút tự xoay |
| `0da8162` | C2 | Capture video/ảnh mặt/số đo, bản nháp avatar, giữ/xóa nguồn bằng tombstone |
| `b4e7527` | C3 | Gợi ý 3 bộ áo + jeans có trong tủ, ảnh lookbook render, khóa GPU theo host, sửa alpha, GC dry-run |

R1 được giữ nguyên, không viết lại. Mapping exit code vẫn như `a3d051a`: 78 hoặc 2 kèm JSON có cấu trúc, còn lại là `INFERENCE_FAILED`.

## 2. Kiểm chứng trên `b4e7527`

Toàn bộ là fixture/tổng hợp: Docker PostgreSQL 16 (mạng none), fake Supabase/Storage, Next build thật, Chromium và Python worker thật. **Không có Supabase thật, PC/Windows, GPU, ảnh người hay quần áo thật.**

| Lệnh | Exit | Ghi chú |
|---|---|---|
| `npm run lint` | 0 | |
| `npx tsc --noEmit` | 0 | |
| `npm run build` | 0 | |
| `npm test` | 0 | 44/44: outfit, contract/schema drift, recommender full-look, alpha, worker unittest (containment, GPU lock, input names) |
| `npm run test:v2:db` | 0 | 5 khối PASS: S1, R1, C1 (chạy migration trên DB đã có dữ liệu cũ), C2 (tombstone/cancel/retry), C3 (GC dry-run) |
| `npm run test:v2` | 0 | 13 PASS, gồm R1 S1–S13 (S13 mới: khóa GPU), luồng C1 full look và luồng C2 capture/retention qua route, DB và trình duyệt thật |
| `node --import tsx scripts/export-contract.mjs --check` | 0 | 20 file schema/fixture khớp code |

Test mới đều assert, exit 1 khi sai. Luồng browser C1 kiểm:
- upload jeans → `bottom.reconstruct` / `bottom.drape`, envelope khớp `schemas/v1-r2`;
- chỉ đúng 1 job fitting cho jeans B, không tạo job theo tổ hợp áo × quần;
- A→B→A với kết quả B về muộn thì không áp B;
- món đang chờ chỉ tự áp khi vẫn đang được chọn;
- tự xoay;
- lưu và mở lại cả bộ cùng góc máy: không job mới, claim trả 204;
- lookbook: nền trắng, có quần áo trong khung;
- không cuộn ngang ở 390 px.

Ảnh: `c1-full-look-front/side/reopened.png`, `c2-capture-video-face.png`, `c2-retention-confirm.png`, `c3-lookbook-back-white.png`. Tất cả là hình hộp tổng hợp.

## 3. Protocol v1-r2 (đề xuất, chờ PC xác nhận)

Chi tiết trong `docs/worker-api-contract-v1.md` (mục v1-r2) và `schemas/v1-r2/*.json`. Tóm tắt:
- Kind mới `bottom.reconstruct` / `bottom.drape`, mặc định từ chối, cấp quyền riêng.
- Envelope thêm `slot`, `category`, `mediaType`, role `face` / `video`, `sharedFrame` (mét, +Y lên, +Z trước, gốc trên sàn giữa hai chân, pose `a-pose-v1`). Content dùng `top|bottom-canonical` và `*-only-aligned-to-avatar`.
- Avatar: 3 ảnh, hoặc video + ảnh mặt. Video tối đa 150 MB.
- Fixture `fixtures/full-look/` cho PC đối chiếu hệ trục.
- `avatar-edit-intent.json` chỉ là schema cho engine sau này.

Tương thích ngược:
- Worker v1-r1 vẫn chạy được job top.
- Server v1-r2 gửi thêm field; adapter cũ bỏ qua.
- Tombstone không đổi hành vi của job cũ.

## 4. Migration (additive)

| File | Nội dung |
|---|---|
| `20261106035951_full_look_c1.sql` | `slot` + backfill garment/fitting cũ thành `top` + constraint; mở rộng check capability; thay `fm_v2_enqueue` (giữ chữ ký); look thêm top/bottom/camera/snapshot; `fm_v2_save_look` |
| `20261106042143_capture_retention_c2.sql` | Asset `video` (150 MB, ảnh vẫn 40 MB), state `deleted` + `deleted_at`, bucket limit/mime, `accepted_at`, `source_retention`; enqueue dùng role; retry chặn khi nguồn đã xóa; `fm_v2_source_retention` |
| `20261106044040_gc_dry_run_c3.sql` | `fm_v2_gc_candidates` chỉ đọc |

Rollout:
1. Chạy trên project test theo thứ tự.
2. `notify pgrst` có sẵn trong migration.
3. App mới.
4. PC cập nhật `worker.py` v1-r2, cấp quyền `bottom.*` khi adapter sẵn sàng.

Rollback:
- Deploy lại app cũ: bảng/cột mới bị bỏ qua.
- Chỉ revert hàm cụ thể bằng bản cũ trong migration trước.
- Không drop cột đã có dữ liệu.
- Bucket limit có thể đặt lại 40 MB nếu chưa có video.

## 5. U01–U27 → code / test / gap

| ID | Trạng thái | Code / test | Còn thiếu |
|---|---|---|---|
| U01 trọn luồng | Partial | Upload → job → model → áo + quần → lưu/mở lại, test C1 | Chỉ fixture; chưa có engine thật |
| U02 video/mặt/số đo | Partial | Capture + API + schema, test C2 | Engine dùng thực tế chưa có; khung hình nào được dùng do adapter báo |
| U03 15–30 phút | Not run | — | Cần benchmark trên PC |
| U04 tự động + chỉnh | Partial | Bản nháp → dùng tạm / tạo lại | Chỉnh tham số chưa có engine |
| U05/U06 editor slider + lời | Blocked (engine) | `avatar-edit-intent` schema; UI ghi rõ **chưa khả dụng**, không làm slider giả | Kind/engine chỉnh, preview/version |
| U07 màu/logo/form | Partial | Ảnh lưu JPEG q95, alpha nền trắng (unit test), lookbook không qua generator | Chất lượng texture là việc của PC |
| U08 ảnh áo trước/sau | Done (app) | Capture 2 ảnh + chi tiết | — |
| U09 áo + quần của người dùng | Done (app), chưa real | Slot bottom = jeans thật | Jeans thật từ PC |
| U10 thun + jeans trước | Done | Danh mục chặn quần tây/short (test DB) | Mở sau |
| U11 wardrobe trung tâm, fitting tái dùng | Done (app) | Cache theo món; mở lại không chạy AI (test) | — |
| U12 tự áp chỉ khi còn chọn | Done | `outfit.ts` + test unit + browser | — |
| U13 slot độc lập, lưu cả bộ | Done | Hai slot, `fm_v2_save_look` | — |
| U14 preset ghi nhãn | Partial | Bundle `preset: true` hiện “Mẫu (không thuộc tủ đồ)”; slot trống hiện “Trang phục gốc của avatar” | Chưa có GLB preset thật từ PC |
| U15 camera | Done | Mặc định nhìn trước, orbit/zoom, tự xoay, lưu góc máy | — |
| U16/U17/U18 AI 3 bộ | Done (rules-v1) | Ghép áo + jeans có trong tủ, theo dịp mỗi lần, không bịa món, có giải thích; nút mặc cả bộ | Qwen là tùy chọn của PC |
| U19 ưu tiên thun + jeans | Done | — | — |
| U20 truy cập từ xa | Not run | Route outbound có sẵn | HTTPS/Supabase thật, enroll |
| U21 điện thoại/desktop | Partial | Capture responsive, kiểm 390 px | Chưa kiểm trên điện thoại thật |
| U22 tài khoản riêng | Done (test) | Kiểm owner ở mọi RPC | Two-owner thật |
| U23 giữ/xóa nguồn | Done (app) | Tombstone, hủy job phụ thuộc, chặn retry/enqueue lại, xóa object (test) | Default khi job lỗi, xóa tài khoản, dọn job folder trên PC |
| U24 bản nháp | Done (app) | Dùng tạm / bổ sung ảnh | Duyệt độ giống là việc của chủ dự án |
| U25 chi phí | N/A | Không có paid provider | — |
| U26 lookbook | Done (app) | Render đúng scene, góc/nền, PNG (test) | Cảnh generative để sau |
| U27 UI | Partial | Viewer nền trung tính, slot rõ, nhãn trạng thái | Chưa có mockup để chủ dự án duyệt |

## 6. Capability thật vs stub

**Có thật (chạy được, có test):** schema/queue/slot, cache, lưu/mở lại, an toàn khi kết quả về muộn, tombstone, khóa GPU (Linux flock), render lookbook từ WebGL.

**Stub / fixture:**
- Mọi hình học là hộp tổng hợp.
- Không có inference.
- Video chỉ kiểm container.
- Editor chưa khả dụng.
- Khóa GPU trên Windows (msvcrt) và Job Object chưa chạy trên PC.

## 7. Blocker / giới hạn còn mở

1. PC phải xác nhận v1-r2 (kind `bottom.*`, `sharedFrame`, role, `mediaType`) và TIMEOUT so với INFERENCE_FAILED trước khi tích hợp thật.
2. Fail-closed và khóa GPU trên Windows chưa chạy thật. Chat Qwen trên PC cần dùng cùng file khóa (`%PROGRAMDATA%\fitmatch\gpu-0.lock`, khóa byte 0) nếu muốn chia GPU an toàn.
3. Cache chưa tự regenerate khi engine revision đổi: fitting cũ vẫn được dùng lại. Cần quyết định khóa cache có gồm revision hay không.
4. Video: không kiểm thời lượng/codec trên server; adapter phải từ chối footage không dùng được.
5. GC chỉ dry-run; staging copy và object của tombstone còn lại cho tới khi có collector được duyệt.
6. Chưa có Supabase thật, HTTPS, enroll, chạy two-owner trên PC; target 15–30 phút chưa đo.
7. Chạy lại job sau khi restart khi envelope chưa tới vẫn tốn 1 attempt (giữ từ R1).

## 8. Process delta để Codex nhập

```text
### L-<id> — 05/11/2026 ~23:00 America/New_York — START — CL-FULLLOOK-20261105-01 / APP-FLOW-01, APP-AI-01, APP-RENDER-01 (C0–C3)
Receipt docs/reports/claude/full-look-receipt.md (docs branch 757e108). Docs 47f521f; app codex/full-look-c1 từ a3d051a (R1). Cloud worktree; canonical Studio/main không chạm.

### L-<id> — 06/11/2026 ~00:00 America/New_York — END / HANDOFF — CL-FULLLOOK-20261105-01
Final b4e7527 (5 commit C0/C1/C1/C2/C3). lint/tsc/build/npm test (44)/test:v2:db (5 khối)/test:v2 (13 PASS, gồm S13 GPU lock, C1 full look, C2 capture/retention) exit 0, toàn fixture. Bundle/diff/logs/ảnh local ở fitmatch_AI/claude-handoff-local/full-look-c1/, sha256 đã verify trên Mac. Protocol v1-r2 là đề xuất, chờ PC xác nhận. Không push app/merge/deploy/migrate/enroll.
APP-FLOW-01, APP-AI-01, APP-RENDER-01: Assigned → Ready for review (code/fixture). Editor (DISC-EDIT-01 phần UI) chỉ có schema + nhãn chưa khả dụng. Tiếp theo: Codex review + retest; PC xác nhận v1-r2, chạy unittest/fail-closed/GPU lock trên Windows, xuất body/top/jeans thật theo sharedFrame.
```
