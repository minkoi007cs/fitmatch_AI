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
    [listError, setListError] = useState("");
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
      });
    return () => {
      alive = false;
    };
  }, [requestedAvatar]);
  // A URL selection is explicit navigation intent; open it once, never again on re-render.
  useEffect(() => {
    if (requestedAvatar && opened.current !== requestedAvatar) {
      opened.current = requestedAvatar;
      open.current(requestedAvatar);
    }
  }, [requestedAvatar]);
  const message = error || listError;
  return (
    <section aria-label="Thư viện 3D trên tài khoản" className="rounded-2xl border border-border p-4 mb-5">
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
        <button disabled={busy || !selected} onClick={() => onOpen(selected)} className={button}>
          {busy ? "Đang tải bộ 3D…" : "Mở từ tài khoản"}
        </button>
        <Link href="/prepare" className="text-xs text-accent-text">
          Tạo avatar / thêm đồ & theo dõi xử lý →
        </Link>
      </div>
      {message && (
        <p role="alert" className="text-danger text-xs mt-3">
          {message}
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
