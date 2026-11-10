"use client";

/**
 * QINT-C wardrobe analysis UI. The AI only proposes; nothing is written to the wardrobe until the
 * owner reviews the values and presses "Lưu vào tủ đồ". Unknown values and unverified logo text are
 * never applied automatically. Hidden entirely while the server-side flag is off.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/v2/client";

type Attributes = {
  category: "tshirt" | "jeans" | "unknown";
  dominantColors: string[];
  pattern: string;
  logoPresence: string;
  neckline: string;
  sleeves: string;
};
export type AnalysisView = {
  id: string;
  itemId: string;
  state: "queued" | "waiting_gpu" | "running" | "review" | "confirmed" | "rejected" | "stale" | "failed" | "canceled";
  errorCode: string | null;
  attempts: number;
  resultSha256: string | null;
  result: {
    outcome: "proposal" | "abstained";
    abstainReason: string | null;
    attributes: Attributes | null;
    candidateLogoTexts: string[];
    ocrStatus: string;
  } | null;
  confirmedFields: Record<string, string | null> | null;
};

const ACTIVE = new Set(["queued", "waiting_gpu", "running"]);
const colorNames: Record<string, string> = {
  blue: "Blue", white: "White", black: "Black", gray: "Gray", red: "Red", green: "Green",
  yellow: "Yellow", brown: "Brown", other: "Other color",
};
const patternNames: Record<string, string> = { solid: "Plain", striped: "Stripes", printed: "Graphic", checked: "Plaid", other: "Other" };
const categoryNames: Record<string, string> = { tshirt: "T-shirt", jeans: "Jeans" };
const abstainNames: Record<string, string> = {
  ambiguous_target: "The image contains several items. AI could not determine which one to analyze.",
  unreadable_image: "The image is too blurry or dark to analyze.",
  not_garment: "AI could not find clothing in this image.",
  unsupported_category: "This category is not supported yet (currently T-shirts and jeans only).",
};
const failureNames: Record<string, string> = {
  GPU_UNAVAILABLE: "The PC's GPU has been busy for too long. Please try again later.",
  OOM: "The PC ran out of memory while running AI.",
  TIMEOUT: "AI exceeded the processing time limit.",
  INVALID_OUTPUT: "AI returned an invalid result.",
  MODEL_UNAVAILABLE: "The AI model on your PC is not ready.",
  LEASE_EXPIRED: "The PC lost its connection during processing.",
  CANCELED: "You canceled this analysis.",
  SOURCE_CHANGED: "The image changed during analysis.",
};

export function useWardrobeAnalyses() {
  const [enabled, setEnabled] = useState(false);
  const [workerOnline, setWorkerOnline] = useState(false);
  const [gpuBusy, setGpuBusy] = useState(false);
  const [byItem, setByItem] = useState<Record<string, AnalysisView>>({});
  const load = useCallback(async () => {
    try {
      const data = await api<{ enabled: boolean; workerOnline: boolean; gpuBusy?: boolean; analyses: AnalysisView[] }>("analyses");
      setEnabled(data.enabled);
      setWorkerOnline(data.workerOnline);
      setGpuBusy(data.gpuBusy === true);
      setByItem(Object.fromEntries(data.analyses.map((a) => [a.itemId, a])));
    } catch {
      setEnabled(false);
    }
  }, []);
  useEffect(() => {
    // Initial fetch only; the polling effect below keeps active analyses fresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const anyActive = useMemo(() => Object.values(byItem).some((a) => ACTIVE.has(a.state)), [byItem]);
  useEffect(() => {
    if (!anyActive) return;
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [anyActive, load]);
  const put = useCallback((a: AnalysisView) => setByItem((m) => ({ ...m, [a.itemId]: a })), []);
  return { enabled, workerOnline, gpuBusy, byItem, put, reload: load };
}

export function AnalysisPanel({
  itemId,
  itemName,
  hasImage,
  analysis,
  workerOnline,
  gpuBusy = false,
  onUpdate,
  onWardrobeChanged,
}: {
  workerOnline: boolean;
  gpuBusy?: boolean;
  itemId: string;
  itemName: string;
  hasImage: boolean;
  analysis: AnalysisView | undefined;
  onUpdate: (a: AnalysisView) => void;
  onWardrobeChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const start = () =>
    run(async () => {
      const r = await api<{ analysis: AnalysisView }>("analyses", { itemId });
      onUpdate(r.analysis);
    });
  const act = (action: "cancel" | "retry") =>
    run(async () => onUpdate((await api<{ analysis: AnalysisView }>(`analyses/${analysis!.id}/${action}`, {})).analysis));

  const box = "mt-2 rounded-[2px] border border-border bg-bg-raised/60 p-2.5 text-[11px] leading-4 text-fg-muted space-y-2";
  const button = "rounded-[2px] border border-border-strong px-2 py-1 text-[11px] text-fg hover:bg-bg-elevated disabled:opacity-50";
  const label = `AI analysis for ${itemName}`;

  if (!analysis || analysis.state === "stale")
    return (
      <div className={box} role="group" aria-label={label}>
        {analysis?.state === "stale" && <p>The image has changed since the previous analysis.</p>}
        <button disabled={busy || !hasImage} className={button} onClick={() => void start()}>
          {hasImage ? "Analyze with AI" : "Add an image to analyze"}
        </button>
        {error && <p role="alert" className="text-danger">{error}</p>}
      </div>
    );

  if (ACTIVE.has(analysis.state))
    return (
      <div className={box} role="group" aria-label={label}>
        <p role="status">
          {analysis.state === "running"
            ? "AI is analyzing on your PC…"
            : !workerOnline
              ? "Your PC is offline. The job is saved and will run when it reconnects. You can still edit item details manually."
              : analysis.state === "queued" && gpuBusy
                ? "Your PC's GPU is busy with another task. Your job remains queued and no attempt has been counted."
                : analysis.state === "queued"
                ? "Waiting for your PC to accept the job…"
                : analysis.errorCode === "MEMORY_PRESSURE"
                  ? "Your PC has limited free memory. It will retry automatically."
                  : "Your PC's GPU is busy. It will retry automatically."}
        </p>
        <button disabled={busy} className={button} onClick={() => void act("cancel")}>
          Cancel
        </button>
        {error && <p role="alert" className="text-danger">{error}</p>}
      </div>
    );

  if (analysis.state === "failed" || analysis.state === "canceled")
    return (
      <div className={box} role="group" aria-label={label}>
        <p role="status">
          {analysis.state === "canceled" ? "Analysis canceled." : "Analysis failed."}{" "}
          {analysis.errorCode ? failureNames[analysis.errorCode] ?? "" : ""} You can still edit item details manually.
        </p>
        {analysis.attempts < 3 && (
          <button disabled={busy} className={button} onClick={() => void act("retry")}>
            Retry
          </button>
        )}
        {error && <p role="alert" className="text-danger">{error}</p>}
      </div>
    );

  if (analysis.state === "confirmed" || analysis.state === "rejected")
    return (
      <div className={box} role="group" aria-label={label}>
        <p role="status">
          {analysis.state === "rejected"
            ? "AI suggestion dismissed."
            : "Saved with your confirmation" +
              (analysis.confirmedFields?.logoText ? ` (garment text: “${analysis.confirmedFields.logoText}”)` : "") +
              "."}
        </p>
      </div>
    );

  return (
    <Review
      analysis={analysis}
      label={label}
      busy={busy}
      error={error}
      box={box}
      button={button}
      onSubmit={(decision, fields) =>
        run(async () => {
          const r = await api<{ analysis: AnalysisView }>(`analyses/${analysis.id}/confirm`, {
            confirmationId: crypto.randomUUID(),
            expectedResultSha256: analysis.resultSha256,
            decision,
            fields,
          });
          onUpdate(r.analysis);
          if (decision === "approve") onWardrobeChanged();
        })
      }
    />
  );
}

function Review({
  analysis,
  label,
  busy,
  error,
  box,
  button,
  onSubmit,
}: {
  analysis: AnalysisView;
  label: string;
  busy: boolean;
  error: string | null;
  box: string;
  button: string;
  onSubmit: (decision: "approve" | "reject", fields: Record<string, string | null>) => void;
}) {
  const attrs = analysis.result?.attributes ?? null;
  const known = (v: string | undefined) => (v && v !== "unknown" ? v : "");
  // Start from the proposal, but "unknown" stays empty: the user must choose, nothing is guessed.
  const [category, setCategory] = useState(known(attrs?.category));
  const [primary, setPrimary] = useState(known(attrs?.dominantColors[0]));
  const [secondary, setSecondary] = useState(known(attrs?.dominantColors[1]));
  const [pattern, setPattern] = useState(known(attrs?.pattern));
  const [logoText, setLogoText] = useState("");
  const logoRef = useRef<HTMLInputElement>(null);
  const select = "w-full rounded-[2px] border border-border bg-bg px-1.5 py-1 text-[11px] text-fg";

  if (!attrs || analysis.result?.outcome === "abstained")
    return (
      <div className={box} role="group" aria-label={label}>
        <p role="status">AI has no suggestion: {abstainNames[analysis.result?.abstainReason ?? ""] ?? "uncertain."}</p>
        <button disabled={busy} className={button} onClick={() => onSubmit("reject", {})}>
          Close
        </button>
        {error && <p role="alert" className="text-danger">{error}</p>}
      </div>
    );

  const fields: Record<string, string | null> = {};
  if (category) fields.category = category;
  if (primary) fields.primaryColor = primary;
  if (secondary) fields.secondaryColor = secondary;
  if (pattern) fields.pattern = pattern;
  if (logoText.trim()) fields.logoText = logoText.trim();

  return (
    <div className={box} role="group" aria-label={label}>
      <p className="font-semibold text-fg" role="status">AI suggestion — review before saving</p>
      <label className="block">
        Category
        <select aria-label="Category" className={select} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">— choose —</option>
          {Object.entries(categoryNames).map(([v, n]) => (
            <option key={v} value={v}>{n}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Main color
        <select aria-label="Main color" className={select} value={primary} onChange={(e) => setPrimary(e.target.value)}>
          <option value="">— choose —</option>
          {Object.entries(colorNames).map(([v, n]) => (
            <option key={v} value={v}>{n}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Secondary color
        <select aria-label="Secondary color" className={select} value={secondary} onChange={(e) => setSecondary(e.target.value)}>
          <option value="">— none —</option>
          {Object.entries(colorNames).map(([v, n]) => (
            <option key={v} value={v}>{n}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Pattern
        <select aria-label="Patterns" className={select} value={pattern} onChange={(e) => setPattern(e.target.value)}>
          <option value="">— choose —</option>
          {Object.entries(patternNames).map(([v, n]) => (
            <option key={v} value={v}>{n}</option>
          ))}
        </select>
      </label>
      {analysis.result!.candidateLogoTexts.length > 0 && (
        <div>
          <p>
            AI detected this text (unconfirmed and may be incorrect):{" "}
            {analysis.result!.candidateLogoTexts.map((t) => (
              <button
                key={t}
                type="button"
                className="mr-1 underline"
                onClick={() => {
                  setLogoText(t);
                  logoRef.current?.focus();
                }}
              >
                “{t}”
              </button>
            ))}
          </p>
        </div>
      )}
      <label className="block">
        Garment text / logo (optional, confirmed by you)
        <input
          ref={logoRef}
          aria-label="Garment text / logo"
          className={select}
          maxLength={32}
          value={logoText}
          onChange={(e) => setLogoText(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <button disabled={busy || Object.keys(fields).length === 0} className={button} onClick={() => onSubmit("approve", fields)}>
          Save to wardrobe
        </button>
        <button disabled={busy} className={button} onClick={() => onSubmit("reject", {})}>
          Dismiss
        </button>
      </div>
      {error && <p role="alert" className="text-danger">{error}</p>}
    </div>
  );
}
