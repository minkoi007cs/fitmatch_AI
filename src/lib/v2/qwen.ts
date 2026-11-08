/**
 * QINT-C — machine-readable contract `fitmatch.qwen-garment-analysis.v1` (PROPOSAL until PC Qwen,
 * PC 3D and Codex ACK it; exported to schemas/qwen-v1/*.json by scripts/export-contract.mjs).
 *
 * One job kind, `garment.analyze`, runs through the existing V2 control plane (worker auth, grants,
 * durable queue, lease/fencing, private storage). The adapter reads ONE immutable image snapshot and
 * returns a bounded JSON proposal; it never produces a GLB and never approves anything. Only an
 * authenticated human confirmation can write wardrobe metadata.
 *
 * Derived from the PC proposals review-envelope.v2 / human-confirmation.v1 (PR7, quality03): same
 * attribute vocabulary minus fields the model cannot ground (material, pockets); OCR stays a separate
 * unverified candidate list. Differences are listed in docs/qwen-contract-v1.md.
 */
import { z } from "zod";

export const ANALYSIS_KIND = "garment.analyze" as const;
export const ANALYSIS_CONTRACT = "fitmatch.qwen-garment-analysis.v1" as const;
export const RESULT_VERSION = "fitmatch.garment-analysis.result.v1" as const;
export const POLICY_REVISION = "qint.1" as const;

/** Bounds shared by server, worker and adapter. Reused from PC quality03 where they fit. */
export const analysisLimits = {
  maxResultBytes: 8192,
  maxOutputTokens: 192,
  maxSchemaAttempts: 2,
  maxImageBytes: 10 * 1024 * 1024,
  timeoutSeconds: 120,
  /** GPU_BUSY / MEMORY_PRESSURE deferrals that do not consume an inference attempt. */
  maxDeferrals: 5,
  maxAttempts: 3,
} as const;

/** Failure codes the adapter may report (exit code + last stderr line {"success":false,"code":...}). */
export const analysisFailureCodes = {
  retryable: ["GPU_BUSY", "MEMORY_PRESSURE"],
  terminal: ["OOM", "TIMEOUT", "INVALID_OUTPUT", "INVALID_INPUT", "MODEL_UNAVAILABLE", "INFERENCE_FAILED"],
} as const;
export const analysisExitCodes = { 78: "MODEL_UNAVAILABLE", 2: "INVALID_INPUT", 75: "GPU_BUSY", 74: "MEMORY_PRESSURE", 70: "INVALID_OUTPUT", 71: "OOM" } as const;

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const shortText = z.string().min(1).max(200);

export const garmentCategory = z.enum(["tshirt", "jeans", "unknown"]);
export const garmentColor = z.enum(["blue", "white", "black", "gray", "red", "green", "yellow", "brown", "other", "unknown"]);
export const garmentPattern = z.enum(["striped", "solid", "printed", "checked", "other", "unknown"]);
export const logoPresence = z.enum(["visible", "not_visible", "unknown"]);
export const neckline = z.enum(["crew", "v_neck", "other", "not_applicable", "unknown"]);
export const sleeves = z.enum(["short", "long", "sleeveless", "not_applicable", "unknown"]);
const logoText = z.string().min(1).max(32);
const unique = <T>(values: T[]) => new Set(values).size === values.length;

/** Identity the server binds at enqueue; the worker echoes it, the adapter copies it unchanged. */
export const analysisBinding = z
  .object({
    jobId: uuid,
    analysisId: uuid,
    itemId: uuid,
    imageAssetId: uuid,
    imageSha256: sha256,
  })
  .strict();

export const modelRevision = z.object({ model: shortText, revision: shortText }).strict();

export const analysisAttributes = z
  .object({
    category: garmentCategory,
    dominantColors: z.array(garmentColor).min(1).max(3).refine(unique, "colors must be unique"),
    pattern: garmentPattern,
    logoPresence,
    neckline,
    sleeves,
  })
  .strict();

