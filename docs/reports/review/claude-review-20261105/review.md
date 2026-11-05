# Codex review — báo cáo Claude và proposal recovery

05/11/2026. Session CX-REVIEW-20261105-05. Baseline Studio `d2a98983391c90c0df0c7decb67bd2b0d8cad9c6`, sạch lúc kiểm. Không sửa implementation/worktree của owner.

## Kết luận

**NEEDS CHANGES cho APP-01 và điều kiện nối worker live.** Báo cáo Claude có bằng chứng hữu ích; reviewer xác nhận các lỗi worker/SQL và thêm kiểm Sharp đúng bản. **Proposal SQL/Python chưa được duyệt để áp nguyên bản**. G0/G1 chất lượng 3D vẫn NOT VERIFIED, không liên quan số lượng test SQL pass.

Nguồn: [report Claude](../../claude/mac-resume-report.md), [proposal](../../claude/patch-proposal.md), scripts/logs đi kèm, migration/worker/API source thật. Hash migration `149fbcbf…a07a8d` và worker `c17109dc…a0abcb` khớp report. Remote refs tại thời điểm review có thêm nhánh docs, nên bảng remote cũ trong report Claude là lịch sử; không dùng để kết luận tài liệu chưa publish.

## Reviewer đã chạy

- Repro SQL trên PostgreSQL16 Docker riêng, network none, không published ports: **14 reproduced, 0 not reproduced**; [log](./reviewer-repro.log).
- Proposal SQL trên DB synthetic riêng: **11 ok, 0 failed** trong các case đã có; [log](./reviewer-proposal.log). Đây chỉ là happy-path/sequential tests của proposal, chưa đủ API/race/crash proof.
- Chạy lại `worker_repro.py` bằng đúng worker source d2a9898: W1 có `finalize → complete(503) → fail:INFERENCE_FAILED`; W2 chỉ claim rồi ValueError, không fail.
- Sharp **0.35.5** ngay trong dependency worktree: PNG alpha0 qua rotate/resize/jpeg95 cho pixel nền `[0,0,0]`. Xác nhận lỗi nền đen trên đúng bản, chưa đo texture/logo thực.
- Chạy script repro từ bản copy temp, không sửa evidence Claude. Điều chỉnh duy nhất để tương thích BSD/macOS: `paste -sd,` thành `paste -sd, -`; wrapper psql chỉ chuyển lệnh vào container riêng và map đường dẫn SQL. Lần đầu lỗi portability đã được xử lý, kết quả cuối như trên.
- Đã dọn container reviewer tạo. Không chạy full app lint/unit/build/V2 integration, không Supabase/PC/GPU thật, không GLB lớn/browser likeness.

## Làm rõ lỗi complete

Hai trường hợp khác nhau:

1. Complete **đã commit**, phản hồi mất: replay hiện bị từ chối, nhưng job trong repro R1 vẫn **succeeded**. Không diễn giải rằng fail luôn ghi đè success; transition chỉ nhận running.
2. Output **đã finalize**, complete chưa được DB ghi nhận/503: worker gửi fail, DB có thể nhận fail và model chưa gắn output; khi retry có nguy cơ chạy inference lại (R1b/W1). Output asset có thể vẫn còn trong storage, chưa có cơ chế phục hồi gắn vào model.

Cả hai cần xử lý, nhưng lý do và test khác nhau. Worker mock W1 không giả lập DB đã commit rồi rớt socket; phải bổ sung chính case đó.

## Điều kiện sửa trước live — owner Mac thực hiện

