/** Owner-scoped registry rows only; a paused worker is different from a lost connection. */
export type AnalysisWorker = {
  capabilities: Record<string, unknown> | null;
  allowed_capabilities: string[] | null;
  enabled: boolean;
  last_seen: string | null;
  gpu_busy: boolean | null;
};

export function analysisWorkerAvailability(rows: AnalysisWorker[], now = Date.now()) {
  const granted = rows.filter((w) => (w.allowed_capabilities ?? []).includes("garment.analyze"));
  const active = granted.filter((w) => w.enabled);
  const online = active.filter((w) =>
    !!w.capabilities && "garment.analyze" in w.capabilities &&
    w.last_seen !== null && Date.parse(w.last_seen) >= now - 90_000,
  );
  return {
    workerOnline: online.length > 0,
    workerPaused: granted.length > 0 && active.length === 0,
    gpuBusy: online.length > 0 && online.every((w) => w.gpu_busy === true),
  };
}
