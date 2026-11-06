/**
 * Machine-readable contract for protocol v1-r2 (exported to schemas/v1-r2/*.json by
 * scripts/export-schemas.mjs). The PC side validates its adapter output and job handling against
 * these files; the app validates requests with the same zod objects.
 */
import { z } from "zod";
import {
  id,
  modelRequest,
  lookRequest,
  cameraState,
  workerHeartbeat,
  claimRequest,
  outputIntentRequest,
  completeRequest,
  progressRequest,
  failureRequest,
  workerKinds,
  slots,
} from "./contracts";

const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const vec3 = z.tuple([z.number(), z.number(), z.number()]);
export const sharedFrame = z
  .object({
    units: z.literal("meters"),
    up: z.literal("+Y"),
    front: z.literal("+Z"),
    origin: z.literal("floor-between-feet"),
    pose: z.literal("a-pose-v1"),
  })
  .strict();

/** Claim response body (200). 204 means no job. */
export const jobEnvelope = z
  .object({
    protocolVersion: z.literal(1),
    protocolRevision: z.string(),
    redelivered: z.boolean(),
    jobId: id,
    kind: z.enum(workerKinds),
    modelId: id,
    modelRevision: z.object({ model: z.string(), revision: z.string() }).nullable(),
    lease: z.object({ token: id, expiresAt: z.string(), attempt: z.number().int().min(1) }),
    input: z.object({
      params: z.record(z.string(), z.unknown()),
      avatarVersionId: id.nullable(),
      garmentVersionId: id.nullable(),
      /** null only for avatar jobs */
      slot: z.enum(slots).nullable(),
      /** wardrobe category: t-shirt | shirt (top), jeans (bottom) */
      category: z.string().nullable(),
      assets: z.array(
        z.object({
          assetId: id,
          role: z.enum(["front", "side", "back", "detail", "body", "garment"]),
          url: z.string(),
          sha256: sha256.nullable(),
          bytes: z.number().int().nullable(),
        }),
      ),
    }),
    outputContract: z.object({
      format: z.literal("glb-v2"),
      units: z.literal("meters"),
      up: z.literal("+Y"),
      front: z.literal("+Z"),
      embeddedTextures: z.literal(true),
      content: z.enum([
        "avatar",
        "top-canonical",
        "bottom-canonical",
        "top-only-aligned-to-avatar",
        "bottom-only-aligned-to-avatar",
      ]),
      maxFileBytes: z.number().int(),
      sharedFrame: sharedFrame.extend({ note: z.string() }),
    }),
  })
  .strict();

/** Manifest that travels with a body/top/bottom asset set (fixture now, PC export later). */
export const assetManifest = z
  .object({
    schema: z.literal("fitmatch.full-look-fixture/v1"),
    protocolRevision: z.string(),
    provenance: z.string().min(10),
    frame: sharedFrame,
    animation_ready: z.literal(false),
    assets: z
      .object(
        Object.fromEntries(
          ["body", "top", "bottom"].map((k) => [
            k,
            z
              .object({
                file: z.string().regex(/^[a-z]+\.glb$/),
                role: z.enum(["avatar", "top", "bottom"]),
                bytes: z.number().int().min(20).max(41943040),
                sha256,
                bounds: z.object({ min: vec3, max: vec3 }),
              })
              .strict(),
          ]),
        ),
      )
      .strict(),
  })
  .strict();

export const exportedSchemas = {
  "model-request": modelRequest,
  "look-request": lookRequest,
  "camera-state": cameraState,
  "worker-heartbeat": workerHeartbeat,
  "worker-claim-request": claimRequest,
  "worker-job-envelope": jobEnvelope,
  "worker-output-intent": outputIntentRequest,
  "worker-complete": completeRequest,
  "worker-progress": progressRequest,
  "worker-failure": failureRequest,
  "asset-manifest": assetManifest,
} as const;

export function jsonSchemas() {
  return Object.fromEntries(
    Object.entries(exportedSchemas).map(([name, schema]) => [
      name,
      { $id: `https://fitmatch.local/schemas/v1-r2/${name}.json`, ...z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) },
    ]),
  );
}
