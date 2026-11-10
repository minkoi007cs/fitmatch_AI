"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Shirt, RefreshCw, ArrowUpRight } from "lucide-react";
import CloudCapture from "@/components/v2/CloudCapture";
import AvatarDraft from "@/components/v2/AvatarDraft";
import {
  WorkspaceNav,
  panel,
  button,
  field,
} from "@/components/v2/WorkspaceNav";
import {
  api,
  library,
  stateLabel,
  kindLabel,
  type Library,
} from "@/lib/v2/client";
import type { WardrobeItem } from "@/lib/types";
export default function PreparePage() {
  const [data, setData] = useState<Library | null>(null),
    [items, setItems] = useState<WardrobeItem[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [capture, setCapture] = useState<"avatar" | "garment" | null>(null);
  const lock = useRef(false),
    alive = useRef(true);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    try {
      const d = await library();
      if (alive.current) {
        setData(d);
        setError("");
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      lock.current = false;
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Starts remote polling; state updates occur after network resolution.
    void refresh();
    void fetch("/api/wardrobe", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Unable to load your wardrobe.");
        const d = await r.json();
        if (alive.current)
          setItems(
            d.items.filter((i: WardrobeItem) =>
              ["shirt", "t-shirt", "jeans"].includes(i.category),
            ),
          );
      })
      .catch((e) => {
        if (alive.current) setError(e.message);
      });
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 8000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  async function action(jobId: string, command: "retry" | "cancel" | "regenerate") {
    setBusy(true);
    setNotice("");
    try {
      await api(`jobs/${jobId}/${command}`, {});
      setNotice(
        command === "regenerate"
          ? "New fitting created. The previous version is preserved."
          : command === "retry"
          ? "Job returned to the queue."
          : "Job canceled. Late results will not be published.",
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const item = items.find((i) => i.id === selected);
  return (
    <main className="mx-auto max-w-7xl px-5 pt-28 pb-16">
      <WorkspaceNav current="/prepare" />
      <header className="mb-9 flex flex-wrap justify-between gap-5 items-end">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-accent-text mb-3">
            Your digital wardrobe
          </p>
          <h1 className="font-display text-4xl lg:text-5xl font-semibold">
            From photos to your fitting room.
          </h1>
          <p className="mt-4 text-fg-muted text-sm max-w-xl leading-6">
            Prepare your avatar, T-shirts and jeans. Completed results are saved for quick outfit changes in Studio.
          </p>
        </div>
        <button onClick={() => void refresh()} className={button}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-danger/40 p-4 text-danger text-sm"
        >
          <p>{error}</p>
          {!data && <p className="mt-2 text-fg-muted text-xs leading-6">Unable to load the 3D library. You can still <Link href="/wardrobe" className="text-accent-text underline">add clothes to your wardrobe</Link> or <Link href="/studio" className="text-accent-text underline">open a PC-exported 3D bundle in Studio</Link>. Select Refresh to check again.</p>}
        </div>
      )}
      {notice && (
        <p role="status" className="mb-5 text-success text-sm">
          {notice}
        </p>
      )}
      <div className="rounded-2xl border border-border p-4 mb-6 text-sm flex flex-wrap gap-3 justify-between">
        <span>
          {!data
            ? error ? "Unable to check processing status" : "Checking the processor…"
            : data.connected
              ? "Processor connected"
              : "Processor offline · New jobs will wait"}
        </span>
        <span className="text-fg-muted text-xs">
          {data?.online
            .map(
              (c) =>
                ({
                  "avatar.reconstruct": "Build avatar",
                  "garment.reconstruct": "Build top",
                  "garment.drape": "Fit top",
                  "bottom.reconstruct": "Build bottom",
                  "bottom.drape": "Fit bottom",
                })[c] ?? c,
            )
            .join(" · ") || "No processing capabilities confirmed yet"}
        </span>
      </div>
      <div className="grid lg:grid-cols-2 gap-5 mb-10">
        <section className={panel}>
          <Camera className="text-accent-text mb-5" />
          <p className="text-xs text-fg-muted mb-2">01 / Your body</p>
          <h2 className="font-display text-2xl">Create avatar</h2>
          <p className="text-sm text-fg-muted leading-6 my-4">
            Full-body front, side and back photos, plus your height. Wear close-fitting clothes and use even lighting.
          </p>
          <button
            disabled={!data}
            onClick={() => setCapture("avatar")}
            className={`${button} bg-accent text-bg`}
          >
            Add body photos
          </button>
        </section>
        <section className={panel}>
          <Shirt className="text-accent-text mb-5" />
          <p className="text-xs text-fg-muted mb-2">02 / Your real T-shirts and jeans</p>
          <h2 className="font-display text-2xl">Bring your clothes into 3D</h2>
          <label className="block text-sm mt-4">
            Wardrobe item
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className={field}
            >
              <option value="">Choose a T-shirt, shirt or jeans</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} · {i.category === "jeans" ? "Jeans" : i.category === "shirt" ? "Shirt" : "T-shirt"}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-fg-muted my-3">
            Photograph the front and back against a plain background. Add logo or pocket details if needed. Tops and bottoms are processed separately; no avatar is required to start.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={!item || !data}
              onClick={() => setCapture("garment")}
              className={button}
            >
              Add item photos
            </button>
            <Link
              href="/wardrobe"
              className="text-accent-text text-xs inline-flex items-center gap-1"
            >
              Add to wardrobe <ArrowUpRight size={13} />
            </Link>
          </div>
        </section>
      </div>
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-2xl">Library & progress</h2>
          <Link href="/looks" className="text-accent-text text-sm">
            Choose a top to try on →
          </Link>
        </div>
        {data?.models.length === 0 && (
          <div className={`${panel} text-fg-muted text-sm`}>
            No 3D results yet. Start with avatar photos or add photos of T-shirts and jeans from your wardrobe.
          </div>
        )}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data?.models.map((m) => {
            const j = data.jobs.find((j) => j.model_id === m.id);
            return (
              <article className={panel} key={m.id}>
                <p className="text-xs text-fg-muted mb-3">
                  {kindLabel[m.kind]} ·{" "}
                  {new Date(m.created_at).toLocaleDateString("en-US")}
                </p>
                <h3 className="text-lg break-words font-medium">{m.name}</h3>
                <p
                  role="status"
                  className={`text-sm mt-4 ${m.output_asset_id ? "text-success" : "text-fg-muted"}`}
                >
                  {m.output_asset_id
                    ? "Ready"
                    : stateLabel[j?.state ?? "queued"]}
                </p>
                {j?.stage && j.state === "running" && (
                  <p className="text-xs text-fg-muted mt-2">
                    {(
                      {
                        starting: "Starting",
                        preprocessing: "Preparing photos",
                        reconstructing: "Building geometry",
                        texturing: "Creating surfaces",
                        draping: "Simulating garment",
                        exporting: "Exporting model",
                        uploading: "Uploading results",
                      } as Record<string, string>
                    )[j.stage] ?? "Processing"}
                  </p>
                )}
                {j?.error_code && (
                  <p className="text-xs text-danger mt-2">
                    {(
                      {
                        OOM: "The GPU ran out of memory. The processor configuration needs adjustment.",
                        MODEL_UNAVAILABLE:
                          "The processor is not ready for this model type.",
                        LEASE_EXPIRED: "Lost connection to the processor.",
                        SOURCE_DELETED: "Canceled because the source photos or video were deleted.",
                      } as Record<string, string>
                    )[j.error_code] ?? "This job did not produce a valid result."}
                  </p>
                )}
                {m.kind === "avatar" && m.output_asset_id && (
                  <AvatarDraft
                    model={m}
                    onChanged={(message) => {
                      setNotice(message);
                      void refresh();
                    }}
                    onRecapture={() => setCapture("avatar")}
                  />
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {m.output_asset_id && m.kind !== "garment" && (
                    <Link
                      className={button}
                      href={`/studio?avatar=${m.kind === "avatar" ? m.id : m.avatar_id}${m.kind === "fitting" ? `&fitting=${m.id}` : ""}`}
                    >
                      Open in Studio
                    </Link>
                  )}
                  {j && ["queued", "running"].includes(j.state) && (
                    <button
                      disabled={busy}
                      onClick={() => void action(j.id, "cancel")}
                      className="text-sm text-fg-muted underline"
                    >
                      Cancel
                    </button>
                  )}
                  {j && !m.superseded_by &&
                    ["failed", "canceled"].includes(j.state) &&
                    j.error_code !== "SOURCE_DELETED" &&
                    j.attempt < 3 && (
                      <button
                        disabled={busy}
                        onClick={() => void action(j.id, "retry")}
                        className={button}
                      >
                        Retry
                      </button>
                    )}
                  {j && m.kind === "fitting" && !m.superseded_by && !m.output_asset_id &&
                    ["failed", "canceled"].includes(j.state) && j.attempt >= 3 && j.error_code !== "SOURCE_DELETED" && (
                    <button disabled={busy} className={button} onClick={() => void action(j.id, "regenerate")}>
                      Create new fitting
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      {capture && (
        <CloudCapture
          key={capture + selected}
          kind={
            capture === "avatar"
              ? "avatar"
              : item?.category === "shirt"
                ? "shirt"
                : item?.category === "jeans"
                  ? "jeans"
                  : "t-shirt"
          }
          wardrobeItemId={capture === "garment" ? selected : undefined}
          onClose={() => setCapture(null)}
          onDone={() => void refresh()}
        />
      )}
    </main>
  );
}
