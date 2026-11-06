# Claude continuation after Codex integration — H-AUDIT-016

Bạn là owner app cho đợt CL-POSTAUDIT-01 theo yêu cầu chủ dự án. Tiếp code đã có, ghi receipt trước sửa và bàn giao để Codex review. Không tạo lại C0–C3 hoặc viết worker protocol thứ hai.

## Đọc và baseline

1. Fetch/pull checkout tài liệu riêng `codex/project-operations`; đọc AGENTS.md → agent.md → roadmap.md → process.md đầy đủ. Latest audit: `docs/reports/review/project-audit-20261106/audit.md`. Quyết định sản phẩm vẫn SPEC-01: avatar cá nhân + áo thun + jeans, wardrobe riêng, editor thật, render lookbook.
2. App baseline **7be869c989bc8c2b13d8b9ce621c9f70d487e57c**, remote `codex/full-look-reviewed`. Tạo branch/worktree riêng `codex/claude-post-audit` từ commit này. Không bắt đầu từ b4e7527/c471e74/d2a9898 hoặc merge nhánh docs vào app. Kiểm actual HEAD/status/ancestry trước sửa. Canonical Studio tại d2a9898 giữ nguyên.
3. Đọc relevant Next docs trong `node_modules/next/dist/docs/` trước sửa; giữ dependencies/lockfile. Ghi `docs/reports/claude/post-audit-receipt.md`: session, docsSHA, appSHA, worktree, file scope, task IDs, verification. Gửi delta cho process chính; không đè process cũ.

## Codex đã làm sau bản C0–C3 của bạn — phải giữ lại

Đây là các thay đổi ngày05–06/11 theo nhật ký dự án, không dựa riêng vào chữ “hôm qua”.

- `92c79b6`: đóng file descriptor GPU lock sau release/acquire thất bại, regression; ghi rõ strict PC adapter không tự bỏ qua field mới. `33eff4b`: chuẩn hóa log.
- `48f66f9`: test độc quyền giữa hai process và phục hồi sau process chết; phân biệt POSIX inherited-fd với Windows containment; native preflight runbook. PC đã tìm thêm launcher-PID caveat, xem dưới.
- `849ffbb`: giữ món dựng lỗi/hủy trong Studio, own-key category check, lỗi source-deleted/fitting-not-ready rõ ràng; kế hoạch MAC-14A–H.
- `7be869c`: fitting generations. Migration `20261106053812_fitting_generations.sql` có superseded_by và partial unique current pair; POST jobs/:id/regenerate khi exhausted failed/canceled/nooutput, owner lock/quota/ready derived guards; old job replay idempotent, superseded retry bị chặn. Studio/Looks chọn current; saved looks giữ explicit IDs. Fresh prepare keys tránh replay receipt generation đầu. Không undo hoặc bỏ cap3 để chữa cache.
- Evidence current:48 unit, lint/build,6PostgreSQLblocks,13API/browserblocks,20schemafiles PASS trong local synthetic harness. Windows unmodified18suite mới chỉ17pass/1error do launcher PID, proposal riêng18pass; không gọi upstream WindowsPASS.
- Codex standalone evidence checker trên docsbranch `tools/acceptance/`,13tests, chỉ integrity, không product acceptance. Không cần sửa app API để chạy checker.

## Ownership được bàn giao cho bạn

Codex dừng sửa app trong scope này để bạn tiếp quản trên branch riêng. Bạn sở hữu src/lib/studio/cloud.ts, Studio/AvatarDraft/Prepare UI liên quan, v2 routes/server, additive privacy migration, tests DB/API/browser, focused worker test-only fix và report. PC giữ engine/adapters/GPU guard/source cleanup. Codex giữ điều phối/review/docs chính. Nếu task chat khác đang sửa cùng file, checkpoint và reconcile trước, không reset/stash/ghi đè.

## P1 — CL-PRIV-01: xóa nguồn có retry đáng tin cậy

Audit source finding cần tái hiện trước sửa: fm_v2_source_retention chỉ trả paths của row chưa deleted, rồi tombstone commit; route storage.remove best effort. Nếu storage lỗi, delete lại không trả paths; UI đổi deleted và không có retry. GC chỉ dry-run, chưa collector. Logical tombstone không chứng minh physical erase.

