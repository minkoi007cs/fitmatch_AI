# Dọn nhánh local FitMatch — 05/11/2026

Task OPS-01 / CX-CLEAN-20261105-03. Thực hiện theo yêu cầu chủ dự án, không sửa implementation.

## Kết quả

Chỉ còn hai nhánh local: `main` (checkout điều phối/source cũ, dirty được giữ nguyên) và `codex/3d-studio-worker` (app V2, d2a9898, sạch lúc kiểm). Không merge/reset main vì hai lịch sử không có merge-base.

Đã xóa tên nhánh local `codex/app-system-auth` và `codex/fix-audit-followup`, sau khi kiểm cả hai commit đã nằm trong nhánh Studio, sao lưu tag và bundle có verify/checksum. Hai thư mục worktree cũ giữ nguyên đường dẫn, detached HEAD ở commit cũ, bao gồm config/env ignored; không dùng làm nơi triển khai mới. Các worktree detached ở /private/tmp giữ nguyên, không thuộc nhánh active.

Không push/xóa remote branch hoặc tag remote, không prune/reset/clean/stash, không xóa code/ảnh/model/dependency/env hoặc tác động PC. `origin/*` còn hiện là remote refs, không phải nhánh local còn sót.

## Bản sao và khôi phục

Xem [manifest.json](./manifest.json) cho SHA, refs trước/sau, worktree và checksum bundle local `pre-cleanup.bundle`. Hai tag giữ commit trong repo:

- `archive/20261105/app-system-auth`
- `archive/20261105/fix-audit-followup`

Nếu cần phục hồi tên nhánh (không tự checkout vào công việc đang chạy):

```sh
git branch codex/app-system-auth archive/20261105/app-system-auth
git branch codex/fix-audit-followup archive/20261105/fix-audit-followup
```

Git bundle chỉ lưu Git objects/refs, không sao lưu file uncommitted; những file đó được bảo toàn nguyên vị trí, không xóa. Không đưa bundle vào gói handoff chia sẻ hoặc tự push archive tags.

## Ghi chú Git lock

Lúc xóa branch, Git cảnh báo không khóa được config vì `.git/config.lock` tồn tại. Cả hai branch refs đã bị xóa và kiểm lại thành công, không có branch config sections cần dọn. Không tự xóa lock vì có phiên khác có thể đang sở hữu; không coi warning là lý do chạy reset/force thao tác khác.

## Kiểm tra

Đã kiểm branch set, commit/tag ancestry, HEAD không đổi, Studio sạch, worktree cũ sạch/detached, env files còn nguyên và SHA256 bundle. Không chạy app/GPU tests vì chỉ đổi Git refs/docs. Bộ điều hành mới tiếp tục đọc AGENTS → agent → roadmap → process ở checkout nguồn; code app tiếp nối worktree Studio hiện hữu.
