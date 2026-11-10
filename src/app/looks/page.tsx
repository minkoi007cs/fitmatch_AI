"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Bookmark, RefreshCw, Shirt, Trash2 } from "lucide-react";
import {
  WorkspaceNav,
  panel,
  button,
  field,
} from "@/components/v2/WorkspaceNav";
import {
  api,
  library,
  prepareFitting,
  stateLabel,
  type Library,
} from "@/lib/v2/client";
import type { SuggestedLook } from "@/lib/v2/recommend";
import type { WardrobeItem } from "@/lib/types";
type Recommendation = {
  id: string;
  profile_id: string;
  data: SuggestedLook[];
  created_at: string;
};
type SavedLook = {
  id: string;
  name: string;
  avatar_id: string;
  fitting_id: string | null;
  top_fitting_id?: string | null;
  bottom_fitting_id?: string | null;
};
export default function LooksPage() {
  const [votes, setVotes] = useState<
    { item_id: string; value: "like" | "skip" }[]
  >([]);
  const [data, setData] = useState<Library | null>(null),
    [rec, setRec] = useState<Recommendation | null>(null),
    [items, setItems] = useState<WardrobeItem[]>([]),
    [saved, setSaved] = useState<SavedLook[]>([]),
    [avatarId, setAvatarId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loaded, setLoaded] = useState(false),
    [occasion, setOccasion] = useState<"" | "daily" | "campus" | "work" | "evening">("");
  const alive = useRef(true),
    lock = useRef(false),
    mutating = useRef(false);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    try {
      const [lib, recs, looks, wardrobe, feedback] = await Promise.all([
        library(),
        api<{ recommendation: Recommendation | null }>("recommendations"),
        api<{ looks: SavedLook[] }>("looks"),
        fetch("/api/wardrobe", { cache: "no-store" }).then(async (r) => {
          if (!r.ok) throw new Error("Unable to load your wardrobe.");
          return r.json();
        }),
        api<{ feedback: { item_id: string; value: "like" | "skip" }[] }>(
          "feedback",
        ),
      ]);
      if (alive.current) {
        setError("");
        setVotes(feedback.feedback);
        setData(lib);
        setRec(recs.recommendation);
        setSaved(looks.looks);
        setItems(wardrobe.items);
        setAvatarId((current) =>
          lib.models.some(
            (m) => m.id === current && m.kind === "avatar" && m.output_asset_id,
          )
            ? current
            : (lib.models.find((m) => m.kind === "avatar" && m.output_asset_id)
                ?.id ?? ""),
        );
        setLoaded(true);
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
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 8000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  async function run(task: () => Promise<void>) {
    if (mutating.current) return;
    mutating.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }
  const avatar = data?.models.find((m) => m.id === avatarId);
  return (
    <main className="mx-auto max-w-7xl px-5 pt-28 pb-16">
      <WorkspaceNav current="/looks" />
      <header className="flex flex-wrap justify-between items-end gap-6 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-accent-text mb-3">
            Picked from your wardrobe
          </p>
          <h1 className="font-display text-4xl lg:text-5xl font-semibold">
            Your style. Your clothes.
          </h1>
          <p className="text-sm text-fg-muted leading-6 mt-4 max-w-xl">
            Up to three top-and-jeans looks from your own wardrobe, based on your style profile and occasion. No jeans yet? Start with tops.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs text-fg-muted">
            Occasion
            <select
              aria-label="Outfit occasion"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value as typeof occasion)}
              className="ml-2 bg-bg border border-border rounded-xl p-2 text-fg"
            >
              <option value="">Theo quiz</option>
              <option value="daily">Everyday</option>
              <option value="campus">School</option>
              <option value="work">Work</option>
              <option value="evening">Evening</option>
            </select>
          </label>
          <Link href="/quiz" className={button}>
            Edit style
          </Link>
          <button
            disabled={busy || !loaded}
            onClick={() =>
              void run(async () => {
                await api("recommendations", occasion ? { occasion } : {});
                setNotice(
                  "Updated using your wardrobe, style profile and occasion.",
                );
              })
            }
            className={`${button} bg-accent text-bg`}
          >
            <RefreshCw size={14} />
            Refresh ideas
          </button>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="mb-5 text-danger text-sm rounded-xl border border-danger/40 p-4"
        >
          <p>{error}</p>
          <div className="mt-3 flex flex-wrap gap-3 items-center">
            <button className={button} disabled={busy} onClick={() => void refresh()}>Try loading looks again</button>
            <Link href="/wardrobe" className="inline-flex min-h-11 items-center text-accent-text text-xs">Back to photo wardrobe →</Link>
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className="mb-5 text-success text-sm">
          {notice}
        </p>
      )}
      <div className="grid md:grid-cols-[1fr_1fr] gap-5 mb-7">
        <label className={`${panel} block text-sm`}>
          Try on your avatar
          <select
            value={avatarId}
            onChange={(e) => setAvatarId(e.target.value)}
            className={field}
          >
            <option value="">No avatar ready yet</option>
            {data?.models
              .filter((m) => m.kind === "avatar" && m.output_asset_id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </label>
        <div className={`${panel} text-sm text-fg-muted leading-6`}>
          <p>
            Only completed 3D garments and fittings can open in Studio. The first fitting may require GPU processing; later visits reuse results for the same avatar and garment.
          </p>
          <Link
            href="/prepare"
            className="text-accent-text inline-flex items-center gap-1 mt-2"
          >
            Prepare avatar & clothes <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
      {!loaded && !error && (
        <p role="status" className={`${panel} text-fg-muted`}>
          Opening your wardrobe…
        </p>
      )}
      {loaded && !rec && (
        <section className={panel}>
          <h2 className="text-xl font-medium">
            Start with a little about your style.
          </h2>
          <p className="text-sm text-fg-muted mt-3 mb-5">
            The style quiz helps us choose real clothes from your wardrobe.
          </p>
          <Link href="/quiz" className={`${button} bg-accent text-bg`}>
            Take the quiz
          </Link>
        </section>
      )}
      {rec && rec.data.length === 0 && (
        <section className={panel}>
          <Shirt className="mb-4 text-fg-muted" />
          <h2 className="text-xl">No matching tops yet.</h2>
          <p className="text-sm text-fg-muted mt-3 mb-4">
            Add T-shirts or shirts to your wardrobe, or adjust the patterns you avoid, then refresh your ideas.
          </p>
          <Link href="/wardrobe" className={button}>
            Open wardrobe
          </Link>
        </section>
      )}
      <div className="grid lg:grid-cols-3 gap-5">
        {rec?.data.map((look, index) => {
          const item = items.find((i) => i.id === look.itemId);
          const garment = data?.models.find(
            (m) =>
              m.kind === "garment" &&
              m.wardrobe_item_id === look.itemId &&
              m.output_asset_id,
          );
          const fitting =
            avatar && garment
              ? data?.models.find(
                  (m) =>
                    !m.superseded_by && m.kind === "fitting" &&
                    m.avatar_id === avatar.id &&
                    m.garment_id === garment.id,
                )
              : undefined;
          const job = fitting
            ? data?.jobs.find((j) => j.model_id === fitting.id)
            : undefined;
          const href = `/studio?avatar=${avatarId}&fitting=${fitting?.id}`;
          const full = look.renderScope === "full-look" && !!look.bottomItemId;
          const bottomItem = full ? items.find((i) => i.id === look.bottomItemId) : undefined;
          const bottomGarment = full
            ? data?.models.find((m) => m.kind === "garment" && m.wardrobe_item_id === look.bottomItemId && m.output_asset_id)
            : undefined;
          return (
            <article
              key={look.id}
              className="rounded-3xl border border-border bg-bg-elevated overflow-hidden"
            >
              <div className="relative h-60 bg-[#d9d7cf] text-neutral-800 flex items-center justify-center">
                {item?.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    unoptimized
                    className="object-contain p-5"
                    sizes="400px"
                  />
                ) : (
                  <div className="text-center">
                    <Shirt size={48} strokeWidth={1} className="mx-auto mb-3" />
                    <span className="text-xs">
                      {item
                        ? "No preview image for this top"
                        : "This top is no longer in your wardrobe"}
                    </span>
                  </div>
                )}
                <span className="absolute top-4 left-4 rounded-full bg-white/85 px-3 py-1 text-[11px]">
                  Option 0{index + 1}
                </span>
                <span className="absolute bottom-4 left-4 text-[10px] uppercase tracking-widest">
                  Original garment photo · Not a 3D render
                </span>
              </div>
              <div className="p-6">
                <h2 className="font-display text-2xl break-words">
                  {look.itemName}
                  {full && <span className="block text-lg text-fg-muted">+ {look.bottomItemName}</span>}
                </h2>
                <p className="text-xs text-accent-text mt-2">
                  {look.category === "shirt" ? "Shirt" : "T-shirt"}
                  {full ? " + Jeans · Try the full look" : " · Try this top"}
                </p>
                <p className="text-sm text-fg-muted leading-6 mt-4">
                  {look.reason}
                </p>
                <div className="mt-6 space-y-3">
                  {full ? (
                    !item || !bottomItem ? (
                      <p className="text-sm text-fg-muted">An item is no longer in your wardrobe. Refresh your ideas.</p>
                    ) : !avatar ? (
                      <Link href="/prepare" className={`${button} w-full`}>
                        Create an avatar first
                      </Link>
                    ) : garment && bottomGarment ? (
                      <Link
                        href={`/studio?avatar=${avatar.id}&top=${garment.id}&bottom=${bottomGarment.id}`}
                        className={`${button} bg-accent text-bg w-full`}
                      >
                        Try the full look <ArrowUpRight size={14} />
                      </Link>
                    ) : (
                      <Link href="/prepare" className={`${button} w-full`}>
                        Prepare {!garment ? "top" : "bottom"} in 3D first
                      </Link>
                    )
                  ) : !item ? (
                    <p className="text-sm text-fg-muted">
                      Refresh ideas to update your wardrobe.
                    </p>
                  ) : !avatar ? (
                    <Link href="/prepare" className={`${button} w-full`}>
                      Create an avatar first
                    </Link>
                  ) : !garment ? (
                    <Link href="/prepare" className={`${button} w-full`}>
                      Prepare this top in 3D
                    </Link>
                  ) : fitting?.output_asset_id ? (
                    <>
                      <Link
                        href={href}
                        className={`${button} bg-accent text-bg w-full`}
                      >
                        Try on in 3D <ArrowUpRight size={14} />
                      </Link>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await api("looks", {
                              name: look.itemName,
                              avatarId: avatar.id,
                              fittingId: fitting.id,
                              recommendationId: rec.id,
                            });
                            setNotice("Look saved to your account.");
                          })
                        }
                        className={`${button} w-full`}
                      >
                        <Bookmark size={14} />
                        Save look
                      </button>
                    </>
                  ) : job && ["queued", "running"].includes(job.state) ? (
                    <p
                      role="status"
                      className="rounded-xl border border-border p-3 text-sm text-fg-muted"
                    >
                      {stateLabel[job.state]}
                      {job.state === "queued" &&
                      !data?.online.includes("garment.drape")
                        ? " · fitting processor not connected"
                        : ""}
                    </p>
                  ) : job && ["failed", "canceled"].includes(job.state) ? (
                    <Link className={`${button} w-full`} href="/prepare">
                      View error & retry
                    </Link>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await prepareFitting(avatar, garment);
                          setNotice(
                            "Fitting requested. The 3D button will appear when it is ready.",
                          );
                        })
                      }
                      className={`${button} bg-accent text-bg w-full`}
                    >
                      Prepare 3D fitting
                    </button>
                  )}
                </div>
                {item && (
                  <div className="mt-4 pt-4 border-t border-border flex justify-between gap-3">
                    <button
                      disabled={busy}
                      aria-pressed={votes.some(
                        (v) => v.item_id === item.id && v.value === "like",
                      )}
                      className="text-xs text-accent-text"
                      onClick={() =>
                        void run(async () => {
                          await api("feedback", {
                            itemId: item.id,
                            recommendationId: rec.id,
                            value: "like",
                          });
                          setNotice(
                            "Noted your preference for future suggestions.",
                          );
                        })
                      }
                    >
                      My style
                    </button>
                    <button
                      disabled={busy}
                      className="text-xs text-fg-muted"
                      onClick={() =>
                        void run(async () => {
                          await api("feedback", {
                            itemId: item.id,
                            recommendationId: rec.id,
                            value: "skip",
                          });
                          await api("recommendations", {});
                          setNotice(
                            "This top is hidden from suggestions. You can undo this below.",
                          );
                        })
                      }
                    >
                      Hide from suggestions
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {votes.some((v) => v.value === "skip") && (
        <section className="mt-8">
          <h2 className="text-sm font-medium mb-3">Tops hidden from suggestions</h2>
          <div className="flex flex-wrap gap-2">
            {votes
              .filter((v) => v.value === "skip")
              .map((v) => (
                <button
                  key={v.item_id}
                  disabled={busy}
                  className={button}
                  onClick={() =>
                    void run(async () => {
                      await api(
                        `feedback/${v.item_id}`,
                        undefined,
                        undefined,
                        "DELETE",
                      );
                      await api("recommendations", {});
                    })
                  }
                >
                  {items.find((i) => i.id === v.item_id)?.name ?? "Hidden top"} · Undo
                </button>
              ))}
          </div>
        </section>
      )}
      {saved.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl mb-5">
            Looks saved to your account
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {saved.map((l) => (
              <div key={l.id} className={`${panel} flex gap-3 items-center`}>
                <Link
                  href={`/studio?avatar=${l.avatar_id}&look=${l.id}`}
                  className="text-sm flex-1 break-words"
                >
                  {l.name} ↗
                </Link>
                <button
                  disabled={busy}
                  aria-label={`Delete look ${l.name}`}
                  onClick={() =>
                    void run(async () => {
                      await api(
                        `looks/${l.id}`,
                        undefined,
                        undefined,
                        "DELETE",
                      );
                    })
                  }
                  className="p-2 text-fg-muted"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="mt-8 text-xs text-fg-muted leading-5">
        Suggestions currently use explainable rules. They do not assess fit or add clothes and accessories you do not own.
      </p>
    </main>
  );
}
