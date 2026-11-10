import type { ModelRow, JobRow } from "./contracts";
export type Library = {
  models: ModelRow[];
  jobs: JobRow[];
  online: string[];
  connected: boolean;
};
const messages: Record<string, string> = {
  SOURCE_DELETED: "Source photos or video have been deleted. Create a new version with new photos.",
  FITTING_NOT_READY: "This item is not ready to save in a look. Wait for processing to finish.",
  LOOK_NOT_FOUND: "This look was not found. Refresh your saved looks.",
  QUIZ_REQUIRED: "Complete the style quiz before requesting suggestions.",
  MODEL_NOT_READY: "Your avatar and garment must finish processing before trying them on.",
  QUOTA_EXCEEDED:
    "Processing limit reached. Wait for current jobs to finish.",
  DATA_UNAVAILABLE: "Unable to connect to the 3D library. Please try loading it again later.",
  SERVICE_UNAVAILABLE: "The 3D service is not ready. Please try again later.",
  JOB_ACTION_NOT_ALLOWED:
    "This job changed status or reached the three-attempt limit. Please refresh.",
  IDEMPOTENCY_CONFLICT: "The request has changed. Close and reopen the photo bundle.",
  FEATURE_DISABLED: "AI analysis is not enabled on this server yet.",
  ITEM_HAS_NO_IMAGE: "This item needs a photo before it can be analyzed.",
  ITEM_IMAGE_UNAVAILABLE: "Unable to read this item's photo. Please upload it again.",
  INVALID_IMAGE: "Invalid image or image too small (at least 128 × 128 required).",
  IMAGE_TOO_LARGE: "The image exceeds 10 MB.",
  RESULT_CHANGED: "The analysis result has changed. Review it again before saving.",
  SOURCE_CHANGED: "This item's photo changed after analysis. Please analyze it again.",
  ALREADY_DECIDED: "You have already reviewed this suggestion.",
  NOT_REVIEWABLE: "This suggestion is not ready for review.",
  RETRY_NOT_ALLOWED: "Unable to retry (three attempts reached or status changed).",
  CANCEL_NOT_ALLOWED: "This job has already finished or stopped.",
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
        ? "Your session has expired. Please sign in again."
        : (messages[data.error] ?? "Unable to complete this action. Please try again."),
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
  queued: "Waiting for processor",
  running: "Processing",
  succeeded: "Ready",
  failed: "Retry needed",
  canceled: "Canceled",
};
export const kindLabel: Record<string, string> = {
  avatar: "Avatar",
  garment: "3D garment",
  fitting: "Fitted garment",
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
