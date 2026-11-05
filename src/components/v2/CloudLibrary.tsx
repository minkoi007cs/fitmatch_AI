"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/v2/client";
import {
  validateGlb,
  MAX_GLB_BYTES,
  type StudioBundle,
} from "@/lib/studio/bundle";
import type { ModelRow } from "@/lib/v2/contracts";
import type { ModelAsset } from "@/components/studio/Viewer";
import { button } from "./WorkspaceNav";
type ModelResponse = {
  model: ModelRow;
  asset: { url: string; sha256: string; bytes: number } | null;
};
async function modelBytes(record: ModelResponse, signal: AbortSignal) {
  if (!record.asset)
    throw new Error("Model chưa sẵn sàng. Theo dõi ở trang Chuẩn bị 3D.");
  if (record.asset.bytes > MAX_GLB_BYTES)
    throw new Error("Model vượt giới hạn 40 MB.");
  const response = await fetch(record.asset.url, { signal });
  if (!response.ok)
    throw new Error("Không tải được model. Hãy mở lại để lấy liên kết mới.");
  // Stream with a byte limit: an incorrect storage response cannot allocate unlimited memory.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Kết quả 3D không có dữ liệu.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_GLB_BYTES) {
      await reader.cancel();
      throw new Error("Model vượt giới hạn 40 MB.");
    }
    chunks.push(value);
  }
  if (size !== record.asset.bytes)
    throw new Error("Kích thước model không khớp. Hãy tải lại.");
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== record.asset.sha256)
    throw new Error("Model không khớp bản đã xác minh.");
  validateGlb(buffer.buffer);
  return buffer.buffer;
}
export default function CloudLibrary({
  requestedAvatar,
  requestedFitting,
  onLoad,
  onStart,
}: {
  requestedAvatar?: string;
  requestedFitting?: string;
  onStart: () => number;
  onLoad: (
    bundle: StudioBundle,
    assets: ModelAsset[],
    selected: string | null,
    intent: number,
  ) => boolean;
}) {
  const [avatars, setAvatars] = useState<ModelRow[]>([]),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null),
    loaded = useRef(""),
    loader = useRef(onLoad),
    start = useRef(onStart);
  useEffect(() => {
    loader.current = onLoad;
    start.current = onStart;
  }, [onLoad, onStart]);
  useEffect(() => {
    let alive = true;
    void api<{ models: ModelRow[] }>("models")
      .then((d) => {
        if (alive) {
          const available = d.models.filter(
            (m) => m.kind === "avatar" && m.output_asset_id,
          );
          setAvatars(available);
          setSelected(requestedAvatar ?? available[0]?.id ?? "");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
      controller.current?.abort();
    };
  }, [requestedAvatar]);
  async function open(avatarId: string, fittingId?: string) {
    const intent = start.current();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const [avatar, all] = await Promise.all([
        api<ModelResponse>(`models/${avatarId}`),
        api<{ models: ModelRow[] }>("models"),
      ]);
      if (avatar.model.kind !== "avatar")
        throw new Error("Hãy chọn model avatar.");
      let fittings = all.models.filter(
        (m) =>
          m.kind === "fitting" && m.avatar_id === avatarId && m.output_asset_id,
      );
      if (fittingId) {
        const requested = await api<ModelResponse>(`models/${fittingId}`);
        if (
          requested.model.kind !== "fitting" ||
          requested.model.avatar_id !== avatarId ||
          !requested.asset
        )
          throw new Error("Lượt thử này chưa sẵn sàng hoặc thuộc avatar khác.");
        fittings = [
          requested.model,
          ...fittings.filter((f) => f.id !== fittingId),
        ];
      }
      const selectedFits: ModelResponse[] = [];
      let budget = avatar.asset?.bytes ?? 0;
      for (const fitting of fittings.slice(0, 12)) {
        const record = await api<ModelResponse>(`models/${fitting.id}`);
        if (!record.asset) continue;
        if (budget + record.asset.bytes > 120 * 1024 * 1024) continue;
        budget += record.asset.bytes;
        selectedFits.push(record);
      }
      if (fittingId && !selectedFits.some((f) => f.model.id === fittingId))
        throw new Error(
          "Bộ avatar và áo vượt giới hạn phiên 120 MB. Hãy giảm dung lượng GLB.",
        );
      const records = [avatar, ...selectedFits];
      const assets = await Promise.all(
        records.map(async (r) => ({
          id: r.model === avatar.model ? "avatar" : r.model.id,
          name: r.model.name,
          bytes: await modelBytes(r, abort.signal),
        })),
      );
      const bundle: StudioBundle = {
        version: 1,
        avatar: { id: avatarId, name: avatar.model.name, file: "avatar.glb" },
        garments: selectedFits.map((r, i) => ({
          id: r.model.id,
          name: r.model.name,
          file: `fitting-${i}.glb`,
          avatarId,
          category:
            all.models.find((m) => m.id === r.model.garment_id)?.params
              .category === "shirt"
              ? "shirt"
              : "t-shirt",
        })),
      };
      if (abort.signal.aborted) return;
      const accepted = loader.current(
        bundle,
        assets,
        fittingId ?? bundle.garments[0]?.id ?? null,
        intent,
      );
      if (!accepted) return;
      setNotice(
        `Đã mở avatar và ${selectedFits.length} áo đã mặc thử.${selectedFits.length < fittings.length ? " Một số áo chưa tải do giới hạn 12 áo / 120 MB. Mở từng look để xem." : ""}`,
      );
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error).message);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  // URL selection is explicit navigation intent; never overwrite an actively opened local bundle on polling.
  useEffect(() => {
    const key = `${requestedAvatar ?? ""}:${requestedFitting ?? ""}`;
    if (requestedAvatar && loaded.current !== key) {
      loaded.current = key;
      void open(requestedAvatar, requestedFitting);
    }
    // open reads only arguments and stable loader/controller refs.
  }, [requestedAvatar, requestedFitting]);
  return (
    <section
      aria-label="Thư viện 3D trên tài khoản"
      className="rounded-2xl border border-border p-4 mb-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-fg-muted">
          Avatar trên tài khoản
          <select
            aria-label="Avatar trên tài khoản"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="ml-3 bg-bg border border-border rounded-xl p-2 text-fg max-w-[240px]"
          >
            <option value="">Chưa có avatar sẵn sàng</option>
            {avatars.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={busy || !selected}
          onClick={() => void open(selected)}
          className={button}
        >
          {busy ? "Đang tải bộ 3D…" : "Mở từ tài khoản"}
        </button>
        <Link href="/prepare" className="text-xs text-accent-text">
          Tạo avatar / áo & theo dõi xử lý →
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-danger text-xs mt-3">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-success text-xs mt-3">
          {notice}
        </p>
      )}
    </section>
  );
}
