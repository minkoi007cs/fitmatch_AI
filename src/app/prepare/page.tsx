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
        if (!r.ok) throw new Error("Không tải được tủ đồ.");
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
          ? "Đã tạo lượt mặc thử mới. Phiên bản cũ được giữ lại."
          : command === "retry"
          ? "Đã đưa tác vụ trở lại hàng đợi."
          : "Đã hủy tác vụ. Kết quả đến muộn sẽ không được công bố.",
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
            Từ ảnh đến phòng thử đồ.
          </h1>
          <p className="mt-4 text-fg-muted text-sm max-w-xl leading-6">
            Chuẩn bị avatar, áo thun và jeans. Kết quả đã xử lý sẽ được
            giữ lại để bạn mặc thử nhanh trong Studio.
          </p>
        </div>
        <button onClick={() => void refresh()} className={button}>
          <RefreshCw size={15} />
          Làm mới
        </button>
      </header>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-danger/40 p-4 text-danger text-sm"
        >
          <p>{error}</p>
          {!data && <p className="mt-2 text-fg-muted text-xs leading-6">Chưa thể tải thư viện 3D. Bạn vẫn có thể <Link href="/wardrobe" className="text-accent-text underline">thêm đồ vào tủ</Link> hoặc <Link href="/studio" className="text-accent-text underline">mở bộ 3D từ PC trong Studio</Link>. Bấm Làm mới để kiểm tra lại.</p>}
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
            ? error ? "Chưa kiểm tra được trạng thái xử lý" : "Đang kiểm tra máy xử lý…"
            : data.connected
              ? "Máy xử lý đã kết nối"
              : "Máy xử lý đang ngoại tuyến · tác vụ mới sẽ chờ"}
        </span>
        <span className="text-fg-muted text-xs">
          {data?.online
            .map(
              (c) =>
                ({
                  "avatar.reconstruct": "Dựng người",
                  "garment.reconstruct": "Dựng áo",
                  "garment.drape": "Mặc thử áo",
                  "bottom.reconstruct": "Dựng quần",
                  "bottom.drape": "Mặc thử quần",
                })[c] ?? c,
            )
            .join(" · ") || "Chưa có năng lực xử lý được xác nhận"}
        </span>
      </div>
      <div className="grid lg:grid-cols-2 gap-5 mb-10">
        <section className={panel}>
          <Camera className="text-accent-text mb-5" />
          <p className="text-xs text-fg-muted mb-2">01 / Cơ thể của bạn</p>
          <h2 className="font-display text-2xl">Tạo avatar</h2>
          <p className="text-sm text-fg-muted leading-6 my-4">
            Ảnh toàn thân trước, bên và sau, cùng chiều cao. Mặc đồ ôm vừa và
            chụp trong ánh sáng đều.
          </p>
          <button
            disabled={!data}
            onClick={() => setCapture("avatar")}
            className={`${button} bg-accent text-bg`}
          >
            Thêm ảnh cơ thể
          </button>
        </section>
        <section className={panel}>
          <Shirt className="text-accent-text mb-5" />
          <p className="text-xs text-fg-muted mb-2">02 / Áo thun và jeans thật</p>
          <h2 className="font-display text-2xl">Đưa đồ vào không gian 3D</h2>
          <label className="block text-sm mt-4">
            Món đồ trong tủ
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className={field}
            >
              <option value="">Chọn áo thun, sơ mi hoặc jeans</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} · {i.category === "jeans" ? "Jeans" : i.category === "shirt" ? "Sơ mi" : "Áo thun"}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-fg-muted my-3">
            Chụp mặt trước / sau trên nền trơn; thêm ảnh logo/túi nếu cần. Áo và quần được xử lý riêng, không cần avatar trước.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={!item || !data}
              onClick={() => setCapture("garment")}
              className={button}
            >
              Thêm ảnh món đồ
            </button>
            <Link
              href="/wardrobe"
              className="text-accent-text text-xs inline-flex items-center gap-1"
            >
              Thêm đồ vào tủ <ArrowUpRight size={13} />
            </Link>
          </div>
        </section>
      </div>
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-2xl">Thư viện & tiến độ</h2>
          <Link href="/looks" className="text-accent-text text-sm">
            Chọn áo để mặc thử →
          </Link>
        </div>
        {data?.models.length === 0 && (
          <div className={`${panel} text-fg-muted text-sm`}>
            Chưa có kết quả 3D. Bạn có thể bắt đầu bằng ảnh avatar hoặc thêm ảnh áo thun và jeans từ tủ đồ.
          </div>
        )}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data?.models.map((m) => {
            const j = data.jobs.find((j) => j.model_id === m.id);
            return (
              <article className={panel} key={m.id}>
                <p className="text-xs text-fg-muted mb-3">
                  {kindLabel[m.kind]} ·{" "}
                  {new Date(m.created_at).toLocaleDateString("vi-VN")}
                </p>
                <h3 className="text-lg break-words font-medium">{m.name}</h3>
                <p
                  role="status"
                  className={`text-sm mt-4 ${m.output_asset_id ? "text-success" : "text-fg-muted"}`}
                >
                  {m.output_asset_id
                    ? "Sẵn sàng"
                    : stateLabel[j?.state ?? "queued"]}
                </p>
                {j?.stage && j.state === "running" && (
                  <p className="text-xs text-fg-muted mt-2">
                    {(
                      {
                        starting: "Khởi động",
                        preprocessing: "Chuẩn bị ảnh",
                        reconstructing: "Dựng hình",
                        texturing: "Tạo bề mặt",
                        draping: "Mô phỏng áo",
                        exporting: "Xuất model",
                        uploading: "Tải kết quả",
                      } as Record<string, string>
                    )[j.stage] ?? "Đang xử lý"}
                  </p>
                )}
                {j?.error_code && (
                  <p className="text-xs text-danger mt-2">
                    {(
                      {
                        OOM: "GPU thiếu bộ nhớ. Cần điều chỉnh cấu hình máy xử lý.",
                        MODEL_UNAVAILABLE:
                          "Máy xử lý chưa sẵn sàng cho loại model này.",
                        LEASE_EXPIRED: "Mất kết nối máy xử lý.",
                        SOURCE_DELETED: "Đã hủy vì ảnh/video gốc đã bị xóa.",
                      } as Record<string, string>
                    )[j.error_code] ?? "Tác vụ chưa tạo được kết quả hợp lệ."}
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
                      Mở trong Studio
                    </Link>
                  )}
                  {j && ["queued", "running"].includes(j.state) && (
                    <button
                      disabled={busy}
                      onClick={() => void action(j.id, "cancel")}
                      className="text-sm text-fg-muted underline"
                    >
                      Hủy
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
                        Thử lại
                      </button>
                    )}
                  {j && m.kind === "fitting" && !m.superseded_by && !m.output_asset_id &&
                    ["failed", "canceled"].includes(j.state) && j.attempt >= 3 && j.error_code !== "SOURCE_DELETED" && (
                    <button disabled={busy} className={button} onClick={() => void action(j.id, "regenerate")}>
                      Tạo lượt mặc thử mới
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
