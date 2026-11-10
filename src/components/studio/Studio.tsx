"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CloudLibrary from "@/components/v2/CloudLibrary";
import { WorkspaceNav } from "@/components/v2/WorkspaceNav";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  FolderOpen,
  RotateCcw,
  Shirt,
  ArrowUpRight,
  Check,
  UserRound,
  Camera,
  Plus,
  Search,
  Bookmark,
  HardDrive,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  parseBundle,
  validateGlb,
  MAX_GLB_BYTES,
  CATEGORY_LABEL,
  CATEGORY_SLOT,
  type StudioBundle,
} from "@/lib/studio/bundle";
import {
  workspaceStorage,
  validateWorkspace,
  lookOutfit,
  type LocalLook,
} from "@/lib/studio/workspace";
import { downloadBlob, type CaptureKind } from "@/lib/studio/capture";
import {
  initOutfit,
  choose,
  itemLoaded,
  itemFailed,
  pendingSlots,
  SLOTS,
  EMPTY,
  type Outfit,
  type OutfitState,
  type Slot,
} from "@/lib/studio/outfit";
import {
  cloudItems,
  cloudRows,
  modelBytes,
  SESSION_BYTES,
  type ModelResponse,
  type StudioItem,
} from "@/lib/studio/cloud";
import { api } from "@/lib/v2/client";
import type { CameraState, ModelRow } from "@/lib/v2/contracts";
import type { ModelAsset, ViewerControl, LookbookShot } from "@/components/studio/Viewer";
const Viewer = dynamic(() => import("@/components/studio/Viewer"), {
  ssr: false,
  loading: () => (
    <div className="grid place-items-center h-[600px] text-fg-muted">
      Opening Studio…
    </div>
  ),
});

const CaptureDrawer = dynamic(
  () => import("@/components/studio/CaptureDrawer"),
);

type SceneInfo = {
  /** avatar version key; every async result is checked against it */
  key: string;
  source: "local" | "cloud";
  avatar: ModelAsset;
  name: string;
  avatarModelId?: string;
};
export type StudioRequest = {
  avatar?: string;
  fitting?: string;
  look?: string;
  top?: string;
  bottom?: string;
};
type CloudLook = {
  id: string;
  avatar_id: string;
  fitting_id: string | null;
  top_fitting_id: string | null;
  bottom_fitting_id: string | null;
  camera: CameraState | null;
  snapshot: Record<string, { sha256: string; fittingId?: string; garmentId?: string; modelId?: string }> | null;
};
const SLOT_LABEL: Record<Slot, string> = { top: "Top", bottom: "Bottom" };
const STATUS_LABEL: Record<StudioItem["status"], string> = {
  ready: "Ready",
  pending: "Preparing for this avatar",
  prepare: "Not fitted yet · Select to prepare",
  failed: "Previous preparation failed",
  "garment-pending": "Building 3D",
};

