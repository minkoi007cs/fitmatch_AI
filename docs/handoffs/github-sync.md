# Đọc và cập nhật bộ điều hành chung qua GitHub

Nguồn chính: nhánh `codex/project-operations` của repo https://github.com/minkoi007cs/fitmatch_AI . Nhánh này chỉ quản lý tài liệu, không là baseline implementation. Main/Studio/PC giữ code/checkpoint riêng; không merge app từ nhánh tài liệu.

## Đọc trên trình duyệt

Mở https://github.com/minkoi007cs/fitmatch_AI/tree/codex/project-operations . Đọc AGENTS.md → agent.md → roadmap.md → process.md, rồi docs/handoffs/reassignment-2026-11-05.md và prompt đúng vai trò. Snapshot contract trong docs/handoffs/resume-snapshot-20261105 là revision lịch sử có hash, không tự thành live API mới nhất.

## Lấy tài liệu độc lập, không sửa repo GPU/app đang dở

Lần đầu clone vào một thư mục mới **chưa tồn tại**. Các lệnh này dùng được trong PowerShell và shell trên Mac khi đã có Git:

```sh
git clone --single-branch --branch codex/project-operations https://github.com/minkoi007cs/fitmatch_AI.git fitmatch-operations
cd fitmatch-operations
git rev-parse HEAD
```

Đây là checkout riêng để đọc/quản lý docs, không chạy npm install hoặc model setup trong đó. Không clone đè C:/Users/johnn/Documents/Fitmatch-GPU/fitmatch_AI hoặc worktree Mac đang có công việc.

Những lần sau, trong checkout tài liệu sạch:

```sh
git status --short
git pull --ff-only origin codex/project-operations
git rev-parse HEAD
```

Nếu có thay đổi chưa commit hoặc pull báo diverged: giữ nguyên, đọc diff và reconcile, không reset/clean/force-push. Không chạy lệnh ở nhầm repo. Có thể chỉ đọc GitHub nếu chưa cần clone. Báo commit tài liệu đã đọc trong session report để hai máy biết đang cùng revision.

## Gửi cập nhật tiến độ

Chủ dự án cho phép publish tài liệu điều phối lên nhánh này; quyền này không bao gồm push source app, weights, ảnh cá nhân, token, migration production hoặc deploy. Agent PC/Mac chỉ commit report và delta thuộc scope mình ở checkout tài liệu riêng; Codex reconcile process chính sau khi đọc report. Đọc status/claim mới trước sửa, không ghi đè process bằng bản PC/Mac cũ.

Nếu có quyền push: tạo task branch `docs/<role>-<session>` từ origin/codex/project-operations, chỉ stage file report/delta cụ thể và mở PR về codex/project-operations. Không tự merge PR hoặc đẩy đè nhánh chung. Nếu thiếu quyền GitHub, giữ report cục bộ và báo blocker; không đổi repo thành private/public hoặc chia credentials. Khi PR được hợp nhất, hai máy pull lại; chưa merge không giả process chung đã cập nhật.

Báo cáo lớn/ảnh gốc/model không đưa lên repo công khai. Chỉ metadata an toàn, redacted logs và evidence phù hợp quyền dùng; artifact riêng tư dùng storage/Drive được cấp quyền. ZIP002/003 và Drive link cũ chỉ là lịch sử/fallback, không phải nguồn cập nhật chính nữa.
