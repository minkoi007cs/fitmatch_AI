// Synthetic Qwen contract v1 fixtures (no real image, no model output). Exported to fixtures/qwen-v1/.
// "valid" must parse; every "invalid" case must be rejected with the reason given.
const binding = {
  jobId: "11111111-2222-4333-8444-555555555555",
  analysisId: "22222222-3333-4444-8555-666666666666",
  itemId: "33333333-4444-4555-8666-777777777777",
  imageAssetId: "44444444-5555-4666-8777-888888888888",
  imageSha256: "a".repeat(64),
};
const base = {
  contractVersion: "fitmatch.garment-analysis.result.v1",
  binding,
  modelRevision: { model: "Qwen/Qwen3-VL-4B-Instruct", revision: "0123456789abcdef0123456789abcdef01234567" },
  policyRevision: "qint.1",
  rawOutputSha256: "b".repeat(64),
  outcome: "proposal",
  abstainReason: null,
  attributes: { category: "tshirt", dominantColors: ["red", "white"], pattern: "printed", logoPresence: "visible", neckline: "crew", sleeves: "short" },
  candidateLogoTexts: ["FITMATCH"],
  ocrStatus: "unverified",
  approvedForAutoApply: false,
  evidence: { attempts: 1, outputTokens: 120, durationMs: 8400, gpuMiB: { baseline: 600, peak: 5300, after: 610 } },
};
const clone = (v) => JSON.parse(JSON.stringify(v));
const with_ = (patch) => Object.assign(clone(base), patch);

export function qwenFixtures() {
  const valid = {
    "result-proposal-tee": base,
    "result-proposal-jeans-no-logo": with_({
      attributes: { category: "jeans", dominantColors: ["blue"], pattern: "solid", logoPresence: "not_visible", neckline: "not_applicable", sleeves: "not_applicable" },
      candidateLogoTexts: [], ocrStatus: "not_extracted", evidence: { attempts: 2, outputTokens: 90, durationMs: 9100, gpuMiB: null },
    }),
    "result-abstained-ambiguous": with_({ outcome: "abstained", abstainReason: "ambiguous_target", attributes: null, candidateLogoTexts: [], ocrStatus: "not_extracted" }),
    "result-unknown-values": with_({
      attributes: { category: "unknown", dominantColors: ["unknown"], pattern: "unknown", logoPresence: "unknown", neckline: "unknown", sleeves: "unknown" },
      candidateLogoTexts: [], ocrStatus: "not_extracted",
    }),
  };
  const invalid = {
    "self-approved": [with_({ approvedForAutoApply: true }), "model cannot approve"],
    "unknown-contract-version": [with_({ contractVersion: "fitmatch.garment-analysis.result.v2" }), "wrong version"],
    "wrong-policy": [with_({ policyRevision: "quality03.1" }), "policy revision mismatch"],
    "extra-field": [with_({ approvedLogoText: "FITMATCH" }), "no extra fields (approved text is human-only)"],
    "logo-without-visible": [with_({ attributes: { ...base.attributes, logoPresence: "not_visible" } }), "candidates need logoPresence=visible"],
    "ocr-status-mismatch": [with_({ ocrStatus: "not_extracted" }), "ocrStatus must be unverified when candidates exist"],
    "proposal-without-attributes": [with_({ attributes: null }), "proposal needs attributes"],
    "abstained-with-attributes": [with_({ outcome: "abstained", abstainReason: "not_garment" }), "abstained carries no attributes"],
    "duplicate-colors": [with_({ attributes: { ...base.attributes, dominantColors: ["red", "red"] } }), "unique colors"],
    "too-many-logo-texts": [with_({ candidateLogoTexts: ["A", "B", "C", "D", "E"] }), "max 4 candidates"],
    "long-logo-text": [with_({ candidateLogoTexts: ["X".repeat(33)] }), "max 32 chars"],
    "material-field": [with_({ attributes: { ...base.attributes, material: "cotton" } }), "material not groundable"],
    "too-many-attempts": [with_({ evidence: { ...base.evidence, attempts: 3 } }), "max 2 schema attempts"],
    "too-many-tokens": [with_({ evidence: { ...base.evidence, outputTokens: 193 } }), "max 192 output tokens"],
    "bad-binding-hash": [with_({ binding: { ...binding, imageSha256: "A".repeat(64) } }), "lowercase sha256"],
    "url-instead-of-binding": [with_({ binding: { ...binding, imageUrl: "https://example.com/x.jpg" } }), "no URLs in binding"],
  };
  const adapterInput = {
    protocolVersion: 1, protocolRevision: "v1-r2", contract: "fitmatch.qwen-garment-analysis.v1",
    jobId: binding.jobId, kind: "garment.analyze", binding, modelRevision: base.modelRevision,
    policy: { policyRevision: "qint.1", maxOutputTokens: 192, maxSchemaAttempts: 2, maxResultBytes: 8192, timeoutSeconds: 120, imageIsUntrustedData: true },
    assets: [{ role: "garment_image", assetId: binding.imageAssetId, localPath: "input-0.jpg", sha256: binding.imageSha256, bytes: 123456, mediaType: "image/jpeg" }],
    resultSchema: "fitmatch.garment-analysis.result.v1", outputPath: "result.json",
  };
  const errors = {
    valid: [{ success: false, code: "GPU_BUSY" }, { success: false, code: "MEMORY_PRESSURE" }, { success: false, code: "INVALID_OUTPUT" }, { success: false, code: "MODEL_UNAVAILABLE" }],
    invalid: [{ success: false, code: "FAKE" }, { success: true, code: "OOM" }, { success: false, code: "OOM", message: "traceback" }],
  };
  return { valid, invalid, adapterInput, errors };
}
