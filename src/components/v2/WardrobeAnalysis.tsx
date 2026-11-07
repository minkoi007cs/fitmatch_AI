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
  blue: "Xanh dương", white: "Trắng", black: "Đen", gray: "Xám", red: "Đỏ", green: "Xanh lá",
  yellow: "Vàng", brown: "Nâu", other: "Màu khác",
};
const patternNames: Record<string, string> = { solid: "Trơn", striped: "Kẻ sọc", printed: "In hình", checked: "Caro", other: "Khác" };
const categoryNames: Record<string, string> = { tshirt: "Áo thun", jeans: "Quần jeans" };
const abstainNames: Record<string, string> = {
  ambiguous_target: "Ảnh có nhiều món đồ, AI không chắc món nào cần phân tích.",
  unreadable_image: "Ảnh quá mờ hoặc tối để phân tích.",
  not_garment: "AI không thấy quần áo trong ảnh.",
  unsupported_category: "Loại đồ này chưa được hỗ trợ (hiện chỉ áo thun và jeans).",
};
const failureNames: Record<string, string> = {
  GPU_UNAVAILABLE: "PC bận GPU quá lâu. Hãy thử lại sau.",
  OOM: "PC thiếu bộ nhớ khi chạy AI.",
  TIMEOUT: "AI chạy quá thời gian cho phép.",
  INVALID_OUTPUT: "AI trả kết quả không hợp lệ.",
  MODEL_UNAVAILABLE: "Mô hình AI trên PC chưa sẵn sàng.",
  LEASE_EXPIRED: "PC mất kết nối giữa chừng.",
  CANCELED: "Bạn đã hủy.",
  SOURCE_CHANGED: "Ảnh đã đổi trong lúc phân tích.",
};

export function useWardrobeAnalyses() {
  const [enabled, setEnabled] = useState(false);
  const [byItem, setByItem] = useState<Record<string, AnalysisView>>({});
  const load = useCallback(async () => {
    try {
      const data = await api<{ enabled: boolean; analyses: AnalysisView[] }>("analyses");
      setEnabled(data.enabled);
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
  return { enabled, byItem, put, reload: load };
}

export function AnalysisPanel({
  itemId,
  itemName,
  hasImage,
  analysis,
  onUpdate,
  onWardrobeChanged,
}: {
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
  const label = `Phân tích AI cho ${itemName}`;

  if (!analysis || analysis.state === "stale")
    return (
      <div className={box} role="group" aria-label={label}>
        {analysis?.state === "stale" && <p>Ảnh đã thay đổi sau lần phân tích trước.</p>}
        <button disabled={busy || !hasImage} className={button} onClick={() => void start()}>
          {hasImage ? "Phân tích với AI" : "Cần ảnh để phân tích"}
        </button>
        {error && <p role="alert" className="text-danger">{error}</p>}
      </div>
    );

  if (ACTIVE.has(analysis.state))
    return (
      <div className={box} role="group" aria-label={label}>
        <p role="status">
          {analysis.state === "queued"
            ? "Đang chờ PC nhận việc…"
            : analysis.state === "waiting_gpu"
              ? "PC đang bận GPU, sẽ tự thử lại."
              : "AI đang phân tích trên PC…"}
        </p>
        <button disabled={busy} className={button} onClick={() => void act("cancel")}>
          Hủy
        </button>
        {error && <p role="alert" className="text-danger">{error}</p>}
      </div>
    );

  if (analysis.state === "failed" || analysis.state === "canceled")
    return (
      <div className={box} role="group" aria-label={label}>
        <p role="status">
          {analysis.state === "canceled" ? "Đã hủy phân tích." : "Phân tích thất bại."}{" "}
          {analysis.errorCode ? failureNames[analysis.errorCode] ?? "" : ""} Bạn vẫn có thể sửa thông tin món đồ thủ công.
        </p>
        {analysis.attempts < 3 && (
          <button disabled={busy} className={button} onClick={() => void act("retry")}>
            Thử lại
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
            ? "Đã bỏ qua đề xuất AI."
            : "Đã lưu theo xác nhận của bạn" +
              (analysis.confirmedFields?.logoText ? ` (chữ trên áo: “${analysis.confirmedFields.logoText}”)` : "") +
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
        <p role="status">AI không đưa ra đề xuất: {abstainNames[analysis.result?.abstainReason ?? ""] ?? "không chắc chắn."}</p>
        <button disabled={busy} className={button} onClick={() => onSubmit("reject", {})}>
          Đóng
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
      <p className="font-semibold text-fg" role="status">Đề xuất của AI — kiểm tra rồi lưu</p>
      <label className="block">
        Loại
        <select aria-label="Loại" className={select} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">— chưa chọn —</option>
          {Object.entries(categoryNames).map(([v, n]) => (
            <option key={v} value={v}>{n}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Màu chính
        <select aria-label="Màu chính" className={select} value={primary} onChange={(e) => setPrimary(e.target.value)}>
          <option value="">— chưa chọn —</option>
          {Object.entries(colorNames).map(([v, n]) => (
            <option key={v} value={v}>{n}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Màu phụ
        <select aria-label="Màu phụ" className={select} value={secondary} onChange={(e) => setSecondary(e.target.value)}>
          <option value="">— không —</option>
          {Object.entries(colorNames).map(([v, n]) => (
            <option key={v} value={v}>{n}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Họa tiết
        <select aria-label="Họa tiết" className={select} value={pattern} onChange={(e) => setPattern(e.target.value)}>
          <option value="">— chưa chọn —</option>
          {Object.entries(patternNames).map(([v, n]) => (
            <option key={v} value={v}>{n}</option>
          ))}
        </select>
      </label>
      {analysis.result!.candidateLogoTexts.length > 0 && (
        <div>
          <p>
            AI đọc được chữ (chưa xác nhận, có thể sai):{" "}
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
        Chữ/logo trên đồ (tùy chọn, bạn tự xác nhận)
        <input
          ref={logoRef}
          aria-label="Chữ/logo trên đồ"
          className={select}
          maxLength={32}
          value={logoText}
          onChange={(e) => setLogoText(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <button disabled={busy || Object.keys(fields).length === 0} className={button} onClick={() => onSubmit("approve", fields)}>
          Lưu vào tủ đồ
        </button>
        <button disabled={busy} className={button} onClick={() => onSubmit("reject", {})}>
          Bỏ qua
        </button>
      </div>
      {error && <p role="alert" className="text-danger">{error}</p>}
    </div>
  );
}
