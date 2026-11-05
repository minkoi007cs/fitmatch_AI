"use client";

import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import {
  parseBundle,
  validateGlb,
  MAX_GLB_BYTES,
  type StudioBundle,
} from "@/lib/studio/bundle";
import {
  workspaceStorage,
  validateWorkspace,
  type LocalLook,
} from "@/lib/studio/workspace";
import { downloadBlob, type CaptureKind } from "@/lib/studio/capture";
import type { ModelAsset } from "@/components/studio/Viewer";
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

export default function Studio({
  requestedAvatar,
  requestedFitting,
}: {
  requestedAvatar?: string;
  requestedFitting?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [owner, setOwner] = useState("");
  const [capture, setCapture] = useState<CaptureKind | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [looks, setLooks] = useState<LocalLook[]>([]);
  const [notice, setNotice] = useState("");
  const [storageBusy, setStorageBusy] = useState(false);
  const [lookName, setLookName] = useState("");
  const [hasCompare, setHasCompare] = useState(false);
  const [revision, setRevision] = useState(0);
  const [bundle, setBundle] = useState<StudioBundle | null>(null);
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/session", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && typeof data.user?.id === "string")
          setOwner(data.user.id);
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
    };
  }, []);
  async function persist(action: "load" | "save" | "delete") {
    if (!owner || storageBusy) return;
    const version = generation.current;
    setStorageBusy(true);
    setError("");
    setNotice("");
    try {
      if (action === "save") {
        if (!bundle) return;
        await workspaceStorage(owner, "save", {
          version: 1,
          bundle,
          assets,
          looks,
        });
        if (version === generation.current)
          setNotice(
            "Đã lưu bộ 3D và các look trên trình duyệt này. Chưa đồng bộ lên tài khoản.",
          );
      } else if (action === "load") {
        const saved = await workspaceStorage(owner, "load");
        if (version !== generation.current) return;
        if (!saved) {
          setNotice(
            "Chưa có bộ 3D lưu trên trình duyệt này cho tài khoản hiện tại.",
          );
          return;
        }
        const w = validateWorkspace(saved);
        const nextVersion = ++generation.current;
        setRevision(nextVersion);
        setBundle(w.bundle);
        setAssets(w.assets);
        setLooks(w.looks);
        setSelected(null);
        setCompare(null);
        setHasCompare(false);
        setQuery("");
        setCategory("all");
        setNotice("Đã khôi phục bộ 3D đã lưu trên máy.");
      } else {
        await workspaceStorage(owner, "delete");
        if (version === generation.current)
          setNotice(
            "Đã xóa bản lưu trên trình duyệt. Bộ đang mở vẫn giữ trong phiên này.",
          );
      }
    } catch (e) {
      if (version === generation.current)
        setError(e instanceof Error ? e.message : "Không thể truy cập bộ lưu.");
    } finally {
      setStorageBusy(false);
    }
  }
  function saveLook(e: React.FormEvent) {
    e.preventDefault();
    if (!bundle || !lookName.trim() || looks.length >= 30) return;
    setLooks((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        name: lookName.trim(),
        garmentId: selected,
        createdAt: new Date().toISOString(),
      },
    ]);
    setLookName("");
    setNotice(
      "Đã thêm look trong phiên. Bấm Lưu trên máy để giữ sau khi đóng trang.",
    );
  }
  function exportSelection() {
    if (!bundle) return;
    downloadBlob(
      new Blob(
        [
          JSON.stringify(
            {
              schemaVersion: 1,
              avatarId: bundle.avatar.id,
              garmentId: selected,
              looks,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "fitmatch-look-selections.json",
    );
    setNotice(
      "Đã xuất danh sách lựa chọn. File này không chứa mô hình 3D; hãy giữ bộ GLB gốc.",
    );
  }
  async function load(files: FileList | null) {
    if (!files?.length) return;
    const version = ++generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const list = [...files];
      const manifest = list.find((f) => f.name === "manifest.json");
      if (!manifest || manifest.size > 32 * 1024)
        throw new Error(
          "Chọn manifest.json cùng các file GLB do PC xuất (manifest tối đa 32 KB).",
        );
      if (new Set(list.map((f) => f.name)).size !== list.length)
        throw new Error("Tên file không được trùng.");
      const next = parseBundle(JSON.parse(await manifest.text()));
      const records = [next.avatar, ...next.garments];
      if (
        records.reduce(
          (n, r) => n + (list.find((f) => f.name === r.file)?.size ?? 0),
          0,
        ) >
        120 * 1024 * 1024
      )
        throw new Error("Tổng mô hình tối đa 120 MB cho phiên thử nghiệm.");
      const prepared: ModelAsset[] = [];
      for (const record of records) {
        const file = list.find((f) => f.name === record.file);
        if (!file || file.size > MAX_GLB_BYTES)
          throw new Error(`Thiếu ${record.file} hoặc file vượt 40 MB.`);
        const bytes = await file.arrayBuffer();
        validateGlb(bytes);
        prepared.push({
          id: record === next.avatar ? "avatar" : record.id,
          name: record.name,
          bytes,
        });
      }
      if (generation.current !== version) return;
      setRevision(version);
      setBundle(next);
      setAssets(prepared);
      setSelected(null);
      setCompare(null);
      setHasCompare(false);
      setLooks([]);
      setQuery("");
      setCategory("all");
    } catch (e) {
      if (generation.current === version)
        setError(e instanceof Error ? e.message : "Không thể mở bộ 3D.");
    } finally {
      if (generation.current === version) setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  function reset() {
    generation.current++;
    setBusy(false);
    setBundle(null);
    setAssets([]);
    setSelected(null);
    setCompare(null);
    setHasCompare(false);
    setLooks([]);
    setError("");
    setNotice("");
  }
  const garment = bundle?.garments.find((g) => g.id === selected);
  const visibleGarments =
    bundle?.garments.filter(
      (g) =>
        (category === "all" || g.category === category) &&
        g.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    ) ?? [];
  const action =
    "inline-flex gap-2 items-center justify-center rounded-full px-4 py-2.5 text-xs font-medium disabled:opacity-40 transition-colors";
  return (
    <main className="min-h-screen pt-28 pb-10 px-4 lg:px-8 max-w-[1800px] mx-auto">
      <WorkspaceNav current="/studio" />
      <header className="flex flex-wrap items-end justify-between gap-5 mb-7">
        <div>
          <p className="text-accent-text uppercase tracking-[.25em] text-[10px] mb-2">
            Fitmatch / Personal fitting studio
          </p>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">
            Phòng thử đồ của bạn.
          </h1>
          <p className="text-sm text-fg-muted mt-3">
            Tủ đồ thật. Dáng người của bạn. Một góc nhìn mới.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCapture("avatar")}
            className={`${action} border border-border hover:bg-bg-raised`}
          >
            <Camera size={15} />
            Chuẩn bị avatar
          </button>
          <button
            disabled={busy || storageBusy}
            onClick={() => input.current?.click()}
            className={`${action} bg-accent hover:bg-accent-hover`}
          >
            <FolderOpen size={15} />
            {busy ? "Đang kiểm tra…" : "Mở bộ 3D từ PC"}
          </button>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept=".json,.glb"
          className="hidden"
          aria-label="Chọn manifest và mô hình GLB"
          onChange={(e) => void load(e.target.files)}
        />
      </header>
      <CloudLibrary
        requestedAvatar={requestedAvatar}
        requestedFitting={requestedFitting}
        onStart={() => {
          setBusy(false);
          return ++generation.current;
        }}
        onLoad={(next, prepared, chosen, nextVersion) => {
          if (nextVersion !== generation.current) return false;
          setRevision(nextVersion);
          setBundle(next);
          setAssets(prepared);
          setSelected(chosen);
          setCompare(null);
          setHasCompare(false);
          setLooks([]);
          setQuery("");
          setCategory("all");
          setError("");
          return true;
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 mb-5 text-xs text-fg-muted">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-text" />
          Nghiên cứu · Mở kết quả trên tài khoản hoặc nhập bộ GLB từ PC.
        </span>
        <button
          disabled={!owner || storageBusy || busy}
          onClick={() => void persist("load")}
          className="text-accent-text disabled:opacity-40"
        >
          {storageBusy ? "Đang truy cập bộ lưu…" : "Mở bản lưu trên máy"}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="text-danger mb-4 rounded-xl border border-danger/30 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-success mb-4 text-sm">
          {notice}
        </p>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)_260px] lg:grid-cols-[220px_minmax(0,1fr)] gap-5 items-start">
        <aside className="rounded-3xl border border-border bg-bg-elevated p-5 lg:min-h-[660px] flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-semibold">
              Tủ áo 3D{" "}
              <span className="text-fg-subtle text-xs ml-1">
                {bundle?.garments.length ?? 0}
              </span>
            </h2>
            <Shirt size={18} className="text-fg-muted" />
          </div>
          <label className="relative block mb-3">
            <Search size={14} className="absolute left-3 top-3 text-fg-muted" />
            <input
              aria-label="Tìm áo"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm chiếc áo…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs bg-bg border border-border"
            />
          </label>
          <div
            role="group"
            aria-label="Lọc loại áo"
            className="flex gap-1 mb-5"
          >
            {[
              ["all", "Tất cả"],
              ["t-shirt", "Áo thun"],
              ["shirt", "Sơ mi"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setCategory(id)}
                aria-pressed={category === id}
                className={`rounded-full px-3 py-2 text-[11px] ${category === id ? "bg-fg text-bg" : "text-fg-muted hover:bg-bg-raised"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {bundle ? (
            <div className="space-y-2">
              <button
                onClick={() => setSelected(null)}
                aria-pressed={selected === null}
                className={`w-full text-left text-xs p-3 rounded-xl border ${selected === null ? "border-accent" : "border-border"}`}
              >
                Chỉ xem avatar
              </button>
              {visibleGarments.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelected(g.id)}
                  aria-pressed={selected === g.id}
                  className={`w-full text-left rounded-2xl border p-4 ${selected === g.id ? "border-accent bg-accent-soft" : "border-border hover:bg-bg-raised"}`}
                >
                  <span className="flex justify-between items-center gap-2 text-sm">
                    <span className="break-words min-w-0">{g.name}</span>
                    {selected === g.id && (
                      <Check size={14} className="shrink-0" />
                    )}
                  </span>
                  <span className="text-xs text-fg-muted block mt-2">
                    {g.category === "shirt" ? "Sơ mi" : "Áo thun"} · Đã tải
                  </span>
                </button>
              ))}
              {visibleGarments.length === 0 && (
                <p className="text-xs text-fg-muted py-5">
                  Không có áo phù hợp bộ lọc.
                </p>
              )}
            </div>
          ) : (
            <div className="py-6 text-center">
              <Shirt
                size={30}
                strokeWidth={1}
                className="mx-auto mb-4 text-fg-subtle"
              />
              <p className="text-sm text-fg-muted leading-6">
                Những chiếc áo của bạn sẽ ở đây.
              </p>
              <p className="text-xs text-fg-subtle leading-5 mt-2">
                Bắt đầu với áo thun hoặc sơ mi, chụp rõ cả hai mặt.
              </p>
            </div>
          )}
          <div className="mt-auto pt-6 space-y-2">
            <button
              onClick={() => setCapture("t-shirt")}
              className={`${action} w-full border border-border hover:bg-bg-raised`}
            >
              <Plus size={14} />
              Thêm áo thun
            </button>
            <button
              onClick={() => setCapture("shirt")}
              className={`${action} w-full border border-border hover:bg-bg-raised`}
            >
              <Plus size={14} />
              Thêm sơ mi
            </button>
            <Link
              href="/wardrobe"
              className="pt-3 flex justify-center items-center gap-2 text-xs text-accent-text"
            >
              Tủ đồ ảnh <ArrowUpRight size={14} />
            </Link>
          </div>
        </aside>
        <section aria-label="Không gian thử đồ" className="min-w-0">
          {bundle ? (
            <Viewer key={revision} assets={assets} selected={selected} />
          ) : (
            <div className="min-h-[600px] lg:min-h-[660px] rounded-3xl bg-[#deded8] text-neutral-800 flex flex-col justify-center items-center p-7 text-center relative overflow-hidden">
              <span className="absolute top-5 left-6 text-[10px] tracking-[.2em] text-neutral-500 uppercase">
                Your fitting space
              </span>
              <div className="max-w-sm">
                <div className="mx-auto mb-7 rounded-full bg-white/60 w-24 h-24 grid place-items-center">
                  <UserRound size={38} strokeWidth={1} />
                </div>
                <h2 className="font-display text-3xl font-semibold">
                  Bắt đầu với avatar của bạn
                </h2>
                <p className="text-sm text-neutral-600 leading-6 mt-4">
                  Chuẩn bị bộ ảnh cơ thể để PC dựng avatar, sau đó mở kết quả và
                  thử những chiếc áo bạn yêu thích.
                </p>
                <button
                  className="mt-7 bg-neutral-900 text-white rounded-full py-3 px-6 text-sm inline-flex items-center gap-2"
                  onClick={() => setCapture("avatar")}
                >
                  <Camera size={15} />
                  Chuẩn bị ảnh avatar
                </button>
                <button
                  className="block mx-auto mt-4 text-xs underline underline-offset-4 disabled:opacity-40"
                  disabled={busy || storageBusy}
                  onClick={() => input.current?.click()}
                >
                  Đã có kết quả? Mở bộ 3D từ PC
                </button>
              </div>
              <div className="mt-12 grid grid-cols-3 gap-5 w-full max-w-md text-left border-t border-neutral-400/30 pt-5">
                {[
                  ["01", "Ảnh cơ thể"],
                  ["02", "Áo của bạn"],
                  ["03", "Mặc thử 3D"],
                ].map(([n, title]) => (
                  <div key={n}>
                    <p className="text-[10px] text-neutral-500 mb-2">{n}</p>
                    <p className="text-xs font-medium">{title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-center text-xs text-fg-subtle mt-3">
            {bundle
              ? "Kéo để xoay · Cuộn để zoom · Góc nhìn và ánh sáng giữ nguyên khi thay áo"
              : "Tạo và gửi ảnh ở trang Chuẩn bị 3D, hoặc xuất ZIP để chuyển thủ công"}
          </p>
        </section>
        <aside className="space-y-4 lg:col-span-2 xl:col-span-1 grid lg:grid-cols-2 xl:block gap-4">
          <section className="border border-border rounded-3xl p-5 bg-bg-elevated">
            <p className="text-[10px] uppercase text-fg-muted tracking-widest mb-4">
              Look hiện tại
            </p>
            <h2 className="font-display text-2xl break-words">
              {garment?.name ?? "Avatar nguyên bản"}
            </h2>
            <p className="text-xs text-fg-muted leading-5 mt-3">
              {bundle
                ? "So sánh hai lựa chọn trên cùng avatar trước khi quyết định."
                : "Mở bộ 3D để bắt đầu thử và lưu các lựa chọn."}
            </p>
            <button
              disabled={!bundle}
              onClick={() => {
                setCompare(selected);
                setHasCompare(true);
                setNotice(
                  "Đã ghi nhớ look A. Chọn áo khác rồi bấm So sánh A ↔ B.",
                );
              }}
              className={`${action} mt-5 w-full border border-border`}
            >
              Ghi nhớ look A
            </button>
            <button
              disabled={!bundle || !hasCompare}
              onClick={() => {
                const previous = selected;
                setSelected(compare);
                setCompare(previous);
              }}
              className={`${action} mt-2 w-full border border-border`}
            >
              So sánh A ↔ B
            </button>
            <form
              onSubmit={saveLook}
              className="mt-5 border-t border-border pt-4"
            >
              <label
                className="block text-xs text-fg-muted mb-2"
                htmlFor="look-name"
              >
                Tên bộ phối
              </label>
              <input
                id="look-name"
                disabled={!bundle}
                maxLength={80}
                value={lookName}
                onChange={(e) => setLookName(e.target.value)}
                placeholder="Đi cà phê cuối tuần"
                className="bg-bg rounded-xl border border-border p-3 text-xs w-full"
              />
              <button
                disabled={!bundle || !lookName.trim() || looks.length >= 30}
                className={`${action} mt-2 w-full bg-accent`}
              >
                <Bookmark size={14} />
                Lưu look trong phiên
              </button>
              <p className="text-[10px] text-fg-subtle mt-2">
                Tối đa 30 look / bộ 3D
              </p>
            </form>
            {looks.length > 0 && (
              <ul aria-label="Look đã lưu" className="mt-4 space-y-2">
                {looks.map((look) => (
                  <li
                    key={look.id}
                    className="flex gap-2 items-center border border-border rounded-xl p-2"
                  >
                    <button
                      className="text-xs flex-1 text-left break-words min-w-0"
                      onClick={() => setSelected(look.garmentId)}
                    >
                      {look.name}
                    </button>
                    <button
                      aria-label={`Xóa look ${look.name}`}
                      onClick={() =>
                        setLooks((prev) => prev.filter((l) => l.id !== look.id))
                      }
                      className="p-1 text-fg-muted"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="space-y-4">
            <section className="border border-border rounded-3xl p-5">
              <UserRound size={20} className="text-accent-text mb-3" />
              <h2 className="text-sm font-semibold break-words">
                {bundle?.avatar.name ?? "Chưa có avatar"}
              </h2>
              <p className="text-xs text-fg-muted mt-2 leading-5">
                {bundle
                  ? "Avatar và áo thuộc cùng một bộ kết quả. Đóng bộ không xóa bản đã lưu trên máy."
                  : "Ảnh trước, bên, sau và chiều cao giúp kiểm tra hình dáng."}
              </p>
              <button
                onClick={() => setCapture("avatar")}
                className="text-xs text-accent-text mt-3"
              >
                Chuẩn bị avatar mới
              </button>
              {bundle && (
                <button
                  onClick={reset}
                  className="text-xs flex items-center gap-2 mt-4 text-fg-muted"
                >
                  <RotateCcw size={13} />
                  Đóng bộ 3D
                </button>
              )}
            </section>
            <section className="border border-border rounded-3xl p-5">
              <HardDrive size={18} className="text-fg-muted mb-3" />
              <h2 className="text-sm font-semibold">Lưu riêng trên máy</h2>
              <p className="text-xs text-fg-muted leading-5 mt-2">
                Bản lưu chỉ ở trình duyệt này, tách theo tài khoản. Không đồng
                bộ sang thiết bị khác; người dùng chung máy vẫn có thể truy cập
                dữ liệu trình duyệt.
              </p>
              <button
                disabled={!bundle || !owner || storageBusy || busy}
                onClick={() => void persist("save")}
                className={`${action} w-full border border-border mt-4`}
              >
                Lưu trên máy
              </button>
              <button
                disabled={!bundle}
                onClick={exportSelection}
                className="text-xs text-fg-muted flex items-center gap-2 mt-3"
              >
                <Download size={13} />
                Xuất danh sách look
              </button>
              <button
                disabled={!owner || storageBusy}
                onClick={() => void persist("delete")}
                className="text-xs text-fg-muted mt-4 disabled:opacity-40"
              >
                Xóa bản lưu trên máy
              </button>
            </section>
          </div>
        </aside>
      </div>
      {capture && (
        <CaptureDrawer
          key={capture}
          kind={capture}
          onClose={() => setCapture(null)}
        />
      )}
    </main>
  );
}