export default function Studio({ request = {} }: { request?: StudioRequest }) {
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const sceneKey = useRef("");
  const fetching = useRef(new Set<string>());
  const sceneAbort = useRef(new AbortController());
  const openAbort = useRef(new AbortController());
  const viewer = useRef<ViewerControl | null>(null);
  const expectedSha = useRef(new Map<string, string>());
  const [owner, setOwner] = useState("");
  const [capture, setCapture] = useState<CaptureKind | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [looks, setLooks] = useState<LocalLook[]>([]);
  const [notice, setNotice] = useState("");
  const [cloudNotice, setCloudNotice] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [storageBusy, setStorageBusy] = useState(false);
  const [lookName, setLookName] = useState("");
  const [scene, setScene] = useState<SceneInfo | null>(null);
  const [bundle, setBundle] = useState<StudioBundle | null>(null);
  const [items, setItems] = useState<StudioItem[]>([]);
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [outfit, setOutfit] = useState<OutfitState>(() => initOutfit(""));
  const [initialCamera, setInitialCamera] = useState<CameraState | null>(null);
  const [compare, setCompare] = useState<Outfit | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [shot, setShot] = useState<LookbookShot>({ angle: "front", background: "neutral" });
  const state = useRef({ scene, items, outfit, assets });
  useEffect(() => {
    state.current = { scene, items, outfit, assets };
  });
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && typeof data.user?.id === "string") setOwner(data.user.id);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  /** Replaces the whole scene. Only the newest generation may commit. */
  function commitScene(next: SceneInfo, nextItems: StudioItem[], nextAssets: ModelAsset[], start: Outfit, camera: CameraState | null) {
    // Downloads started for the previous scene are abandoned, not just ignored when they finish.
    sceneAbort.current.abort();
    sceneAbort.current = new AbortController();
    sceneKey.current = next.key;
    fetching.current = new Set();
    setScene(next);
    setItems(nextItems);
    setAssets(nextAssets);
    setOutfit(initOutfit(next.key, start));
    setInitialCamera(camera);
    setCompare(null);
    setQuery("");
    setCategory("all");
    setError("");
  }
  function presetOutfit(list: StudioItem[]): Outfit {
    return {
      top: list.find((i) => i.preset && i.slot === "top")?.id ?? null,
      bottom: list.find((i) => i.preset && i.slot === "bottom")?.id ?? null,
    };
  }
  function bundleItems(b: StudioBundle): StudioItem[] {
    return b.garments.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      slot: CATEGORY_SLOT[g.category],
      preset: g.preset === true,
      status: "ready" as const,
    }));
  }

  // ---------- cloud: lazy per-item download, preparation and polling ----------
  async function fetchItem(item: StudioItem, key: string, avatarModelId: string) {
    if (!item.fittingId || fetching.current.has(item.id)) return;
    fetching.current.add(item.id);
    const signal = sceneAbort.current.signal;
    try {
      const record = await api<ModelResponse>(`models/${item.fittingId}`);
      if (sceneKey.current !== key) return;
      if (
        record.model.kind !== "fitting" ||
        record.model.avatar_id !== avatarModelId ||
        record.model.garment_id !== item.id ||
        (record.model.slot ?? "top") !== item.slot
      )
        throw new Error("This fitting does not belong to this avatar and garment.");
      const expected = expectedSha.current.get(item.fittingId);
      if (expected && record.asset && record.asset.sha256 !== expected)
        throw new Error("This garment's 3D version has changed since the look was saved.");
      const used = state.current.assets.reduce((n, a) => n + a.bytes.byteLength, state.current.scene?.avatar.bytes.byteLength ?? 0);
      if (record.asset && used + record.asset.bytes > SESSION_BYTES)
        throw new Error("This session has loaded nearly 120 MB of models. Reopen the avatar to free memory before choosing more.");
      const bytes = await modelBytes(record, { signal, expectedSha256: expected });
      if (sceneKey.current !== key) return;
      setAssets((prev) => (prev.some((a) => a.id === item.id) ? prev : [...prev, { id: item.id, name: item.name, bytes }]));
    } catch (e) {
      if (sceneKey.current !== key) return;
      setError((e as Error).message);
      setOutfit((s) => itemFailed(s, key, item.id));
    } finally {
      fetching.current.delete(item.id);
    }
  }
  async function prepareItem(item: StudioItem, key: string, avatarModelId: string) {
    try {
      const res = await api<{ modelId: string; reused: boolean }>(
        "models",
        { kind: "fitting", name: item.name, avatarId: avatarModelId, garmentId: item.id },
        { "Idempotency-Key": `fit_${crypto.randomUUID()}` },
      );
      if (sceneKey.current !== key) return;
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "pending", fittingId: res.modelId } : i)));
      setNotice(`Preparing “${item.name}” for this avatar. You can choose something else; this item will appear only if it is still selected.`);
    } catch (e) {
      if (sceneKey.current !== key) return;
      setError((e as Error).message);
      setOutfit((s) => itemFailed(s, key, item.id));
    }
  }
  function ensure(item: StudioItem) {
    const s = state.current.scene;
    if (!s || s.source !== "cloud" || !s.avatarModelId) return;
    if (state.current.assets.some((a) => a.id === item.id)) return;
    if (item.status === "ready") void fetchItem(item, s.key, s.avatarModelId);
    else if (item.status === "prepare") void prepareItem(item, s.key, s.avatarModelId);
  }
  const ensureRef = useRef(ensure);
  useEffect(() => {
    ensureRef.current = ensure;
  });
  const poll = useCallback(async () => {
    const s = state.current.scene;
    if (!s || s.source !== "cloud" || !s.avatarModelId) return;
    try {
      const rows = await cloudRows();
      if (sceneKey.current !== s.key) return;
      const next = cloudItems(rows.models, rows.jobs, s.avatarModelId);
      setItems(next);
      const wanted = state.current.outfit.wanted;
      for (const slot of SLOTS) {
        const item = next.find((i) => i.id === wanted[slot]);
        if (!item) continue;
        if (item.status === "failed") {
          setOutfit((o) => itemFailed(o, s.key, item.id));
          setNotice(`Unable to prepare “${item.name}”. Your current outfit is preserved. View the error on Prepare 3D.`);
        } else if (item.status === "ready") ensureRef.current(item);
      }
    } catch {
      // Offline: keep the current outfit, try again on the next tick.
    }
  }, []);
  const waiting = scene?.source === "cloud" && items.some((i) => i.status === "pending" || i.status === "garment-pending");
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      if (!document.hidden) void poll();
    }, 4000);
    return () => clearInterval(timer);
  }, [waiting, poll]);

  async function openCloud(avatarId: string, req: StudioRequest = {}) {
    const version = ++generation.current;
    openAbort.current.abort();
    const opening = new AbortController();
    openAbort.current = opening;
    setBusy(false);
    setCloudBusy(true);
    setCloudError("");
    setCloudNotice("");
    try {
      const [avatar, rows, savedLooks] = await Promise.all([
        api<ModelResponse>(`models/${avatarId}`),
        cloudRows(),
        req.look ? api<{ looks: CloudLook[] }>("looks") : Promise.resolve({ looks: [] as CloudLook[] }),
      ]);
      if (avatar.model.kind !== "avatar") throw new Error("Please choose an avatar model.");
      const look = req.look ? savedLooks.looks.find((l) => l.id === req.look) : undefined;
      if (req.look && (!look || look.avatar_id !== avatarId)) throw new Error("This look was not found for the selected avatar.");
      // LOOK-01: a saved look pins the avatar version too, not only the garments.
      const pinnedAvatar = look?.snapshot?.avatar;
      if (pinnedAvatar && ((pinnedAvatar.modelId && pinnedAvatar.modelId !== avatarId) || pinnedAvatar.sha256 !== avatar.asset?.sha256))
        throw new Error("The avatar version has changed since this look was saved. A look cannot open with a different avatar.");
      const bytes = await modelBytes(avatar, { signal: opening.signal, expectedSha256: pinnedAvatar?.sha256 });
      if (version !== generation.current) return;
      let list = cloudItems(rows.models, rows.jobs, avatarId);
      const garmentOfFitting = (fittingId: string | null | undefined) =>
        rows.models.find((m: ModelRow) => m.id === fittingId && m.kind === "fitting" && m.avatar_id === avatarId);
      let start: Outfit = { ...EMPTY };
      let camera: CameraState | null = null;
      expectedSha.current = new Map();
      if (look) {
        const top = garmentOfFitting(look.top_fitting_id ?? look.fitting_id);
        const bottom = garmentOfFitting(look.bottom_fitting_id);
        if ((look.top_fitting_id ?? look.fitting_id) && !top) throw new Error("The top in this look is no longer on your account.");
        if (look.bottom_fitting_id && !bottom) throw new Error("The bottom in this look is no longer on your account.");
        start = { top: top?.garment_id ?? null, bottom: bottom?.garment_id ?? null };
        for (const v of Object.values(look.snapshot ?? {})) if (v.fittingId) expectedSha.current.set(v.fittingId, v.sha256);
        // Reopen exactly the fittings that were saved, by id, even if a newer generation exists.
        const pins = new Map<string, string>();
        for (const f of [top, bottom]) if (f?.garment_id && f.output_asset_id) pins.set(f.garment_id, f.id);
        list = list.map((i) => (pins.has(i.id) ? { ...i, fittingId: pins.get(i.id), status: "ready" as const } : i));
        camera = look.camera;
      } else if (req.fitting) {
        const fit = garmentOfFitting(req.fitting);
        if (!fit?.output_asset_id) throw new Error("This fitting is not ready or belongs to another avatar.");
        start = { ...EMPTY, [(fit.slot ?? "top") as Slot]: fit.garment_id };
      } else {
        start = {
          top: list.some((i) => i.id === req.top && i.slot === "top") ? req.top! : null,
          bottom: list.some((i) => i.id === req.bottom && i.slot === "bottom") ? req.bottom! : null,
        };
      }
      const key = `cloud:${avatarId}:${version}`;
      commitScene(
        { key, source: "cloud", avatar: { id: "avatar", name: avatar.model.name, bytes }, name: avatar.model.name, avatarModelId: avatarId },
        list,
        [],
        start,
        camera,
      );
      setBundle(null);
      setLooks([]);
      state.current = { ...state.current, scene: { key, source: "cloud", avatar: { id: "avatar", name: avatar.model.name, bytes }, name: avatar.model.name, avatarModelId: avatarId }, items: list, assets: [] };
      for (const slot of SLOTS) {
        const item = list.find((i) => i.id === start[slot]);
        if (item) ensure(item);
      }
      const tops = list.filter((i) => i.slot === "top").length;
      const bottoms = list.filter((i) => i.slot === "bottom").length;
      setCloudNotice(`Avatar opened · ${tops} tops and ${bottoms} bottoms in your wardrobe. Unfitted items will be prepared when selected.`);
    } catch (e) {
      if (version === generation.current) setCloudError((e as Error).message);
    } finally {
      if (version === generation.current) setCloudBusy(false);
    }
  }

  // ---------- local bundle import / browser storage ----------
  async function persist(action: "load" | "save" | "delete") {
    if (!owner || storageBusy) return;
    const version = generation.current;
    setStorageBusy(true);
    setError("");
    setNotice("");
    try {
      if (action === "save") {
        if (!bundle || !scene) return;
        await workspaceStorage(owner, "save", { version: 1, bundle, assets: [scene.avatar, ...bundle.garments.map((g) => assets.find((a) => a.id === g.id)!)], looks });
        if (version === generation.current) setNotice("3D bundle and looks saved in this browser. They have not been synced to your account.");
      } else if (action === "load") {
        const saved = await workspaceStorage(owner, "load");
        if (version !== generation.current) return;
        if (!saved) {
          setNotice("No 3D bundle is saved in this browser for the current account.");
          return;
        }
        const w = validateWorkspace(saved);
        const next = ++generation.current;
        const list = bundleItems(w.bundle);
        commitScene({ key: `local:${next}`, source: "local", avatar: w.assets[0], name: w.bundle.avatar.name }, list, w.assets.slice(1), presetOutfit(list), null);
        setBundle(w.bundle);
        setLooks(w.looks);
        setNotice("Restored your locally saved 3D bundle.");
      } else {
        await workspaceStorage(owner, "delete");
        if (version === generation.current) setNotice("Local save deleted. The open bundle remains in this session.");
      }
    } catch (e) {
      if (version === generation.current) setError(e instanceof Error ? e.message : "Unable to access local storage.");
    } finally {
      setStorageBusy(false);
    }
  }
  async function load(files: FileList | null) {
    if (!files?.length) return;
    const version = ++generation.current;
    setBusy(true);
    setCloudBusy(false);
    setError("");
    setNotice("");
    try {
      const list = [...files];
      const manifest = list.find((f) => f.name === "manifest.json");
      if (!manifest || manifest.size > 32 * 1024) throw new Error("Select manifest.json and the PC-exported GLB files (manifest up to 32 KB).");
      if (new Set(list.map((f) => f.name)).size !== list.length) throw new Error("File names must be unique.");
      const next = parseBundle(JSON.parse(await manifest.text()));
      const records = [next.avatar, ...next.garments];
      if (records.reduce((n, r) => n + (list.find((f) => f.name === r.file)?.size ?? 0), 0) > SESSION_BYTES)
        throw new Error("Models must total no more than 120 MB for this experimental session.");
      const prepared: ModelAsset[] = [];
      for (const record of records) {
        const file = list.find((f) => f.name === record.file);
        if (!file || file.size > MAX_GLB_BYTES) throw new Error(`Missing ${record.file} or the file exceeds 40 MB.`);
        const bytes = await file.arrayBuffer();
        validateGlb(bytes);
        prepared.push({ id: record === next.avatar ? "avatar" : record.id, name: record.name, bytes });
      }
      if (generation.current !== version) return;
      const itemsList = bundleItems(next);
      commitScene({ key: `local:${version}`, source: "local", avatar: prepared[0], name: next.avatar.name }, itemsList, prepared.slice(1), presetOutfit(itemsList), null);
      setBundle(next);
      setLooks([]);
    } catch (e) {
      if (generation.current === version) setError(e instanceof Error ? e.message : "Unable to open the 3D bundle.");
    } finally {
      if (generation.current === version) setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  function reset() {
    generation.current++;
    sceneKey.current = "";
    setBusy(false);
    setCloudBusy(false);
    setScene(null);
    setBundle(null);
    setItems([]);
    setAssets([]);
    setOutfit(initOutfit(""));
    setCompare(null);
    setLooks([]);
    setError("");
    setNotice("");
  }

  // ---------- selection ----------
  function pick(item: StudioItem) {
    if (!scene) return;
    if (item.status === "garment-pending") {
      setNotice(`“${item.name}” is being built in 3D. You can keep styling other items.`);
      return;
    }
    setOutfit((s) => choose(s, { [item.slot]: item.id }));
    if (item.status === "failed") {
      setOutfit((s) => itemFailed(s, scene.key, item.id));
      setNotice(`Preparation of “${item.name}” failed. Retry on Prepare 3D; your current outfit is preserved.`);
      return;
    }
    if (item.status === "pending") setNotice(`“${item.name}” is being prepared. It will appear only if it is still selected.`);
    ensure(item);
  }
  function apply(next: Outfit) {
    setOutfit((s) => choose(s, next));
    for (const slot of SLOTS) {
      const item = items.find((i) => i.id === next[slot]);
      if (item) ensure(item);
    }
  }
  function camera(): CameraState | null {
    return viewer.current?.getCamera() ?? null;
  }
  async function saveLook(e: React.FormEvent) {
    e.preventDefault();
    if (!scene || !lookName.trim() || pendingSlots(outfit).length) return;
    // Snapshot exactly what is on screen at the moment of the click.
    const shown = { ...outfit.shown };
    const cam = camera();
    if (scene.source === "cloud") {
      const fit = (id: string | null) => (id ? items.find((i) => i.id === id)?.fittingId ?? null : null);
      try {
        await api("looks", {
          name: lookName.trim(),
          avatarId: scene.avatarModelId,
          topFittingId: fit(shown.top),
          bottomFittingId: fit(shown.bottom),
          ...(cam ? { camera: cam } : {}),
        });
        setLookName("");
        setNotice("Full look saved to your account, including top, bottom and camera. Reopen it from Ideas & saved looks.");
      } catch (err) {
        setError((err as Error).message);
      }
      return;
    }
    if (looks.length >= 30) return;
    setLooks((previous) => [
      ...previous,
      { id: crypto.randomUUID(), name: lookName.trim(), garmentId: shown.top, top: shown.top, bottom: shown.bottom, camera: cam, createdAt: new Date().toISOString() },
    ]);
    setLookName("");
    setNotice("Look added to this session. Select Save on this device to keep it after closing the page.");
  }
  function openLocalLook(look: LocalLook) {
    apply(lookOutfit(look));
    if (look.camera) viewer.current?.setCamera(look.camera);
  }
  async function renderLookbook() {
    const blob = await viewer.current?.capture(shot);
    if (!blob) {
      setError("Unable to capture an image. Wait for the models to load and try again.");
      return;
    }
    const name = [nameOf(outfit.shown.top)?.name, nameOf(outfit.shown.bottom)?.name].filter(Boolean).join(" + ") || "avatar";
    downloadBlob(blob, `fitmatch-lookbook-${name.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60)}-${shot.angle}.png`);
    setNotice("Lookbook image saved from the displayed avatar and outfit. No AI image generation was used.");
  }
  function exportSelection() {
    if (!bundle) return;
    downloadBlob(
      new Blob([JSON.stringify({ schemaVersion: 2, avatarId: bundle.avatar.id, outfit: outfit.shown, looks }, null, 2)], { type: "application/json" }),
      "fitmatch-look-selections.json",
    );
    setNotice("Selection list exported. This file does not contain 3D models; keep your original GLB bundle.");
  }

  const nameOf = (id: string | null) => (id ? items.find((i) => i.id === id) : undefined);
  const pending = pendingSlots(outfit);
  const visible = items.filter(
    (g) => (category === "all" || g.category === category) && g.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const action = "inline-flex gap-2 items-center justify-center rounded-full px-4 py-2.5 text-xs font-medium disabled:opacity-40 transition-colors";
  const sceneKeyValue = scene?.key ?? "";
  const onLoaded = useCallback((id: string) => setOutfit((s) => itemLoaded(s, sceneKeyValue, id)), [sceneKeyValue]);
  const onFailed = useCallback(
    (id: string) => {
      setOutfit((s) => itemFailed(s, sceneKeyValue, id));
      setError("An item could not be read (invalid GLB or incompatible coordinates). Your current outfit is preserved.");
    },
    [sceneKeyValue],
  );
  return (
    <main className="min-h-screen pt-28 pb-10 px-4 lg:px-8 max-w-[1800px] mx-auto">
      <WorkspaceNav current="/studio" />
      <header className="flex flex-wrap items-end justify-between gap-5 mb-7">
        <div>
          <p className="text-accent-text uppercase tracking-[.25em] text-[10px] mb-2">Fitmatch / Personal fitting studio</p>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">Your personal fitting room.</h1>
          <p className="text-sm text-fg-muted mt-3">Choose tops and bottoms separately. Change one while keeping the other.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCapture("avatar")} className={`${action} border border-border hover:bg-bg-raised`}>
            <Camera size={15} />
            Prepare avatar
          </button>
          <button disabled={busy || storageBusy} onClick={() => input.current?.click()} className={`${action} bg-accent hover:bg-accent-hover`}>
            <FolderOpen size={15} />
            {busy ? "Checking…" : "Open 3D bundle from PC"}
          </button>
        </div>
        <input ref={input} type="file" multiple accept=".json,.glb" className="hidden" aria-label="Choose manifest and GLB models" onChange={(e) => void load(e.target.files)} />
      </header>
      <CloudLibrary
        requestedAvatar={request.avatar}
        busy={cloudBusy}
        error={cloudError}
        notice={cloudNotice}
        onOpen={(id) => void openCloud(id, id === request.avatar ? request : {})}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 mb-5 text-xs text-fg-muted">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-text" />
          Experimental · Open account results or import a PC-exported GLB bundle.
        </span>
        <button disabled={!owner || storageBusy || busy} onClick={() => void persist("load")} className="text-accent-text disabled:opacity-40">
          {storageBusy ? "Accessing local storage…" : "Open saved bundle on this device"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-danger mb-4 rounded-xl border border-danger/30 p-3 text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-success mb-4 text-sm">
          {notice}
        </p>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-[270px_minmax(0,1fr)_270px] lg:grid-cols-[240px_minmax(0,1fr)] gap-5 items-start">
        <aside className="rounded-3xl border border-border bg-bg-elevated p-5 lg:min-h-[660px] flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-semibold">
              3D wardrobe <span className="text-fg-subtle text-xs ml-1">{items.length}</span>
            </h2>
            <Shirt size={18} className="text-fg-muted" />
          </div>
          <label className="relative block mb-3">
            <Search size={14} className="absolute left-3 top-3 text-fg-muted" />
            <input aria-label="Find items" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tops, jeans…" className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs bg-bg border border-border" />
          </label>
          <div role="group" aria-label="Filter garment categories" className="flex flex-wrap gap-1 mb-5">
            {[["all", "All"], ["t-shirt", "T-shirt"], ["shirt", "Shirt"], ["jeans", "Jeans"]].map(([id, label]) => (
              <button key={id} onClick={() => setCategory(id)} aria-pressed={category === id} className={`rounded-full px-3 py-2 text-[11px] ${category === id ? "bg-fg text-bg" : "text-fg-muted hover:bg-bg-raised"}`}>
                {label}
              </button>
            ))}
          </div>
          {scene ? (
            <div className="space-y-5">
              <button onClick={() => apply({ top: null, bottom: null })} aria-pressed={outfit.wanted.top === null && outfit.wanted.bottom === null} className={`w-full text-left text-xs p-3 rounded-xl border ${outfit.wanted.top === null && outfit.wanted.bottom === null ? "border-accent" : "border-border"}`}>
                View avatar only
              </button>
              {SLOTS.map((slot) => {
                const list = visible.filter((i) => i.slot === slot);
                return (
                  <section key={slot} aria-label={`${SLOT_LABEL[slot]} in wardrobe`}>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-[11px] uppercase tracking-widest text-fg-muted">{SLOT_LABEL[slot]}</h3>
                      {outfit.wanted[slot] && (
                        <button className="text-[11px] text-fg-muted underline underline-offset-2" onClick={() => apply({ ...outfit.wanted, [slot]: null })}>
                          Remove {SLOT_LABEL[slot].toLocaleLowerCase()}
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {list.map((g) => {
                        const on = outfit.wanted[slot] === g.id;
                        const waitingHere = on && outfit.shown[slot] !== g.id;
                        return (
                          <button key={g.id} onClick={() => pick(g)} aria-pressed={on} className={`w-full text-left rounded-2xl border p-4 ${on ? "border-accent bg-accent-soft" : "border-border hover:bg-bg-raised"}`}>
                            <span className="flex justify-between items-center gap-2 text-sm">
                              <span className="break-words min-w-0">{g.name}</span>
                              {waitingHere ? <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden /> : on && <Check size={14} className="shrink-0" />}
                            </span>
                            <span className="text-xs text-fg-muted block mt-2">
                              {CATEGORY_LABEL[g.category]}
                              {g.preset ? " · Preset (not from your wardrobe)" : ""} · {STATUS_LABEL[g.status]}
                            </span>
                          </button>
                        );
                      })}
                      {list.length === 0 && <p className="text-xs text-fg-muted py-2">No items match your filters.</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center">
              <Shirt size={30} strokeWidth={1} className="mx-auto mb-4 text-fg-subtle" />
              <p className="text-sm text-fg-muted leading-6">Your T-shirts and jeans will appear here.</p>
              <p className="text-xs text-fg-subtle leading-5 mt-2">Lay them flat and take clear front and back photos.</p>
            </div>
          )}
          <div className="mt-auto pt-6 space-y-2">
            {([["t-shirt", "Add T-shirt"], ["jeans", "Add jeans"], ["shirt", "Add shirt"]] as const).map(([kind, label]) => (
              <button key={kind} onClick={() => setCapture(kind)} className={`${action} w-full border border-border hover:bg-bg-raised`}>
                <Plus size={14} />
                {label}
              </button>
            ))}
            <Link href="/wardrobe" className="pt-3 flex justify-center items-center gap-2 text-xs text-accent-text">
              Photo wardrobe <ArrowUpRight size={14} />
            </Link>
          </div>
        </aside>
        <section aria-label="Fitting room" className="min-w-0">
          {scene ? (
            <Viewer key={scene.key} avatar={scene.avatar} items={assets} shown={outfit.shown} onLoaded={onLoaded} onFailed={onFailed} controlRef={viewer} initialCamera={initialCamera} />
          ) : (
            <div className="min-h-[600px] lg:min-h-[660px] rounded-3xl bg-[#e4e4e0] text-neutral-800 flex flex-col justify-center items-center p-7 text-center relative overflow-hidden">
              <span className="absolute top-5 left-6 text-[10px] tracking-[.2em] text-neutral-500 uppercase">Your fitting space</span>
              <div className="max-w-sm">
                <div className="mx-auto mb-7 rounded-full bg-white/60 w-24 h-24 grid place-items-center">
                  <UserRound size={38} strokeWidth={1} />
                </div>
                <h2 className="font-display text-3xl font-semibold">Start with your avatar</h2>
                <p className="text-sm text-neutral-600 leading-6 mt-4">Create your avatar or add clothes first. When both are ready, choose a top and bottom to try on.</p>
                <button className="mt-7 bg-neutral-900 text-white rounded-full py-3 px-6 text-sm inline-flex items-center gap-2" onClick={() => setCapture("avatar")}>
                  <Camera size={15} />
                  Prepare avatar photos
                </button>
                <button className="block mx-auto mt-4 text-xs underline underline-offset-4 disabled:opacity-40" disabled={busy || storageBusy} onClick={() => input.current?.click()}>
                  Already have results? Open a 3D bundle from PC
                </button>
              </div>
              <div className="mt-12 grid grid-cols-3 gap-5 w-full max-w-md text-left border-t border-neutral-400/30 pt-5">
                {[["01", "Avatar"], ["02", "Top + bottom"], ["03", "Style & save"]].map(([n, title]) => (
                  <div key={n}>
                    <p className="text-[10px] text-neutral-500 mb-2">{n}</p>
                    <p className="text-xs font-medium">{title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-center text-xs text-fg-subtle mt-3">
            {scene ? "Drag to orbit · Scroll to zoom · Camera stays in place when changing clothes" : "Create and submit photos on Prepare 3D, or export a ZIP to transfer manually"}
          </p>
        </section>
        <aside className="space-y-4 lg:col-span-2 xl:col-span-1 grid lg:grid-cols-2 xl:block gap-4">
          <section className="border border-border rounded-3xl p-5 bg-bg-elevated">
            <p className="text-[10px] uppercase text-fg-muted tracking-widest mb-4">Current look</p>
            <dl className="space-y-2 text-sm" aria-label="Current outfit">
              {SLOTS.map((slot) => (
                <div key={slot} className="flex justify-between gap-3">
                  <dt className="text-fg-muted">{SLOT_LABEL[slot]}</dt>
                  <dd className="text-right break-words min-w-0">
                    {nameOf(outfit.shown[slot])?.name ?? "Avatar's original clothing"}
                    {nameOf(outfit.shown[slot])?.preset ? " (preset)" : ""}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Shoes</dt>
                <dd className="text-right text-fg-muted">Avatar preset shoes</dd>
              </div>
            </dl>
            {pending.length > 0 && (
              <p role="status" className="text-xs text-fg-muted mt-3 flex gap-2 items-center">
                <Loader2 size={12} className="animate-spin" aria-hidden />
                Preparing {pending.map((s) => SLOT_LABEL[s].toLocaleLowerCase()).join(" and ")}; your current outfit stays in place.
              </p>
            )}
            <button
              disabled={!scene}
              onClick={() => {
                setCompare(outfit.wanted);
                setNotice("Look A remembered. Choose different clothes, then select Compare A ↔ B.");
              }}
              className={`${action} mt-5 w-full border border-border`}
            >
              Remember look A
            </button>
            <button
              disabled={!scene || !compare}
              onClick={() => {
                const previous = outfit.wanted;
                apply(compare!);
                setCompare(previous);
              }}
              className={`${action} mt-2 w-full border border-border`}
            >
              Compare A ↔ B
            </button>
            <form onSubmit={(e) => void saveLook(e)} className="mt-5 border-t border-border pt-4">
              <label className="block text-xs text-fg-muted mb-2" htmlFor="look-name">
                Look name
              </label>
              <input id="look-name" disabled={!scene} maxLength={80} value={lookName} onChange={(e) => setLookName(e.target.value)} placeholder="Weekend coffee" className="bg-bg rounded-xl border border-border p-3 text-xs w-full" />
              <button disabled={!scene || !lookName.trim() || pending.length > 0 || (scene.source === "local" && looks.length >= 30)} className={`${action} mt-2 w-full bg-accent`}>
                <Bookmark size={14} />
                {scene?.source === "cloud" ? "Save look to account" : "Save look in session"}
              </button>
              <p className="text-[10px] text-fg-subtle mt-2">
                {scene?.source === "cloud" ? "Saves the displayed top, bottom, camera and exact 3D versions." : "Up to 30 looks / 3D bundle"}
              </p>
            </form>
            {looks.length > 0 && (
              <ul aria-label="Saved looks" className="mt-4 space-y-2">
                {looks.map((look) => (
                  <li key={look.id} className="flex gap-2 items-center border border-border rounded-xl p-2">
                    <button className="text-xs flex-1 text-left break-words min-w-0" onClick={() => openLocalLook(look)}>
                      {look.name}
                    </button>
                    <button aria-label={`Delete look ${look.name}`} onClick={() => setLooks((prev) => prev.filter((l) => l.id !== look.id))} className="p-1 text-fg-muted">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="border border-border rounded-3xl p-5" aria-label="Lookbook image">
            <h2 className="text-sm font-semibold">Lookbook image</h2>
            <p className="text-xs text-fg-muted leading-5 mt-2">Rendered directly from your displayed avatar and outfit, preserving colors, logos and shape. No AI image generation.</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <label className="text-xs text-fg-muted">
                Camera angle
                <select aria-label="Lookbook camera angle" value={shot.angle} onChange={(e) => setShot((v) => ({ ...v, angle: e.target.value as LookbookShot["angle"] }))} className="mt-1 w-full bg-bg border border-border rounded-xl p-2 text-fg">
                  <option value="front">Front</option>
                  <option value="side">Side</option>
                  <option value="back">Back</option>
                  <option value="current">Current view</option>
                </select>
              </label>
              <label className="text-xs text-fg-muted">
                Background
                <select aria-label="Lookbook background" value={shot.background} onChange={(e) => setShot((v) => ({ ...v, background: e.target.value as LookbookShot["background"] }))} className="mt-1 w-full bg-bg border border-border rounded-xl p-2 text-fg">
                  <option value="neutral">Neutral</option>
                  <option value="white">White</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
            </div>
            <button disabled={!scene || pending.length > 0} onClick={() => void renderLookbook()} className={`${action} w-full border border-border mt-3`}>
              <Download size={14} />
              Save lookbook image
            </button>
          </section>
          <div className="space-y-4">
            <section className="border border-border rounded-3xl p-5">
              <UserRound size={20} className="text-accent-text mb-3" />
              <h2 className="text-sm font-semibold break-words">{scene?.name ?? "No avatar yet"}</h2>
              <p className="text-xs text-fg-muted mt-2 leading-5">
                {scene?.source === "cloud"
                  ? "Your avatar and fitted clothes are on your account. Reopening a look does not run AI again."
                  : scene
                    ? "GLB bundle imported from PC. Closing it does not delete your local save."
                    : "Front, side and back photos, plus height, help check body shape."}
              </p>
              <button onClick={() => setCapture("avatar")} className="text-xs text-accent-text mt-3">
                Prepare a new avatar
              </button>
              {scene && (
                <button onClick={reset} className="text-xs flex items-center gap-2 mt-4 text-fg-muted">
                  <RotateCcw size={13} />
                  Close 3D bundle
                </button>
              )}
            </section>
            <section className="border border-border rounded-3xl p-5">
              <HardDrive size={18} className="text-fg-muted mb-3" />
              <h2 className="text-sm font-semibold">Save privately on this device</h2>
              <p className="text-xs text-fg-muted leading-5 mt-2">
                For PC-imported GLB bundles. Saves stay in this browser, separated by account. Other people using this device can still access browser data.
              </p>
              <button disabled={!bundle || !owner || storageBusy || busy} onClick={() => void persist("save")} className={`${action} w-full border border-border mt-4`}>
                Save on this device
              </button>
              <button disabled={!bundle} onClick={exportSelection} className="text-xs text-fg-muted flex items-center gap-2 mt-3">
                <Download size={13} />
                Export look list
              </button>
              <button disabled={!owner || storageBusy} onClick={() => void persist("delete")} className="text-xs text-fg-muted mt-4 disabled:opacity-40">
                Delete local save
              </button>
            </section>
          </div>
        </aside>
      </div>
      {capture && <CaptureDrawer key={capture} kind={capture} onClose={() => setCapture(null)} />}
    </main>
  );
}
