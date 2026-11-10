"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/v2/client";
import type { ModelRow } from "@/lib/v2/contracts";
import { button } from "./WorkspaceNav";

/** Avatar picker for the account library. Loading/selection logic lives in the Studio. */
export default function CloudLibrary({
  requestedAvatar,
  busy,
  error,
  notice,
  onOpen,
}: {
  requestedAvatar?: string;
  busy: boolean;
  error: string;
  notice: string;
  onOpen: (avatarId: string) => void;
}) {
  const [avatars, setAvatars] = useState<ModelRow[]>([]),
    [selected, setSelected] = useState(""),
    [listError, setListError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const opened = useRef("");
  const open = useRef(onOpen);
  useEffect(() => {
    open.current = onOpen;
  }, [onOpen]);
  useEffect(() => {
    let alive = true;
    void api<{ models: ModelRow[] }>("models")
      .then((d) => {
        if (!alive) return;
        const available = d.models.filter((m) => m.kind === "avatar" && m.output_asset_id);
        setAvatars(available);
        setSelected(requestedAvatar ?? available[0]?.id ?? "");
      })
      .catch((e) => {
        if (alive) setListError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [requestedAvatar, revision]);
  // A URL selection is explicit navigation intent; open it once, never again on re-render.
  useEffect(() => {
    if (requestedAvatar && opened.current !== requestedAvatar) {
      opened.current = requestedAvatar;
      open.current(requestedAvatar);
    }
  }, [requestedAvatar]);
  const message = error || listError;
  return (
    <section aria-label="Thư viện 3D trên tài khoản" aria-busy={loading || busy} className="rounded-2xl border border-border p-4 mb-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex w-full flex-col gap-2 text-xs text-fg-muted sm:w-auto sm:flex-row sm:items-center">
          Avatar trên tài khoản
          <select
            aria-label="Avatar trên tài khoản"
            disabled={loading || busy || !avatars.length}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="min-h-11 w-full bg-bg border border-border rounded-xl p-2 text-fg sm:max-w-[240px] disabled:opacity-60"
          >
            <option value="">{loading ? "Đang tải avatar…" : listError ? "Chưa tải được thư viện" : avatars.length ? "Chọn avatar" : "Chưa có avatar sẵn sàng"}</option>
            {avatars.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy || !selected} onClick={() => onOpen(selected)} className={button}>
          {busy ? "Đang tải bộ 3D…" : "Mở từ tài khoản"}
        </button>
        <Link href="/prepare" className="text-xs text-accent-text">
          Tạo avatar / thêm đồ & theo dõi xử lý →
        </Link>
      </div>
      {message && (
        <div role="alert" className="mt-4 border-t border-border pt-4 text-sm">
          <p className="text-danger">{message}</p>
          <p className="mt-2 text-xs leading-5 text-fg-muted">Bạn vẫn có thể quản lý tủ đồ ảnh hoặc mở bộ 3D đã xuất từ PC.</p>
          <div className="mt-3 flex flex-wrap gap-3 items-center">
            <button disabled={loading || busy} className={button} onClick={() => { setListError(""); setLoading(true); setRevision((v) => v + 1); }}>Thử tải lại thư viện</button>
            <Link href="/wardrobe" className="inline-flex min-h-11 items-center text-xs text-accent-text">Về tủ đồ ảnh →</Link>
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className="text-success text-xs mt-3">
          {notice}
        </p>
      )}
    </section>
  );
}
