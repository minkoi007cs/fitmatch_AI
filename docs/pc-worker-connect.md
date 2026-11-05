# Nối PC với Fitmatch S1

Cập nhật: 05/11/2026, America/New_York. Mã ở nhánh `codex/3d-studio-worker` trong worktree `fitmatch_AI-3d-studio`. Chưa triển khai lên website đang chạy.

## Điều kiện trên web

1. Review và áp dụng migration `supabase/migrations/20261105_studio_control_plane.sql` vào môi trường thử nghiệm trước. Migration thêm bảng/RPC/bucket riêng; không xóa wardrobe, quiz hoặc outfit cũ. Test cục bộ dùng PostgreSQL 16 trong Docker, chưa chứng minh migration trên project Supabase thật.
2. Cấu hình Supabase URL, anon key và `SUPABASE_SERVICE_ROLE_KEY` trên server. Giữ cấu hình đăng nhập hiện có. Không đưa service-role key sang PC hoặc vào biến `NEXT_PUBLIC_*`.
3. Chạy web bằng URL HTTPS mà PC truy cập được. PC chỉ gọi outbound HTTPS, không cần mở port GPU ra Internet. Không dùng `localhost` của Mac làm địa chỉ cho PC.
4. Dùng UUID tài khoản Supabase sau khi đăng nhập (không phải email hay hub subject). Trên máy quản trị đáng tin cậy, chạy:

```sh
node --env-file=.env.local scripts/worker/manage.mjs create OWNER_UUID
```

Lệnh in token worker một lần trong terminal của bạn. Chuyển riêng sang biến môi trường PC; không gửi token vào chat, GitHub hoặc ảnh chụp màn hình. DB chỉ lưu SHA-256 của token. Token chỉ nhận job của đúng chủ tài khoản.

## Trên Windows

Copy/pull cùng phiên bản `scripts/worker/worker.py` và `config.example.json`. Worker chỉ cần Python 3.10 trở lên; thư viện CUDA/SiTH nằm trong môi trường adapter riêng.

Tạo `config.local.json` từ example, sửa `appUrl` và `workDir`. Ban đầu để `engines: {}`. Dùng trình quản lý biến môi trường hoặc nhập token riêng tại terminal PC vào `FITMATCH_WORKER_TOKEN`. Sau đó:

```powershell
python scripts/worker/worker.py --config scripts/worker/config.local.json
```

Mở `/prepare` trên web. Worker rỗng chỉ xác nhận kết nối, không quảng cáo dựng người/dựng áo/mặc thử. Job không bị đánh dấu hoàn tất khi chưa có năng lực tương ứng.

## Gắn inference thật

Mỗi capability phải có adapter đã kiểm tra riêng, không bật cả ba vì SiTH chạy được:

| Capability | Cần xuất gì |
|---|---|
| `avatar.reconstruct` | Body/avatar GLB từ ảnh trước/bên/sau + chiều cao. SiTH cần adapter xuất GLB, chuẩn hóa tọa độ và kiểm chứng chất lượng; không có adapter SiTH hoàn chỉnh trong worker transport này. |
| `garment.reconstruct` | Áo độc lập từ trước/sau/(chi tiết), giữ màu/logo, có hình học và texture; không coi áo dính trong mesh người là áo có thể thay. |
| `garment.drape` | Áo đã đặt/mô phỏng cho đúng hai version avatar + garment, cùng origin, pose, scale; GLB chỉ chứa áo, không chứa avatar thứ hai. |

Thêm engine vào config **chỉ sau khi adapter có thể xuất kết quả thật**. Ví dụ cấu trúc (đường dẫn và revision là giá trị thực của bạn, không chạy nguyên ví dụ):

```json
{
  "engines": {
    "avatar.reconstruct": {
      "model": "SiTH-local",
      "revision": "EXACT_LOCAL_REVISION",
      "command": ["C:/path/to/python.exe", "C:/path/to/adapter.py", "--input", "{input}", "--output", "{output}"],
      "timeoutSeconds": 1800
    }
  }
}
```

`command` là danh sách argv do người vận hành cấu hình. Không có shell/eval hay lệnh do user/job gửi lên. `{input}` là đường dẫn JSON cục bộ, `{output}` là GLB cần ghi. Dùng đường dẫn tuyệt đối vì thư mục chạy là thư mục riêng từng job.

Input JSON có `protocolVersion`, `jobId`, `kind`, `params`, `assets` (role + localPath), `avatarVersionId`, `garmentVersionId`, `modelRevision`, `outputContract`, `outputPath`. Ảnh input được decode/xoay theo EXIF, bỏ metadata và chuẩn hóa JPEG tối đa 2048px, quality95 trên web; không cam kết pixel giống hệt ảnh gốc. Asset GLB <=40MiB, embedded textures, đơn vị mét, +Y lên, +Z trước, không Draco/KTX2. Gate format/mesh không thay cho kiểm định likeness, logo, xuyên áo hoặc độ vừa.

Worker tải file với kiểm tra bytes/SHA-256; gia hạn liên kết input hết hạn; heartbeat 20 giây; upload output vào staging, finalize rồi complete. Server mới quyết định công bố. Lease mất/thu hồi/cancel thì dừng tiến trình con. Network outage không âm thầm chuyển sang cloud AI khác. Worker data và log chứa dữ liệu cá nhân, phải giữ riêng và có chính sách xóa; không đưa vào Git.

Chạy một worker process trên GPU 12GB. Không bật nhiều engine cư trú VRAM cùng lúc. Adapter tự nạp/nhả model và benchmark; worker không tự tối ưu VRAM hoặc đảm bảo tốc độ RTX3060.

## Xác minh khi PC sẵn sàng

- Kiểm tra capability hiện đúng ở `/prepare`; dùng ảnh thử có quyền sử dụng.
- Avatar → áo → mặc thử phải có ba artifact thật; kiểm tra trước/bên/sau, màu/logo, mesh và alignment.
- Mở `/looks`: làm quiz, chọn avatar và chuẩn bị fitting. Khi ready, mở Studio; đổi áo đã preload không tạo job mới.
- Tắt PC: ready assets vẫn mở qua private storage, job mới chờ. Bật lại: job queued được nhận; lease hết hạn được claim phục hồi với token mới, tối đa 3 attempts.
- Kiểm tra OOM, cancel khi đang chạy, retry, URL hết hạn và hai tài khoản. Chưa có benchmark người thật/garment thật trên PC trong phiên triển khai Mac.

Thu hồi worker từ máy quản trị:

```sh
node --env-file=.env.local scripts/worker/manage.mjs revoke OWNER_UUID WORKER_UUID
```

## Kiểm thử không dùng GPU

```sh
npm run lint -- --max-warnings=0
npm test
npm run build
npm run test:v2:db
npm run test:v2
```

`test:v2` dựng auth/storage giả + PostgreSQL thật + Chromium, dùng hình tam giác synthetic và adapter test trong thư mục tạm. Không chứa model SMPL-X hoặc chạy inference; không được dùng screenshot test để quảng cáo avatar chân thực. Cần Docker/PostgreSQL image và Playwright Chromium. Bộ test dọn container/thư mục tạm khi hoàn tất.
