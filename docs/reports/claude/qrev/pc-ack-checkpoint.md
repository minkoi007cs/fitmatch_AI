# QREV — PC ACK checkpoint (shared GPU lock / single lock owner / native conformance)

Session CL-QREV-20261108-01. Branch `codex/qwen-review-fixes` (từ `95d59ad`). Code SHA và hash file: xem `report.md`. Tài liệu này là **checkpoint để PC3D và PC Qwen xác nhận**, không phải bằng chứng PC đã chạy. Không chứa đường dẫn riêng, token hay credential: các đường dẫn thật PC tự điền ở máy mình và gửi ACK qua kênh riêng.

## 1. PC3D cần ACK (một lock owner, không lock thứ hai)

| Mục | Giá trị worker mong đợi | PC3D xác nhận |
|---|---|---|
| Lock | file **đã có sẵn**, đường dẫn tuyệt đối `…/Fitmatch-GPU/coordination/gpu0.lock`, msvcrt byte 0 (Windows) / flock (POSIX); worker mở `r+`, **không bao giờ tạo** | [ ] đúng đường dẫn tuyệt đối trên PC (gửi riêng) |
| Guard | `gpuGuard.path` tuyệt đối + `sha256` = `47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c` (PR10); worker kiểm hash lúc khởi động **và** trước mỗi claim | [ ] hash còn đúng revision đang chạy; nếu đổi guard thì gửi hash mới |
| Slot | `gpu0-slot.json` cạnh lock; `{version 0\|1, owner pc-3d\|pc-ai, issuedAtUtc, issuedAtUnix, admitUntilUnix, policy}`; ≤3600 s, lệch giờ ≤5 s; không file = chỉ pc-3d (pc-ai bị từ chối); slot hết hạn từ chối cả hai | [ ] quy tắc port trong `validate_slot` khớp guard (không key lạ/trùng, không NaN/bool, UTC) |
| Lock owner | worker giữ lock suốt claim → adapter → drain toàn cây process; adapter nhận `FITMATCH_GPU_LOCK_HELD_BY=worker` + `FITMATCH_GPU_LOCK_PATH`; guard/runner **không** lấy lại lock khi thấy biến này | [ ] guard không nest |
| Từ chối khởi động | thiếu/sai `gpuLock` (`default`, tương đối, chưa tồn tại), thiếu `gpuGuard`, sai hash, `gpuSlotOwner` lạ → exit 5 “Refusing to start”, không claim | [ ] đã thử trên Windows native |
| Từ chối trong vòng lặp | slot của owner kia / không slot / hết hạn / guard đổi hash → nhả lock, không claim, heartbeat `gpuBusy:true` | [ ] đã thử trên Windows native |

## 2. PC Qwen cần ACK (conformance cuối)

- [ ] Adapter đọc `analysis-adapter-input`, ghi đúng một `analysis-result` ≤8192 B; `python scripts/check-qwen-contract.py <result.json thật>` PASS.
- [ ] Exit code + dòng stderr cuối khớp bảng trong `docs/qwen-contract-v1.md` (75/74 retryable không tốn attempt; 70/71/78/2 terminal).
- [ ] Model `revision` pin đúng commit đang chạy; Qwen load chỉ sau khi worker đã giữ lock và qua admission RAM/VRAM; unload trước exit.

## 3. Lệnh PC chạy native trên đúng commit app (Windows)

```
cd <app checkout ở commit được giao>
python -m unittest -v scripts\worker\test_worker_unit.py
python scripts\worker\worker.py --config <config thật> --once   # lần đầu với slot pc-3d: phải in "GPU admission refused"
```

Gửi lại: commit app, `sha256` của `scripts/worker/worker.py` đang chạy, log unittest (số test, exit), log `--once` (refused/claimed), timestamps acquire/release lock và PID tree khi 3D↔Qwen tranh nhau.

## 4. Chưa có / không giả định

- Chưa chạy native Windows; chưa có Supabase test project + HTTPS + credential qua kênh riêng; chưa có Qwen thật trong luồng app. Mock CPU adapter và synthetic guard/slot trong HTTP test **không** chứng minh PC thật.
- PC-PHOTO-019 (fitting/debug GLB) không phải bằng chứng tích hợp app.
