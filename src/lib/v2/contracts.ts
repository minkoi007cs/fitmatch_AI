import { z } from "zod";
export const id = z.string().uuid();
const name = z.string().trim().min(1).max(80);
/** Optional body measurements in cm/kg (U02). Used by the adapter only if its engine supports them. */
export const measurements = z
  .object({
    chestCm: z.number().min(50).max(180),
    waistCm: z.number().min(40).max(180),
    hipCm: z.number().min(50).max(180),
    shoulderCm: z.number().min(25).max(70),
    inseamCm: z.number().min(40).max(110),
    weightKg: z.number().min(25).max(250),
  })
  .partial()
  .strict()
  .refine((m) => Object.keys(m).length > 0, "empty measurements");
export type Measurements = z.infer<typeof measurements>;
const unique = (v: string[]) => new Set(v).size === v.length;
export const avatarRequest = z
  .object({
    kind: z.literal("avatar"),
    name,
    /** front, side, back (in that order); may be empty when a video is given */
    inputAssetIds: z.array(id).max(3),
    heightCm: z.number().min(100).max(230),
    videoAssetId: id.optional(),
    faceAssetIds: z.array(id).max(2).optional(),
    measurements: measurements.optional(),
  })
  .strict()
  .refine(
    (v) =>
      unique([...v.inputAssetIds, ...(v.faceAssetIds ?? []), ...(v.videoAssetId ? [v.videoAssetId] : [])]) &&
      (v.inputAssetIds.length === 3 || (!!v.videoAssetId && (v.faceAssetIds?.length ?? 0) + v.inputAssetIds.length >= 1)),
    "need front/side/back photos, or a video plus at least one face/body photo",
  );
export const modelRequest = z.union([
  avatarRequest,
  z
    .object({
      kind: z.literal("garment"),
      name,
      inputAssetIds: z
        .array(id)
        .min(2)
        .max(3)
        .refine((v) => new Set(v).size === v.length),
      wardrobeItemId: id,
    })
    .strict(),
  z
    .object({ kind: z.literal("fitting"), name, avatarId: id, garmentId: id })
    .strict(),
]);
/** Roles of avatar inputs in params.roles, aligned with input_assets. */
export function avatarRoles(body: z.infer<typeof avatarRequest>) {
  const photos = ["front", "side", "back"].slice(0, body.inputAssetIds.length);
  return {
    inputs: [...body.inputAssetIds, ...(body.faceAssetIds ?? []), ...(body.videoAssetId ? [body.videoAssetId] : [])],
    roles: [...photos, ...(body.faceAssetIds ?? []).map(() => "face"), ...(body.videoAssetId ? ["video"] : [])],
  };
}
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
export const retentionRequest = z.object({ action: z.enum(["keep", "delete"]) }).strict();
/**
 * Typed avatar edit intent (U05/U06). Published so the PC side can implement an engine for it.
 * No engine in protocol v1-r2 supports edits yet; the app shows edit controls as unavailable.
 */
export const avatarEditIntent = z
  .object({
    avatarId: id,
    target: z.enum(["face", "body", "hair", "skin"]),
    parameter: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/),
    /** normalized -1..1 around the current value */
    value: z.number().min(-1).max(1),
    /** the user's own words, if the edit came from text */
    text: z.string().trim().max(300).optional(),
  })
  .strict();
export const uploadRequest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("photo"), bytes: z.number().int().min(1).max(12 * 1024 * 1024) }).strict(),
  z
    .object({
      kind: z.literal("video"),
      bytes: z.number().int().min(1).max(150 * 1024 * 1024),
      contentType: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
    })
    .strict(),
]);
export const leaseRequest = z.object({ leaseToken: id }).strict();
export const outputRequest = z
  .object({
    leaseToken: id,
    bytes: z
      .number()
      .int()
      .min(20)
      .max(40 * 1024 * 1024),
  })
  .strict();
/** Without sha256 the legacy (non-idempotent) intent is used; R1 workers always send it. */
export const outputIntentRequest = z
  .object({
    leaseToken: id,
    bytes: z
      .number()
      .int()
      .min(20)
      .max(40 * 1024 * 1024),
    sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  })
  .strict();
export const completeRequest = z
  .object({ leaseToken: id, assetId: id })
  .strict();
/** Claim identity: instanceId is random per worker process start; requestId per claim call. */
export const claimRequest = z
  .object({ instanceId: id.optional(), requestId: id.optional() })
  .strict();
