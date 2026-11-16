import { test } from "node:test";
import assert from "node:assert/strict";
import { analysisWorkerAvailability, type AnalysisWorker } from "../src/lib/v2/analysis-worker-status";

const now = Date.parse("2026-11-16T10:00:00Z");
const worker: AnalysisWorker = {
  capabilities: { "garment.analyze": { model: "qwen", revision: "pinned" } },
  allowed_capabilities: ["garment.analyze"], enabled: true,
  last_seen: new Date(now - 10_000).toISOString(), gpu_busy: false,
};

test("a disabled AI worker is paused even if its last heartbeat is old", () => {
  assert.deepEqual(analysisWorkerAvailability([{ ...worker, enabled: false, last_seen: "2026-11-14T00:00:00Z" }], now), {
    workerOnline: false, workerPaused: true, gpuBusy: false,
  });
});

test("an enabled worker needs a fresh heartbeat and declared capability", () => {
  assert.deepEqual(analysisWorkerAvailability([{ ...worker, last_seen: new Date(now - 90_001).toISOString() }], now), {
    workerOnline: false, workerPaused: false, gpuBusy: false,
  });
  assert.equal(analysisWorkerAvailability([{ ...worker, capabilities: {} }], now).workerOnline, false);
  assert.deepEqual(analysisWorkerAvailability([worker], now), { workerOnline: true, workerPaused: false, gpuBusy: false });
});

test("GPU busy only describes online granted workers; unrelated grants do not imply pause", () => {
  assert.deepEqual(analysisWorkerAvailability([{ ...worker, enabled: false, allowed_capabilities: ["avatar.reconstruct"] }], now), {
    workerOnline: false, workerPaused: false, gpuBusy: false,
  });
  assert.equal(analysisWorkerAvailability([{ ...worker, gpu_busy: true }], now).gpuBusy, true);
  assert.equal(analysisWorkerAvailability([{ ...worker, gpu_busy: true }, worker], now).gpuBusy, false);
});
