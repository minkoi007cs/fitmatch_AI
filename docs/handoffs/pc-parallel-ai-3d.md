# H-PC-SPLIT-010 — hai chat PC, một GPU

Chủ dự án yêu cầu mở thêm một chat trên PC: một chat AI text/vision, một chat mô hình3D. Quyền tạo chat mới này thay hạn chế không tự tạo chat trong rules cho đúng một chat được yêu cầu; không cho agent tự mở thêm chat/subagent khác. Đọc H-EXEC-009 và SPEC-01; Claude vẫn sở hữu code app/transport/server, Codex review.

## Phân chia ownership, thay phần Qwen giao chat PC cũ

| Luồng | Ownership | Không sửa |
|---|---|---|
| Chat PC hiện hữu “Khảo sát pipeline GPU Fitmatch AI” | SiTH/SMPL-X, checkpoint004, GarmentCode/top+jeans, Blender/headless render, adapters3D/toolchain, renderer report | Qwen env/cache/setup/service của chat AI |
| Chat PC mới “FitMatch PC — AI model Qwen” | Qwen3-VL-4B download/runtime env, garment attributes JSON/typed intent smoke, local model readiness report | Env SiTH/GarmentCode, modelsSMPL-X/SiTH, renderer/adapter3D, app server/worker transport |

Chat cũ checkpoint phần Qwen nếu đã bắt đầu rồi ghi manifest paths/revisions/partial downloads để chat mới reuse. Không chạy hai download cùng artifact cache, không xóa cache partial của bên kia. Nếu chat cũ đang inference thì giữ tới checkpoint an toàn, chat mới chỉ CPU/download.

Chat mới chạy trong thư mục độc lập gợi ý `C:/Users/johnn/Documents/Fitmatch-GPU/ai-service`, env `envs/qwen-vl`, model cache `models/qwen3-vl-4b`, raw report dưới `reports/ai`. Kiểm tồn tại/owner trước tạo; nếu tên đã dùng thì tiếp đúng hoặc chọn tên task rõ, không ghi đè. Không commit chung .git/index của repo GPU đang có chat3D sửa. Chỉ report sanitized qua checkout docs riêng/nhánh docs riêng sau kiểm, không sửa process chính hoặc PR1 do3Downer đang giữ.

## Quy tắc tài nguyên

Hai chat được song song đọc tài liệu, lập manifest, tải file khác cache, chuẩn bị env riêng và test CPU. RAM16GB cũng có giới hạn; tránh cùng lúc giải nén/build/model load nặng.

GPU0 có12GB: một tác vụ compute/render GPU/model load cư trú mỗi lần trên toàn máy. Chat3D là **điều phối GPU mặc định**. ChatAI chưa được load/smoke/serve bằngGPU cho tới khi:

1. Có receipt bàn giao phần Qwen từ3Downer, xác nhận không cóQwen job khác đang chạy.
2. Hai luồng dùng cùng một shared OS lock/exclusive handle tại đường dẫn cố định do3Downer chốt, ví dụ `Fitmatch-GPU/coordination/gpu0.lock`, không haiworkDir locks riêng. Guard được test độc quyền thật; file có chữ “busy” không thay OSlock.
3. Chat3D công bố slotGPU hoặc checkpoint/sẵn sàng nhả, rồi chatAI acquire lock trước nạpmodel và giữ tới khi process/modelGPU đã giải phóng. Không tự xóa lock/takeover do timestamp cũ. ChatAI chỉ download nếu guard/ack còn thiếu.

Guard minimal nội bộ setup không thay thiết kế live two-owner scheduler của Claude; Windows process orphan/timeout cleanup cần test trướclive. Không chạy hai benchmark GPU để thử cóOOM không, không kill job của nhau, không đổi power/driver/reboot. Không giữ Qwen server resident để chặn pipeline3D.

## Lệnh chat AI mới

- Xác minh đúng PC Windows/RTX3060/RAM và paths, pull/read bộ docs shared, ghi receipt docsSHA/session/owner/cache/env và phầnQwen nào đã có. Không lặp inventory riêng tư toàn hệ thống hoặc tải lạiSiTH.
- Kiểm model card chính thức https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct ; tải một revision phù hợp, processor/tokenizer/config và weights cần thiết; verify/pin source/license/bytes/hash, free disk và lượng download. Không tự accept gated terms/account hoặc dùngpaidprovider.
- Runtime riêng tương thíchQwen, không upgrade torchSiTH2.1. Quantization/offload chọn theo support thực tế và headroom12GB/16GB; ghi đúng artifact4bit hay full weights quantized on-load. Không tải cả4B+8B+imagegenerator cùng lúc. Không chạy remote repo code khi không cần và chưa đọc.
- Chuẩn bị CPU schema/unit fixtures cho attributes (category top/bottom, color/pattern/logo observations grounded in image) và edit intents có allowlist; model chỉ mô tả/đề xuất typed intents, chưa tự sửamesh. Qwen không tạo avatar/garmentGLB.
- Sau sharedGPU guard/slot được xác nhận: chạy một ảnhthun, mộtảnhjeans có quyền và mộtlệnhtext→JSON; đo time/VRAM/RAM/correctness, schema invalid retry bounded, unload trước trảGPU. Nếu guard chưa có, reportDownloaded/SetupReady/GPUSmokeNotRun rõ, không chạyđua.
- Không public model port, không liên hệ providercloud hoặc nhậnservice-role. API tích hợp sau qua Claude/workerqueue cócapability/schema version; không giả jobavatar.reconstruct để chạyVLM. Existing rules-v1 vẫn là fallback không cầnVLM.
- Bàn giao `ai-model-setup-report.md`: receipt/runtime/model/downloadmanifest, guard receipt và GPUslot nếu có, commands/exit, JSON outputs redacted, metrics, limitation/failure và bước tiếp. Không weights/ảnh/token/signedURL ở publicrepo. Không tự tạo chatkhác hoặc tự nhắn agent nếu không cóủyquyền.

## Lệnh điều chỉnh chat3D hiện hữu

Giữ toàn bộ phần SiTH/GarmentCode/Pants/Blender của H-EXEC-009. Dừng nhận thêm việcQwen, checkpoint/handoff phần đã làm nếu có, publishreceipt và đườngdẫnartifact cho chatAI. Sở hữu sharedGPUguard/slot coordination; chưaguard thì chatAI CPU-only còn bạn cóthể tiếp GPU trong scope hợp lệ. ThiếuMSVCadmin vẫn hướngdẫn user step, khôngbypass; render và garment phần độc lập tiếp tục. Giao một asset/render thật và báo model/toolchain readiness, không chỉ validator skeleton.

Hai report không tự = fullreleaseDone. Codex theo dõi receipt và review; process ghi created/sent/received/running khác nhau. Đọc https://developers.openai.com/codex/app/features cho khái niệm chat song song; ràng buộc GPU/ownership ở đây là quy định dự án, không tính năng tự điều phối tài nguyên của Codex.