/** Tops keep the v1 kinds; bottoms (jeans) have their own kinds so a top-only adapter never receives them. */
export const workerKinds = [
  "avatar.reconstruct",
  "garment.reconstruct",
  "garment.drape",
  "bottom.reconstruct",
  "bottom.drape",
] as const;
export type WorkerKind = (typeof workerKinds)[number];
/** v1-r2 = v1-r1 + slot/category in the job input and the bottom.* kinds (additive). */
export const protocolRevision = "v1-r2";
export const slots = ["top", "bottom"] as const;
export type Slot = (typeof slots)[number];
/** Wardrobe categories that can become 3D garments, and the slot each one fills. */
export const slotForCategory: Record<string, Slot> = {
  "t-shirt": "top",
  shirt: "top",
  jeans: "bottom",
};
export const cameraState = z
  .object({
    position: z.tuple([z.number(), z.number(), z.number()]),
    target: z.tuple([z.number(), z.number(), z.number()]),
    autoOrbit: z.boolean(),
  })
  .strict()
  .refine((c) => [...c.position, ...c.target].every((v) => Math.abs(v) <= 50), "camera out of range");
export type CameraState = z.infer<typeof cameraState>;
export const lookRequest = z
  .object({
    name: z.string().trim().min(1).max(80),
    avatarId: id,
    /** Legacy single-garment save (treated as the top slot). */
    fittingId: id.nullable().optional(),
    topFittingId: id.nullable().optional(),
    bottomFittingId: id.nullable().optional(),
    camera: cameraState.optional(),
    recommendationId: id.nullable().optional(),
  })
  .strict()
  .refine((v) => !(v.fittingId && v.topFittingId && v.fittingId !== v.topFittingId), "fittingId conflicts with topFittingId");
export const workerHeartbeat = z
  .object({
    capabilities: z.partialRecord(
      z.enum(workerKinds),
      z.object({ model: name, revision: z.string().min(1).max(160) }).strict(),
    ),
  })
  .strict();
export const progressRequest = z
  .object({
    leaseToken: id,
    stage: z.enum([
      "starting",
      "preprocessing",
      "reconstructing",
      "texturing",
      "draping",
      "exporting",
      "uploading",
    ]),
  })
  .strict();
export const failureRequest = z
  .object({
    leaseToken: id,
    code: z.enum([
      "OOM",
      "INVALID_INPUT",
      "MODEL_UNAVAILABLE",
      "INFERENCE_FAILED",
      "EXPORT_FAILED",
      "TIMEOUT",
    ]),
  })
  .strict();
export const styleAnswers = z
  .object({
    occasion: z.enum(["daily", "campus", "work", "evening"]),
    style: z.enum(["minimal", "casual", "streetwear", "formal"]),
    fit: z.enum(["regular", "relaxed", "oversized"]),
    favoriteColors: z
      .array(
        z.enum([
          "black",
          "white",
          "cream",
          "blue",
          "navy",
          "brown",
          "gray",
          "olive",
          "red",
          "pink",
        ]),
      )
      .min(1)
      .max(5),
    avoidPatterns: z
      .array(z.enum(["graphic", "striped", "plaid", "floral"]))
      .max(4),
    climate: z.enum(["warm", "mild", "cool"]),
  })
  .strict();
export type StyleAnswers = z.infer<typeof styleAnswers>;
export type ModelRow = {
  superseded_by?: string | null;
  id: string;
  user_id: string;
  kind: "avatar" | "garment" | "fitting";
  name: string;
  slot?: Slot | null;
  accepted_at?: string | null;
  source_retention?: "keep" | "deleted" | null;
  wardrobe_item_id: string | null;
  avatar_id: string | null;
  garment_id: string | null;
  input_assets: string[];
  params: Record<string, unknown>;
  output_asset_id: string | null;
  created_at: string;
};
export type JobRow = {
  id: string;
  user_id: string;
  model_id: string;
  kind: string;
  state: string;
  worker_id: string | null;
  lease_token: string | null;
  lease_until: string | null;
  attempt: number;
  error_code: string | null;
  stage: string | null;
  engine?: { model: string; revision: string } | null;
  redelivered?: boolean;
  created_at: string;
  updated_at: string;
};
export type AssetRow = {
  id: string;
  user_id: string;
  kind: "photo" | "glb" | "video";
  state: string;
  source_path: string;
  path: string;
  expected_bytes: number;
  bytes: number | null;
  sha256: string | null;
  job_id: string | null;
  expected_sha256?: string | null;
  job_attempt?: number | null;
};
export type WorkerRow = {
  id: string;
  user_id: string;
  capabilities: Record<string, { model: string; revision: string }>;
  allowed_capabilities: string[];
  enabled: boolean;
  last_seen: string | null;
};
