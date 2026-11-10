import type { ModelRow, JobRow } from "./contracts";
export type Library = {
  models: ModelRow[];
  jobs: JobRow[];
  online: string[];
  connected: boolean;
};
const messages: Record<string, string> = {
  SOURCE_DELETED: "Ảnh/video nguồn đã được xóa. Hãy tạo phiên bản mới bằng bộ ảnh mới.",
  FITTING_NOT_READY: "Món đồ chưa sẵn sàng để lưu vào bộ phối. Hãy chờ xử lý xong.",
  LOOK_NOT_FOUND: "Không tìm thấy bộ phối này. Hãy làm mới danh sách bộ đã lưu.",
  QUIZ_REQUIRED: "Hãy hoàn thành quiz trước khi gợi ý.",
  MODEL_NOT_READY: "Avatar và áo cần xử lý xong trước khi mặc thử.",
  QUOTA_EXCEEDED:
    "Đã đạt giới hạn xử lý. Hãy chờ hoặc hoàn tất các tác vụ đang có.",
  DATA_UNAVAILABLE: "Chưa kết nối được thư viện 3D. Hãy thử tải lại sau.",
  SERVICE_UNAVAILABLE: "Dịch vụ 3D chưa sẵn sàng. Hãy thử lại sau.",
  JOB_ACTION_NOT_ALLOWED:
    "Tác vụ đã đổi trạng thái hoặc đạt giới hạn 3 lần chạy. Hãy làm mới.",
  IDEMPOTENCY_CONFLICT: "Yêu cầu đã thay đổi. Hãy đóng và mở lại bộ ảnh.",
  FEATURE_DISABLED: "Phân tích bằng AI chưa được bật trên máy chủ này.",
  ITEM_HAS_NO_IMAGE: "Món đồ này chưa có ảnh để phân tích.",
  ITEM_IMAGE_UNAVAILABLE: "Không đọc được ảnh của món đồ. Hãy tải ảnh lại.",
  INVALID_IMAGE: "Ảnh không hợp lệ hoặc quá nhỏ (cần ít nhất 128×128).",
  IMAGE_TOO_LARGE: "Ảnh lớn hơn 10 MB.",
  RESULT_CHANGED: "Kết quả phân tích đã thay đổi. Hãy xem lại trước khi lưu.",
  SOURCE_CHANGED: "Ảnh của món đồ đã thay đổi sau khi phân tích. Hãy phân tích lại.",
  ALREADY_DECIDED: "Bạn đã xử lý đề xuất này rồi.",
  NOT_REVIEWABLE: "Đề xuất chưa sẵn sàng để duyệt.",
  RETRY_NOT_ALLOWED: "Không thể thử lại (đã đủ 3 lần hoặc trạng thái đã đổi).",
  CANCEL_NOT_ALLOWED: "Tác vụ đã chạy xong hoặc đã dừng.",
};
export async function api<T>(
  path: string,
  body?: unknown,
  headers?: HeadersInit,
  method?: string,
): Promise<T> {
  const response = await fetch(`/api/v2/${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    cache: "no-store",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại."
        : (messages[data.error] ?? "Không thể hoàn tất thao tác. Hãy thử lại."),
    );
  return data as T;
}
export async function library(): Promise<Library> {
  const [models, jobs, status] = await Promise.all([
    api<{ models: ModelRow[] }>("models"),
    api<{ jobs: JobRow[] }>("jobs"),
    api<{
      workers: { online: boolean; capabilities: Record<string, unknown> }[];
    }>("compute/status"),
  ]);
  return {
    ...models,
    ...jobs,
    connected: status.workers.some((w) => w.online),
    online: [
      ...new Set(
        status.workers
          .filter((w) => w.online)
          .flatMap((w) => Object.keys(w.capabilities)),
      ),
    ],
  };
}
export const stateLabel: Record<string, string> = {
  queued: "Đang chờ máy xử lý",
  running: "Đang xử lý",
  succeeded: "Sẵn sàng",
  failed: "Cần thử lại",
  canceled: "Đã hủy",
};
export const kindLabel: Record<string, string> = {
  avatar: "Avatar",
  garment: "Đồ 3D",
  fitting: "Đồ đã mặc thử",
};
export async function prepareFitting(avatar: ModelRow, garment: ModelRow) {
  return api<{ jobId: string; modelId: string; reused: boolean }>(
    "models",
    {
      kind: "fitting",
      name: garment.name,
      avatarId: avatar.id,
      garmentId: garment.id,
    },
    { "Idempotency-Key": `fit_${crypto.randomUUID()}` },
  );
}
