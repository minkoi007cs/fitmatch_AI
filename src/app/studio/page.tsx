"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Box, FolderOpen, RotateCcw, Shirt, ArrowUpRight, Check, UserRound } from "lucide-react";
import { parseBundle, validateGlb, MAX_GLB_BYTES, type StudioBundle } from "@/lib/studio/bundle";
import type { ModelAsset } from "@/components/studio/Viewer";
const Viewer = dynamic(() => import("@/components/studio/Viewer"), { ssr: false, loading: () => <div className="grid place-items-center h-[600px] text-fg-muted">Đang mở Studio…</div> });

export default function StudioPage() {
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [revision, setRevision] = useState(0);
  const [bundle, setBundle] = useState<StudioBundle | null>(null);
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load(files: FileList | null) {
    if (!files?.length) return;
    const version = ++generation.current;
    setBusy(true); setError("");
    try {
      const list = [...files];
      const manifest = list.find(f => f.name === "manifest.json");
      if (!manifest || manifest.size > 32 * 1024) throw new Error("Chọn manifest.json cùng các file GLB do PC xuất (manifest tối đa 32 KB).");
      if (new Set(list.map(f => f.name)).size !== list.length) throw new Error("Tên file không được trùng.");
      const next = parseBundle(JSON.parse(await manifest.text()));
      const records = [next.avatar, ...next.garments];
      if (records.reduce((n, r) => n + (list.find(f => f.name === r.file)?.size ?? 0), 0) > 120 * 1024 * 1024) throw new Error("Tổng mô hình tối đa 120 MB cho phiên thử nghiệm.");
      const prepared: ModelAsset[] = [];
      for (const record of records) {
        const file = list.find(f => f.name === record.file);
        if (!file || file.size > MAX_GLB_BYTES) throw new Error(`Thiếu ${record.file} hoặc file vượt 40 MB.`);
        const bytes = await file.arrayBuffer(); validateGlb(bytes);
        prepared.push({ id: record === next.avatar ? "avatar" : record.id, name: record.name, bytes });
      }
      if (generation.current !== version) return;
      setRevision(version); setBundle(next); setAssets(prepared); setSelected(null); setCompare(null);
    } catch (e) { if (generation.current === version) setError(e instanceof Error ? e.message : "Không thể mở bộ 3D."); }
    finally { if (generation.current === version) setBusy(false); if (input.current) input.current.value = ""; }
  }
  function reset() { generation.current++; setBusy(false); setBundle(null); setAssets([]); setSelected(null); setCompare(null); setError(""); }
  const garment = bundle?.garments.find(g => g.id === selected);
  return <main className="min-h-screen pt-28 pb-10 px-5 lg:px-8 max-w-[1800px] mx-auto">
    <header className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div><p className="text-accent-text uppercase tracking-[.25em] text-[10px] mb-2">Fitmatch / 3D workspace</p><h1 className="font-display text-4xl lg:text-5xl font-bold">Phòng thử đồ của bạn.</h1><p className="text-sm text-fg-muted mt-3">Một avatar. Những chiếc áo của bạn. Mọi góc nhìn.</p></div>
      <button disabled={busy} onClick={() => input.current?.click()} className="inline-flex gap-2 items-center rounded-full bg-accent px-5 py-3 text-sm font-semibold disabled:opacity-50"><FolderOpen size={16}/>{busy ? "Đang kiểm tra…" : "Mở bộ 3D từ PC"}</button>
      <input ref={input} type="file" multiple accept=".json,.glb" className="hidden" aria-label="Chọn manifest và mô hình GLB" onChange={e => void load(e.target.files)} />
    </header>
    <p className="text-xs text-fg-muted border border-border rounded-xl px-4 py-3 mb-5">Bản nghiên cứu · Mở các file đã dựng trên PC để kiểm tra 3D. Dữ liệu chỉ nằm trong phiên trình duyệt, chưa upload hay lưu vào tài khoản. Chuyển ảnh thành avatar/áo đang chờ tích hợp engine GPU.</p>
    {error && <p role="alert" className="text-danger mb-4">{error}</p>}
    <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_240px] gap-5">
      <aside className="rounded-3xl border border-border bg-bg-elevated p-5">
        <div className="flex justify-between mb-6"><h2 className="font-semibold">Áo đã chuẩn bị</h2><Shirt size={18} className="text-fg-muted"/></div>
        {bundle ? <div className="space-y-2"><button onClick={() => setSelected(null)} aria-pressed={selected === null} className="w-full text-left text-sm p-3 rounded-xl border border-border">Chỉ xem avatar</button>{bundle.garments.map(g => <button key={g.id} onClick={() => setSelected(g.id)} aria-pressed={selected === g.id} className={`w-full text-left rounded-2xl border p-4 ${selected === g.id ? "border-accent bg-accent-soft" : "border-border hover:bg-bg-raised"}`}><span className="flex justify-between items-center text-sm">{g.name}{selected === g.id && <Check size={14}/>}</span><span className="text-xs text-fg-muted block mt-2">{g.category === "shirt" ? "Sơ mi" : "Áo thun"} · Sẵn sàng</span></button>)}</div> : <p className="text-sm text-fg-muted leading-6">Áo thun và sơ mi sẽ xuất hiện ở đây khi bạn mở kết quả từ PC.</p>}
        <Link href="/wardrobe" className="mt-7 flex items-center gap-2 text-xs text-accent-text">Mở tủ đồ ảnh <ArrowUpRight size={14}/></Link>
      </aside>
      {bundle ? <Viewer key={revision} assets={assets} selected={selected}/> : <div className="min-h-[600px] rounded-3xl bg-[#deded8] text-neutral-800 grid place-items-center p-10 text-center"><div className="max-w-sm"><div className="mx-auto mb-6 rounded-full bg-white/60 w-20 h-20 grid place-items-center"><Box size={32} strokeWidth={1}/></div><h2 className="font-display text-3xl font-semibold">Bắt đầu với avatar của bạn</h2><p className="text-sm text-neutral-600 leading-6 mt-4">Sau khi PC dựng avatar và áo, mở manifest.json cùng các file GLB để xoay, phóng to và thay áo.</p><button className="mt-6 border border-neutral-400 rounded-full py-3 px-6 text-sm disabled:opacity-50" disabled={busy} onClick={() => input.current?.click()}>Chọn kết quả từ PC</button><p className="text-xs mt-5 text-neutral-500">Dùng kết quả avatar cá nhân từ PC.</p></div></div>}
      <aside className="space-y-5"><section className="border border-border rounded-3xl p-5 bg-bg-elevated"><p className="text-xs uppercase text-fg-muted tracking-widest mb-4">Look hiện tại</p><h2 className="font-display text-2xl">{garment?.name ?? "Avatar nguyên bản"}</h2><p className="text-xs text-fg-muted leading-5 mt-3">Các áo đã drape dùng chung hệ tọa độ với avatar. Chọn áo để đổi mesh đã tải, không gọi AI lại.</p><button disabled={!bundle} onClick={() => { setCompare(selected); }} className="mt-5 w-full rounded-full border border-border py-3 text-xs disabled:opacity-40">Ghi nhớ look A</button><button disabled={!bundle} onClick={() => { const previous = selected; setSelected(compare); setCompare(previous); }} className="mt-2 w-full rounded-full border border-border py-3 text-xs disabled:opacity-40">So sánh A ↔ B</button></section>
      <section className="border border-border rounded-3xl p-5"><UserRound size={20} className="text-accent-text mb-3"/><h2 className="text-sm font-semibold">{bundle?.avatar.name ?? "Chưa có avatar"}</h2><p className="text-xs text-fg-muted mt-2">Giữ ảnh trước / bên / sau và chiều cao để PC kiểm tra tỉ lệ.</p><button onClick={reset} className="text-xs flex items-center gap-2 mt-4 text-fg-muted"><RotateCcw size={13}/>Đóng bộ 3D</button></section></aside>
    </div>
  </main>;
}
