# Receipt — CL-FULLLOOK-20261105-01 (Claude, full áo thun + jeans code)

Ghi lúc 2026-11-06T03:55Z, trước lần sửa code đầu tiên của phiên này. Prompt: `docs/handoffs/prompt-claude-full-look-code.md` + H-EXEC-009 + SPEC-01.

| Mục | Giá trị |
|---|---|
| Session | CL-FULLLOOK-20261105-01 (tiếp nối CL-RECOVERY-R1-20261105-01, cùng cloud workspace) |
| Docs SHA đã đọc | `47f521f` (`codex/project-operations`, fetch ff-only; không có commit mới hơn lúc ghi) |
| App baseline | `a3d051a` = R1 `afc37ff` + một commit mapping exit-code theo adapter PC thật (PR #1) |
| Nhánh / worktree | `codex/full-look-c1` trong cloud worktree riêng; sạch (0 file dirty) lúc ghi |
| Canonical Studio / main Mac | Không chạm. Code chỉ giao qua bundle/diff local-only như R1 |
| Tests đã chạy trước đó | Trên `a3d051a`: lint, unit, build, test:v2:db, test:v2, test-worker-recovery S1–S12. Sẽ chạy lại trên revision cuối, không dùng lại số cũ |

## Reconciliation với R1

- R1 đã có durable checkpoint, receipt replay, claim redelivery, grants default-deny và mapping exit-code có cấu trúc (exit 78/2 + JSON dòng cuối stderr, argparse → INFERENCE_FAILED, không đoán OOM từ traceback). Phiên này giữ nguyên các phần đó, không viết lại.
- Gap C0 còn mở: Windows kill-on-close đang chỉ cảnh báo rồi vẫn chạy adapter. Sẽ sửa thành fail-closed, kèm chế độ tắt phải bật rõ ràng.
- TIMEOUT so với INFERENCE_FAILED vẫn cần chốt với PC; giữ TIMEOUT trong revision v1-r1 như đề xuất, chưa đổi exit code PC.

## Phạm vi file dự kiến

- C0: `scripts/worker/worker.py`, `scripts/worker/test_worker_unit.py`, `scripts/worker/config.example.json`, docs worker.
- C1: migration additive mới (slot top/bottom, category jeans), `src/lib/v2/*`, `src/lib/studio/*`, `src/components/studio/*`, `src/components/v2/*`, schemas JSON và fixture GLB (body/top/bottom), tests liên quan.
- C2/C3: capture/upload/retention/recommend/render trong `src/`, chỉ sau checkpoint C1.

Không làm: push source app, merge, deploy, production migration, enroll live worker, sửa adapter/toolchain PC, sơ mi/quần tây/short, animation, paid provider.
