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
      Đang mở Studio…
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
  snapshot: Record<string, { sha256: string; fittingId?: string }> | null;
};
const SLOT_LABEL: Record<Slot, string> = { top: "Áo", bottom: "Quần" };
const STATUS_LABEL: Record<StudioItem["status"], string> = {
  ready: "Sẵn sàng",
  pending: "Đang chuẩn bị cho avatar này",
  prepare: "Chưa mặc thử · bấm để chuẩn bị",
  failed: "Lần chuẩn bị trước lỗi",
  "garment-pending": "Đang dựng 3D",
};

export default function Studio({ request = {} }: { request?: StudioRequest }) {
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const sceneKey = useRef("");
  const fetching = useRef(new Set<string>());
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
    try {
      const record = await api<ModelResponse>(`models/${item.fittingId}`);
      if (
        record.model.kind !== "fitting" ||
        record.model.avatar_id !== avatarModelId ||
        record.model.garment_id !== item.id ||
        (record.model.slot ?? "top") !== item.slot
      )
        throw new Error("Lượt mặc thử không thuộc avatar/món đồ này.");
      const expected = expectedSha.current.get(item.fittingId);
      if (expected && record.asset && record.asset.sha256 !== expected)
        throw new Error("Phiên bản 3D của món đồ đã khác bản lưu trong look.");
      const used = state.current.assets.reduce((n, a) => n + a.bytes.byteLength, state.current.scene?.avatar.bytes.byteLength ?? 0);
      if (record.asset && used + record.asset.bytes > SESSION_BYTES)
        throw new Error("Phiên đã tải gần 120 MB mô hình. Mở lại avatar để giải phóng bộ nhớ rồi chọn tiếp.");
      const bytes = await modelBytes(record);
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
        { "Idempotency-Key": `fit_${avatarModelId}_${item.id}` },
      );
      if (sceneKey.current !== key) return;
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "pending", fittingId: res.modelId } : i)));
      setNotice(`Đang chuẩn bị “${item.name}” cho avatar này. Bạn có thể chọn món khác; món này chỉ tự hiện nếu bạn vẫn đang chọn nó.`);
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
          setNotice(`Không chuẩn bị được “${item.name}”. Bộ đang mặc được giữ nguyên; xem lỗi ở trang Chuẩn bị 3D.`);
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
      if (avatar.model.kind !== "avatar") throw new Error("Hãy chọn model avatar.");
      const bytes = await modelBytes(avatar);
      if (version !== generation.current) return;
      const list = cloudItems(rows.models, rows.jobs, avatarId);
      const garmentOfFitting = (fittingId: string | null | undefined) =>
        rows.models.find((m: ModelRow) => m.id === fittingId && m.kind === "fitting" && m.avatar_id === avatarId);
      let start: Outfit = { ...EMPTY };
      let camera: CameraState | null = null;
      expectedSha.current = new Map();
      if (req.look) {
        const look = savedLooks.looks.find((l) => l.id === req.look);
        if (!look || look.avatar_id !== avatarId) throw new Error("Không tìm thấy look này cho avatar đã chọn.");
        const top = garmentOfFitting(look.top_fitting_id ?? look.fitting_id);
        const bottom = garmentOfFitting(look.bottom_fitting_id);
        if ((look.top_fitting_id ?? look.fitting_id) && !top) throw new Error("Áo trong look không còn trên tài khoản.");
        if (look.bottom_fitting_id && !bottom) throw new Error("Quần trong look không còn trên tài khoản.");
        start = { top: top?.garment_id ?? null, bottom: bottom?.garment_id ?? null };
        for (const v of Object.values(look.snapshot ?? {})) if (v.fittingId) expectedSha.current.set(v.fittingId, v.sha256);
        camera = look.camera;
      } else if (req.fitting) {
        const fit = garmentOfFitting(req.fitting);
        if (!fit?.output_asset_id) throw new Error("Lượt thử này chưa sẵn sàng hoặc thuộc avatar khác.");
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
      setCloudNotice(`Đã mở avatar · ${tops} áo và ${bottoms} quần trong tủ. Món chưa mặc thử sẽ được chuẩn bị khi bạn chọn.`);
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
        if (version === generation.current) setNotice("Đã lưu bộ 3D và các look trên trình duyệt này. Chưa đồng bộ lên tài khoản.");
      } else if (action === "load") {
        const saved = await workspaceStorage(owner, "load");
        if (version !== generation.current) return;
        if (!saved) {
          setNotice("Chưa có bộ 3D lưu trên trình duyệt này cho tài khoản hiện tại.");
          return;
        }
        const w = validateWorkspace(saved);
        const next = ++generation.current;
        const list = bundleItems(w.bundle);
        commitScene({ key: `local:${next}`, source: "local", avatar: w.assets[0], name: w.bundle.avatar.name }, list, w.assets.slice(1), presetOutfit(list), null);
        setBundle(w.bundle);
        setLooks(w.looks);
        setNotice("Đã khôi phục bộ 3D đã lưu trên máy.");
      } else {
        await workspaceStorage(owner, "delete");
        if (version === generation.current) setNotice("Đã xóa bản lưu trên trình duyệt. Bộ đang mở vẫn giữ trong phiên này.");
      }
    } catch (e) {
      if (version === generation.current) setError(e instanceof Error ? e.message : "Không thể truy cập bộ lưu.");
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
      if (!manifest || manifest.size > 32 * 1024) throw new Error("Chọn manifest.json cùng các file GLB do PC xuất (manifest tối đa 32 KB).");
      if (new Set(list.map((f) => f.name)).size !== list.length) throw new Error("Tên file không được trùng.");
      const next = parseBundle(JSON.parse(await manifest.text()));
      const records = [next.avatar, ...next.garments];
      if (records.reduce((n, r) => n + (list.find((f) => f.name === r.file)?.size ?? 0), 0) > SESSION_BYTES)
        throw new Error("Tổng mô hình tối đa 120 MB cho phiên thử nghiệm.");
      const prepared: ModelAsset[] = [];
      for (const record of records) {
        const file = list.find((f) => f.name === record.file);
        if (!file || file.size > MAX_GLB_BYTES) throw new Error(`Thiếu ${record.file} hoặc file vượt 40 MB.`);
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
      if (generation.current === version) setError(e instanceof Error ? e.message : "Không thể mở bộ 3D.");
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
      setNotice(`“${item.name}” đang được dựng 3D. Bạn vẫn có thể phối món khác.`);
      return;
    }
    setOutfit((s) => choose(s, { [item.slot]: item.id }));
    if (item.status === "failed") {
      setOutfit((s) => itemFailed(s, scene.key, item.id));
      setNotice(`Lần chuẩn bị “${item.name}” bị lỗi. Thử lại ở trang Chuẩn bị 3D; bộ đang mặc được giữ nguyên.`);
      return;
    }
    if (item.status === "pending") setNotice(`“${item.name}” đang được chuẩn bị. Món này sẽ tự hiện nếu bạn vẫn chọn nó.`);
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
        setNotice("Đã lưu cả bộ (áo, quần, góc máy) vào tài khoản. Mở lại ở trang Gợi ý & look.");
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
    setNotice("Đã thêm look trong phiên. Bấm Lưu trên máy để giữ sau khi đóng trang.");
  }
  function openLocalLook(look: LocalLook) {
    apply(lookOutfit(look));
    if (look.camera) viewer.current?.setCamera(look.camera);
  }
  async function renderLookbook() {
    const blob = await viewer.current?.capture(shot);
    if (!blob) {
      setError("Chưa chụp được ảnh. Hãy đợi mô hình tải xong rồi thử lại.");
      return;
    }
    const name = [nameOf(outfit.shown.top)?.name, nameOf(outfit.shown.bottom)?.name].filter(Boolean).join(" + ") || "avatar";
    downloadBlob(blob, `fitmatch-lookbook-${name.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60)}-${shot.angle}.png`);
    setNotice("Đã lưu ảnh lookbook render từ chính avatar và bộ đồ đang hiển thị. Không dùng AI tạo ảnh.");
  }
  function exportSelection() {
    if (!bundle) return;
    downloadBlob(
      new Blob([JSON.stringify({ schemaVersion: 2, avatarId: bundle.avatar.id, outfit: outfit.shown, looks }, null, 2)], { type: "application/json" }),
      "fitmatch-look-selections.json",
    );
    setNotice("Đã xuất danh sách lựa chọn. File này không chứa mô hình 3D; hãy giữ bộ GLB gốc.");
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
      setError("Một món đồ không đọc được (GLB lỗi hoặc khác hệ trục). Bộ đang mặc được giữ nguyên.");
    },
    [sceneKeyValue],
  );
  return (
    <main className="min-h-screen pt-28 pb-10 px-4 lg:px-8 max-w-[1800px] mx-auto">
      <WorkspaceNav current="/studio" />
      <header className="flex flex-wrap items-end justify-between gap-5 mb-7">
        <div>
          <p className="text-accent-text uppercase tracking-[.25em] text-[10px] mb-2">Fitmatch / Personal fitting studio</p>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">Phòng thử đồ của bạn.</h1>
          <p className="text-sm text-fg-muted mt-3">Chọn áo và quần riêng. Đổi món này, món kia vẫn giữ.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCapture("avatar")} className={`${action} border border-border hover:bg-bg-raised`}>
            <Camera size={15} />
            Chuẩn bị avatar
          </button>
          <button disabled={busy || storageBusy} onClick={() => input.current?.click()} className={`${action} bg-accent hover:bg-accent-hover`}>
            <FolderOpen size={15} />
            {busy ? "Đang kiểm tra…" : "Mở bộ 3D từ PC"}
          </button>
        </div>
        <input ref={input} type="file" multiple accept=".json,.glb" className="hidden" aria-label="Chọn manifest và mô hình GLB" onChange={(e) => void load(e.target.files)} />
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
          Nghiên cứu · Mở kết quả trên tài khoản hoặc nhập bộ GLB từ PC.
        </span>
        <button disabled={!owner || storageBusy || busy} onClick={() => void persist("load")} className="text-accent-text disabled:opacity-40">
          {storageBusy ? "Đang truy cập bộ lưu…" : "Mở bản lưu trên máy"}
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
              Tủ đồ 3D <span className="text-fg-subtle text-xs ml-1">{items.length}</span>
            </h2>
            <Shirt size={18} className="text-fg-muted" />
          </div>
          <label className="relative block mb-3">
            <Search size={14} className="absolute left-3 top-3 text-fg-muted" />
            <input aria-label="Tìm đồ" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm áo, quần…" className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs bg-bg border border-border" />
          </label>
          <div role="group" aria-label="Lọc loại đồ" className="flex flex-wrap gap-1 mb-5">
            {[["all", "Tất cả"], ["t-shirt", "Áo thun"], ["shirt", "Sơ mi"], ["jeans", "Jeans"]].map(([id, label]) => (
              <button key={id} onClick={() => setCategory(id)} aria-pressed={category === id} className={`rounded-full px-3 py-2 text-[11px] ${category === id ? "bg-fg text-bg" : "text-fg-muted hover:bg-bg-raised"}`}>
                {label}
              </button>
            ))}
          </div>
          {scene ? (
            <div className="space-y-5">
              <button onClick={() => apply({ top: null, bottom: null })} aria-pressed={outfit.wanted.top === null && outfit.wanted.bottom === null} className={`w-full text-left text-xs p-3 rounded-xl border ${outfit.wanted.top === null && outfit.wanted.bottom === null ? "border-accent" : "border-border"}`}>
                Chỉ xem avatar
              </button>
              {SLOTS.map((slot) => {
                const list = visible.filter((i) => i.slot === slot);
                return (
                  <section key={slot} aria-label={`${SLOT_LABEL[slot]} trong tủ`}>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-[11px] uppercase tracking-widest text-fg-muted">{SLOT_LABEL[slot]}</h3>
                      {outfit.wanted[slot] && (
                        <button className="text-[11px] text-fg-muted underline underline-offset-2" onClick={() => apply({ ...outfit.wanted, [slot]: null })}>
                          Bỏ {SLOT_LABEL[slot].toLocaleLowerCase()}
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
                              {g.preset ? " · Mẫu (không thuộc tủ đồ)" : ""} · {STATUS_LABEL[g.status]}
                            </span>
                          </button>
                        );
                      })}
                      {list.length === 0 && <p className="text-xs text-fg-muted py-2">Không có món đồ phù hợp bộ lọc.</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center">
              <Shirt size={30} strokeWidth={1} className="mx-auto mb-4 text-fg-subtle" />
              <p className="text-sm text-fg-muted leading-6">Áo thun và jeans của bạn sẽ ở đây.</p>
              <p className="text-xs text-fg-subtle leading-5 mt-2">Trải phẳng, chụp rõ mặt trước và mặt sau.</p>
            </div>
          )}
          <div className="mt-auto pt-6 space-y-2">
            {([["t-shirt", "Thêm áo thun"], ["jeans", "Thêm jeans"], ["shirt", "Thêm sơ mi"]] as const).map(([kind, label]) => (
              <button key={kind} onClick={() => setCapture(kind)} className={`${action} w-full border border-border hover:bg-bg-raised`}>
                <Plus size={14} />
                {label}
              </button>
            ))}
            <Link href="/wardrobe" className="pt-3 flex justify-center items-center gap-2 text-xs text-accent-text">
              Tủ đồ ảnh <ArrowUpRight size={14} />
            </Link>
          </div>
        </aside>
        <section aria-label="Không gian thử đồ" className="min-w-0">
          {scene ? (
            <Viewer key={scene.key} avatar={scene.avatar} items={assets} shown={outfit.shown} onLoaded={onLoaded} onFailed={onFailed} controlRef={viewer} initialCamera={initialCamera} />
          ) : (
            <div className="min-h-[600px] lg:min-h-[660px] rounded-3xl bg-[#e4e4e0] text-neutral-800 flex flex-col justify-center items-center p-7 text-center relative overflow-hidden">
              <span className="absolute top-5 left-6 text-[10px] tracking-[.2em] text-neutral-500 uppercase">Your fitting space</span>
              <div className="max-w-sm">
                <div className="mx-auto mb-7 rounded-full bg-white/60 w-24 h-24 grid place-items-center">
                  <UserRound size={38} strokeWidth={1} />
                </div>
                <h2 className="font-display text-3xl font-semibold">Bắt đầu với avatar của bạn</h2>
                <p className="text-sm text-neutral-600 leading-6 mt-4">Tạo avatar hoặc thêm áo/quần trước đều được. Khi cả hai sẵn sàng, chọn áo và quần để mặc thử.</p>
                <button className="mt-7 bg-neutral-900 text-white rounded-full py-3 px-6 text-sm inline-flex items-center gap-2" onClick={() => setCapture("avatar")}>
                  <Camera size={15} />
                  Chuẩn bị ảnh avatar
                </button>
                <button className="block mx-auto mt-4 text-xs underline underline-offset-4 disabled:opacity-40" disabled={busy || storageBusy} onClick={() => input.current?.click()}>
                  Đã có kết quả? Mở bộ 3D từ PC
                </button>
              </div>
              <div className="mt-12 grid grid-cols-3 gap-5 w-full max-w-md text-left border-t border-neutral-400/30 pt-5">
                {[["01", "Avatar"], ["02", "Áo + quần"], ["03", "Phối & lưu"]].map(([n, title]) => (
                  <div key={n}>
                    <p className="text-[10px] text-neutral-500 mb-2">{n}</p>
                    <p className="text-xs font-medium">{title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-center text-xs text-fg-subtle mt-3">
            {scene ? "Kéo để xoay · Cuộn để zoom · Góc nhìn giữ nguyên khi đổi đồ" : "Tạo và gửi ảnh ở trang Chuẩn bị 3D, hoặc xuất ZIP để chuyển thủ công"}
          </p>
        </section>
        <aside className="space-y-4 lg:col-span-2 xl:col-span-1 grid lg:grid-cols-2 xl:block gap-4">
          <section className="border border-border rounded-3xl p-5 bg-bg-elevated">
            <p className="text-[10px] uppercase text-fg-muted tracking-widest mb-4">Look hiện tại</p>
            <dl className="space-y-2 text-sm" aria-label="Bộ đang mặc">
              {SLOTS.map((slot) => (
                <div key={slot} className="flex justify-between gap-3">
                  <dt className="text-fg-muted">{SLOT_LABEL[slot]}</dt>
                  <dd className="text-right break-words min-w-0">
                    {nameOf(outfit.shown[slot])?.name ?? "Trang phục gốc của avatar"}
                    {nameOf(outfit.shown[slot])?.preset ? " (mẫu)" : ""}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Giày</dt>
                <dd className="text-right text-fg-muted">Mẫu sẵn của avatar</dd>
              </div>
            </dl>
            {pending.length > 0 && (
              <p role="status" className="text-xs text-fg-muted mt-3 flex gap-2 items-center">
                <Loader2 size={12} className="animate-spin" aria-hidden />
                Đang chuẩn bị {pending.map((s) => SLOT_LABEL[s].toLocaleLowerCase()).join(" và ")}; bộ hiện tại giữ nguyên.
              </p>
            )}
            <button
              disabled={!scene}
              onClick={() => {
                setCompare(outfit.wanted);
                setNotice("Đã ghi nhớ look A. Chọn đồ khác rồi bấm So sánh A ↔ B.");
              }}
              className={`${action} mt-5 w-full border border-border`}
            >
              Ghi nhớ look A
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
              So sánh A ↔ B
            </button>
            <form onSubmit={(e) => void saveLook(e)} className="mt-5 border-t border-border pt-4">
              <label className="block text-xs text-fg-muted mb-2" htmlFor="look-name">
                Tên bộ phối
              </label>
              <input id="look-name" disabled={!scene} maxLength={80} value={lookName} onChange={(e) => setLookName(e.target.value)} placeholder="Đi cà phê cuối tuần" className="bg-bg rounded-xl border border-border p-3 text-xs w-full" />
              <button disabled={!scene || !lookName.trim() || pending.length > 0 || (scene.source === "local" && looks.length >= 30)} className={`${action} mt-2 w-full bg-accent`}>
                <Bookmark size={14} />
                {scene?.source === "cloud" ? "Lưu bộ vào tài khoản" : "Lưu look trong phiên"}
              </button>
              <p className="text-[10px] text-fg-subtle mt-2">
                {scene?.source === "cloud" ? "Lưu áo, quần, góc máy và đúng phiên bản 3D đang hiển thị." : "Tối đa 30 look / bộ 3D"}
              </p>
            </form>
            {looks.length > 0 && (
              <ul aria-label="Look đã lưu" className="mt-4 space-y-2">
                {looks.map((look) => (
                  <li key={look.id} className="flex gap-2 items-center border border-border rounded-xl p-2">
                    <button className="text-xs flex-1 text-left break-words min-w-0" onClick={() => openLocalLook(look)}>
                      {look.name}
                    </button>
                    <button aria-label={`Xóa look ${look.name}`} onClick={() => setLooks((prev) => prev.filter((l) => l.id !== look.id))} className="p-1 text-fg-muted">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="border border-border rounded-3xl p-5" aria-label="Ảnh lookbook">
            <h2 className="text-sm font-semibold">Ảnh lookbook</h2>
            <p className="text-xs text-fg-muted leading-5 mt-2">Render trực tiếp từ avatar và bộ đồ đang hiển thị; màu, logo và phom giữ nguyên, không dùng AI tạo ảnh.</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <label className="text-xs text-fg-muted">
                Góc máy
                <select aria-label="Góc máy lookbook" value={shot.angle} onChange={(e) => setShot((v) => ({ ...v, angle: e.target.value as LookbookShot["angle"] }))} className="mt-1 w-full bg-bg border border-border rounded-xl p-2 text-fg">
                  <option value="front">Trước</option>
                  <option value="side">Bên</option>
                  <option value="back">Sau</option>
                  <option value="current">Góc đang xem</option>
                </select>
              </label>
              <label className="text-xs text-fg-muted">
                Nền
                <select aria-label="Nền lookbook" value={shot.background} onChange={(e) => setShot((v) => ({ ...v, background: e.target.value as LookbookShot["background"] }))} className="mt-1 w-full bg-bg border border-border rounded-xl p-2 text-fg">
                  <option value="neutral">Trung tính</option>
                  <option value="white">Trắng</option>
                  <option value="dark">Tối</option>
                </select>
              </label>
            </div>
            <button disabled={!scene || pending.length > 0} onClick={() => void renderLookbook()} className={`${action} w-full border border-border mt-3`}>
              <Download size={14} />
              Lưu ảnh lookbook
            </button>
          </section>
          <div className="space-y-4">
            <section className="border border-border rounded-3xl p-5">
              <UserRound size={20} className="text-accent-text mb-3" />
              <h2 className="text-sm font-semibold break-words">{scene?.name ?? "Chưa có avatar"}</h2>
              <p className="text-xs text-fg-muted mt-2 leading-5">
                {scene?.source === "cloud"
                  ? "Avatar và đồ đã mặc thử nằm trên tài khoản. Mở lại look không chạy AI lần nữa."
                  : scene
                    ? "Bộ GLB nhập từ PC. Đóng bộ không xóa bản đã lưu trên máy."
                    : "Ảnh trước, bên, sau và chiều cao giúp kiểm tra hình dáng."}
              </p>
              <button onClick={() => setCapture("avatar")} className="text-xs text-accent-text mt-3">
                Chuẩn bị avatar mới
              </button>
              {scene && (
                <button onClick={reset} className="text-xs flex items-center gap-2 mt-4 text-fg-muted">
                  <RotateCcw size={13} />
                  Đóng bộ 3D
                </button>
              )}
            </section>
            <section className="border border-border rounded-3xl p-5">
              <HardDrive size={18} className="text-fg-muted mb-3" />
              <h2 className="text-sm font-semibold">Lưu riêng trên máy</h2>
              <p className="text-xs text-fg-muted leading-5 mt-2">
                Dành cho bộ GLB nhập từ PC. Bản lưu chỉ ở trình duyệt này, tách theo tài khoản; người dùng chung máy vẫn có thể truy cập dữ liệu trình duyệt.
              </p>
              <button disabled={!bundle || !owner || storageBusy || busy} onClick={() => void persist("save")} className={`${action} w-full border border-border mt-4`}>
                Lưu trên máy
              </button>
              <button disabled={!bundle} onClick={exportSelection} className="text-xs text-fg-muted flex items-center gap-2 mt-3">
                <Download size={13} />
                Xuất danh sách look
              </button>
              <button disabled={!owner || storageBusy} onClick={() => void persist("delete")} className="text-xs text-fg-muted mt-4 disabled:opacity-40">
                Xóa bản lưu trên máy
              </button>
            </section>
          </div>
        </aside>
      </div>
      {capture && <CaptureDrawer key={capture} kind={capture} onClose={() => setCapture(null)} />}
    </main>
  );
}