| Gói | Mức | Việc / test bắt buộc |
|---|---|---|
| FIX-MAC-01 | Chặn live | Complete idempotent toàn API + DB; lưu receipt/output identity, retry có backoff, unknown outcome reconcile; không fail sau finalize mơ hồ. Test trước commit lỗi / sau commit mất reply / finalize mất reply / process restart / revoke-cancel-stale token. Bounded retry hết hạn không được âm thầm requeue và dựng lại output đã có; cần recoverable state/checkpoint và hành động phục hồi rõ. |
| FIX-MAC-02 | Chặn live | Claim redelivery an toàn cùng instance/claim request; không tăng attempt khi mất reply. Kiểm heartbeat race, delayed claim replies, restart, lease expired và hai process. Không dùng `exist_ok=True` rồi dọn file mù: lock/checkpoint/hash và tái sử dụng output hợp lệ, không xóa inference vừa xong. |
| FIX-MAC-03 | Chặn live | Worker revision mismatch phải báo MODEL_UNAVAILABLE trước khi bỏ assignment; phân loại adapter lỗi, OOM, timeout. Allowlist capability do server/operator cấp, compute/status chỉ báo phần được phép; rollout worker cũ/default deny có hướng dẫn. |
| FIX-MAC-04 | Trước garment beta | Cache sau exhausted attempts có explicit regenerate/version mới; cùng key cũ replay đúng kết quả cũ, key mới có thể tạo generation mới theo policy, không vô hạn bypass quota. Key có engine/pipeline/pose/material revision. Test concurrent regenerate chỉ tạo một generation; readers chọn đúng latest/ready, không SELECT tùy ý nhiều rows. |
| FIX-MAC-05 | Chặn two-owner live | Một bộ điều phối GPU với khóa **theo GPU/host**, không chỉ tùy ý workDir. Khóa trước claim và giữ qua subprocess exit/cleanup; token owner riêng, round-robin không làm hai inference overlap. Test hai process dùng workDir khác nhau, crash/restart và Windows thật. Không chuyển quyền đọc mọi user cho worker. |
| FIX-MAC-06 | Trước real image quality | Flatten nền có chính sách rõ (ví dụ trắng) trước JPEG hoặc giữ alpha có chủ đích; test Sharp đúng version, ảnh opaque không sai màu, EXIF/dimension/bytes validation giữ. Ghi nguồn normalized vs original. |
| FIX-MAC-07 | Trước beta ảnh cá nhân | API xóa/version tombstone, ref checks và completion cancel race; GC dry-run, không xóa live asset đang dùng. Retention PC có scope của PC, chưa tự chạy cleanup destructive. |

P1–P3 theo tên Claude là tối thiểu, nhưng allowlist/revision xử lý cùng đợt; two-owner live phải đợi FIX-MAC-05. PC vẫn tiếp tục local toolchain/inference theo giới hạn UAC, không cần chờ mọi UI feature.

## Vì sao chưa duyệt proposal nguyên bản

- Retry RAM đơn thuần + cờ `finalized` không sống qua restart. Nếu lease hết mà queue re-enqueue như cũ, vẫn rerun model. Cần durable receipt/local checkpoint và server recovery policy trước gọi hoàn tất sửa.
- Proposal thêm index generation nhưng chưa sửa enqueue/readers; khi có nhiều generation, câu select hiện tại không xác định bản được chọn. Không áp index riêng như bản sửa hoàn chỉnh.
- Thêm overload `fm_v2_claim(uuid,uuid)` phải kiểm qua RPC/PostgREST thật hoặc dùng RPC tên riêng để tránh ambiguity; `psql` gọi được không chứng minh `.rpc()` mapping ổn. Tài liệu chính thức: https://supabase.com/docs/guides/database/functions .
- Một process multi-token phải heartbeat/revoke đúng owner, tránh token leak sang adapter; strip mọi biến chứa token (kể cả biến mới), không chỉ FITMATCH_WORKER_TOKEN. Giữ thuật toán scheduling và khóa GPU được test trên Windows.
- Hai script SQL không exit nonzero khi biến `fail`/`bad` >0. Chuyển thành regression phải assert và exit1 khi bất kỳ case fail; output Summary/exit0 hiện không tự chứng minh tests sẽ chặn CI.
- Worker fixture GLB20byte chỉ đủ đi qua header check, không đạt validator server GLB/mesh; giữ fixture này cho transport unit test, thêm output GLB hợp lệ cho API end-to-end.
- Complete receipt phải giữ owner/attempt/asset/worker validity; revoked credentials, tombstone/cancel không bị replay phục hồi. Không đưa completed_token ra browser/API projection.

## Bàn giao

Owner Mac hiện hữu nhận [lệnh sửa](../../../handoffs/prompt-mac-recovery-fixes.md), tự claim file scope và ghi report revision. Claude tiếp tục review/retest độc lập, không tự nhận ownership chỉ vì report đã được chấp nhận. Không merge/deploy/migrate production hoặc push app trong gói này. Codex nhận kết quả cuối/diff/log để retest, chỉ khi đạt mới cho bước PC live theo protocol revision mới được thống nhất.