export const analysisResult = z
  .object({
    contractVersion: z.literal(RESULT_VERSION),
    binding: analysisBinding,
    modelRevision,
    policyRevision: z.literal(POLICY_REVISION),
    rawOutputSha256: sha256,
    outcome: z.enum(["proposal", "abstained"]),
    abstainReason: z.enum(["ambiguous_target", "unreadable_image", "not_garment", "unsupported_category"]).nullable(),
    attributes: analysisAttributes.nullable(),
    /** Unverified text the model believes it read. Never applied; a human may type approved text. */
    candidateLogoTexts: z.array(logoText).max(4).refine(unique, "texts must be unique"),
    ocrStatus: z.enum(["unverified", "not_extracted"]),
    approvedForAutoApply: z.literal(false),
    evidence: z
      .object({
        attempts: z.number().int().min(1).max(analysisLimits.maxSchemaAttempts),
        outputTokens: z.number().int().min(0).max(analysisLimits.maxOutputTokens),
        durationMs: z.number().int().min(0).max(600_000),
        gpuMiB: z
          .object({
            baseline: z.number().int().min(0).max(1_048_576),
            peak: z.number().int().min(0).max(1_048_576),
            after: z.number().int().min(0).max(1_048_576),
          })
          .strict()
          .nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((r, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (r.outcome === "proposal" && (r.attributes === null || r.abstainReason !== null))
      fail("proposal needs attributes and no abstainReason");
    if (r.outcome === "abstained" && (r.attributes !== null || r.abstainReason === null || r.candidateLogoTexts.length))
      fail("abstained result carries a reason and nothing else");
    if (r.candidateLogoTexts.length && r.attributes?.logoPresence !== "visible")
      fail("logo text candidates require logoPresence=visible");
    if ((r.ocrStatus === "unverified") !== r.candidateLogoTexts.length > 0)
      fail("ocrStatus is unverified exactly when candidates exist");
  });
export type AnalysisResult = z.infer<typeof analysisResult>;

/** Worker -> server. The exact adapter bytes are sent so the server stores what was produced. */
export const analysisResultRequest = z
  .object({
    leaseToken: uuid,
    sha256,
    resultJson: z.string().min(2).max(analysisLimits.maxResultBytes),
  })
  .strict();

/** input.json the worker writes for the adapter (assets are local, already hash-verified). */
export const analysisAdapterInput = z
  .object({
    protocolVersion: z.literal(1),
    protocolRevision: z.string().min(1).max(20),
    contract: z.literal(ANALYSIS_CONTRACT),
    jobId: uuid,
    kind: z.literal(ANALYSIS_KIND),
    binding: analysisBinding,
    modelRevision,
    policy: z
      .object({
        policyRevision: z.literal(POLICY_REVISION),
        maxOutputTokens: z.literal(analysisLimits.maxOutputTokens),
        maxSchemaAttempts: z.literal(analysisLimits.maxSchemaAttempts),
        maxResultBytes: z.literal(analysisLimits.maxResultBytes),
        timeoutSeconds: z.number().int().min(1).max(600),
        imageIsUntrustedData: z.literal(true),
      })
      .strict(),
    assets: z
      .array(
        z
          .object({
            role: z.literal("garment_image"),
            assetId: uuid,
            localPath: z.string().min(1).max(1024),
            sha256,
            bytes: z.number().int().min(1).max(analysisLimits.maxImageBytes),
            mediaType: z.literal("image/jpeg"),
          })
          .strict(),
      )
      .length(1),
    resultSchema: z.literal(RESULT_VERSION),
    outputPath: z.string().min(1).max(1024),
  })
  .strict();

/** Last stderr line on failure (same envelope as the v1-r2 adapter contract). */
export const analysisAdapterError = z
  .object({
    success: z.literal(false),
    code: z.enum([...analysisFailureCodes.retryable, ...analysisFailureCodes.terminal]),
  })
  .strict();

/** Browser -> server. Only fields the user explicitly reviewed are written; unknown never is. */
export const analysisConfirmRequest = z
  .object({
    confirmationId: uuid,
    expectedResultSha256: sha256,
    decision: z.enum(["approve", "reject"]),
    fields: z
      .object({
        category: z.enum(["tshirt", "jeans"]).optional(),
        primaryColor: garmentColor.exclude(["unknown"]).optional(),
        secondaryColor: garmentColor.exclude(["unknown"]).nullable().optional(),
        pattern: garmentPattern.exclude(["unknown"]).optional(),
        /** Typed or explicitly accepted by the user; never copied automatically from candidates. */
        logoText: logoText.nullable().optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((r, ctx) => {
    const count = Object.keys(r.fields).length;
    if (r.decision === "approve" && count === 0) ctx.addIssue({ code: "custom", message: "approve at least one field" });
    if (r.decision === "reject" && count > 0) ctx.addIssue({ code: "custom", message: "reject carries no fields" });
  });

export const analysisRequest = z.object({ itemId: uuid }).strict();

/** Capabilities a heartbeat may store: with the flag OFF garment.analyze is dropped, so claim_r1 can never
 * hand an analysis job to any worker, whatever its grants. */
export function storableCapabilities<T>(declared: Record<string, T>, enabled: boolean): Record<string, T> {
  const out = { ...declared };
  if (!enabled) delete out[ANALYSIS_KIND];
  return out;
}

/** Mapping of approved values onto existing wardrobe columns (only on human confirmation). */
export const wardrobeMapping = {
  category: { tshirt: "t-shirt", jeans: "jeans" },
  pattern: { solid: "plain", striped: "striped", printed: "graphic", checked: "plaid", other: "other" },
} as const;

/** Canonical bytes used for digests (sorted keys, no whitespace). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonicalJson((value as Record<string, unknown>)[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}

export const qwenSchemas = {
  "analysis-adapter-input": analysisAdapterInput,
  "analysis-result": analysisResult,
  "analysis-result-request": analysisResultRequest,
  "analysis-adapter-error": analysisAdapterError,
  "analysis-confirm-request": analysisConfirmRequest,
  "analysis-request": analysisRequest,
} as const;

/**
 * zod refinements are not representable in JSON Schema, so the cross-field rules of the result are
 * added here explicitly; a Draft 2020-12 validator on the PC then enforces the same rules as the server.
 */
function withResultRules(schema: Record<string, unknown>) {
  const props = schema.properties as Record<string, Record<string, unknown>>;
  props.candidateLogoTexts.uniqueItems = true;
  const attrs = (props.attributes.anyOf as Record<string, unknown>[]).find((a) => a.type === "object") as {
    properties: Record<string, Record<string, unknown>>;
  };
  attrs.properties.dominantColors.uniqueItems = true;
  schema.allOf = [
    {
      if: { properties: { outcome: { const: "proposal" } } },
      then: { properties: { attributes: { type: "object" }, abstainReason: { type: "null" } } },
    },
    {
      if: { properties: { outcome: { const: "abstained" } } },
      then: { properties: { attributes: { type: "null" }, abstainReason: { type: "string" }, candidateLogoTexts: { maxItems: 0 } } },
    },
    {
      if: { properties: { candidateLogoTexts: { minItems: 1 } } },
      then: { properties: { attributes: { type: "object", properties: { logoPresence: { const: "visible" } } } } },
    },
    {
      if: { properties: { ocrStatus: { const: "unverified" } } },
      then: { properties: { candidateLogoTexts: { minItems: 1 } } },
      else: { properties: { candidateLogoTexts: { maxItems: 0 } } },
    },
  ];
  return schema;
}

export function qwenJsonSchemas() {
  return Object.fromEntries(
    Object.entries(qwenSchemas).map(([name, schema]) => {
      const json = { $id: `https://fitmatch.local/schemas/qwen-v1/${name}.json`, ...z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) } as Record<string, unknown>;
      return [name, name === "analysis-result" ? withResultRules(json) : json];
    }),
  );
}