Implement durable deletion intent/retry hoặc cơ chế tương đương có trạng thái persist, scope owner, idempotency, bounded retries và quan sát pending/failed/completed. Không hiển thị đã xóa vật lý khi cleanup còn pending; reload phải giữ trạng thái. Chỉ xóa source objects được yêu cầu, bảo toàn derived avatar/fittings/saved looks. Shared-source deletion ảnh hưởng mọi job đọc source phải rõ, không bỏ sót late completion fencing. Không tự chạy GC destructive đại trà; thực thi delete do user đã yêu cầu qua luồng ứng dụng, không production cleanup từ phiên coding.

Acceptance: storage.remove thất bại→reload→retry thành công; repeated requests không mất paths; foreign owner bị chặn; source shared với job khác bị cancel đúng; stale completion/retry/enqueue không hồi sinh nguồn; derived asset/look vẫn mở được. Record PC-local source cleanup là task PC riêng, không tuyên bố full deletion cảPC nếu chưa receipt. Default retention khi chưa chọn/failed jobs phải ghi policy hiện hành, không tự đặt lịch xóa ảnh hàng loạt.

## P1/P2 — CL-URL-01: ký lại URL đúng phiên bản

Thêm bounded refresh tối đa1lần khi signed asset URL hết hạn (phân biệt403/404/network/integrity failure). Re-fetch model metadata qua authenticated route; yêu cầu modelId/output asset identity/hash/bytes vẫn đúng bản đang tải/snapshot. Tôn trọng AbortSignal/current selection generation; không autoapply kết quả cũ. Không retry file hash sai, không infer lại, không vô hạn hoặc refresh mọi URL vô điều kiện.

Acceptance: expiredURL→sameversionURL→success; revoked/foreign asset denied; changedhash/bytes/model refused; corrupt GLB/hash fails; selection A→B→A/abort khôngghi đè; no new job. Kiểm avatar snapshot hash khi mở saved look, và giữ fitting IDs/version mapping rõ; chưa có đường legitimate supersede successful fitting nên đừng bịa observed corruption.

## CL-WINTEST-01: review proposal native test

PC PR4 report 3D-QA-006: Windows venv launcher Popen.pid khác actual interpreter giữ khóa. Test fixture kill launcher nhưng pipe còn mở, interpreter còn giữ lock. PC chuẩn bị `workers/windows/patches/app7be-native-lock-test-proposal.patch` local only từ7be; disposable copy18/18. Xin bản patch/source hash qua report/PC, hoặc tự triển khai test-only giải pháp có cùng bằng chứng. Dùng base interpreter cho fixture stdlib-only trên Windows hoặc track actual child safely; không tự thay production process containment/kill strategy từ một test launcher. Giữ kiểm POSIX behavior. Windows verify giao PC, không dùng mockedPASS để đóng gate.

## Sau các mục trên

- MAC-14C: đề xuất pin engine revision/cache policy/version fields; ready outputs/saved looks không tự invalidated, không rerun cảwardrobe. Chưa implement wire change trước PC ACK.
- CL-PILOT-01: cập nhật test-env runbook/migration order/rollback,2account/mobile capture/offline/restart1GPU, thao tác rõ; chưa migrate/deploy/enroll live.
- Npm audit current8moderate/0high-critical trong tooling ESLint/minimatch. Review compatible fix; không `audit fix --force` hoặc downgradeNext theo gợi ý audit.
- Không thêm paid provider, OCR autoapply, fake editor slider hay hứa15–30phút khi chưa benchmark. Ưu tiên sửa gaps đã audit, không mở category/animation.

## Kiểm chứng và bàn giao

Chạy npm test, lint/build, test:v2:db, test:v2 và export-contract --check trên finalSHA phù hợp scope. Không build đè .next khi browser suite đang dùng next start; chạy build xong mới test browser. Ghi lần fail/fix/rerun rõ. Dữ liệu tổng hợp ghi nhãn. Handoff report gồm scope/diff/finalSHA/migration/testcommands+exit/rawlogs, failure injections, owner/retention matrix, gaps/notrun và PC requests. Không production migrate/merge/deploy; source đưa review branch/bundle sanitized theo quy trình, không ảnh cá nhân/weights/token. Codex nghiệm thu sau review, user duyệt likeness.
