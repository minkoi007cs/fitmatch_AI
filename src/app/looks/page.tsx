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
    [loaded, setLoaded] = useState(false);
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
          if (!r.ok) throw new Error("Không tải được tủ đồ.");
          return r.json();
        }),
        api<{ feedback: { item_id: string; value: "like" | "skip" }[] }>(
          "feedback",
        ),
      ]);
      if (alive.current) {
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
            Gu của bạn. Áo của bạn.
          </h1>
          <p className="text-sm text-fg-muted leading-6 mt-4 max-w-xl">
            Ba lựa chọn từ tủ đồ, dựa trên phong cách, màu sắc và dịp mặc. Bản
            nghiên cứu bắt đầu với áo thun và sơ mi.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/quiz" className={button}>
            Chỉnh gu
          </Link>
          <button
            disabled={busy || !loaded}
            onClick={() =>
              void run(async () => {
                await api("recommendations", {});
                setNotice(
                  "Đã cập nhật theo tủ đồ và hồ sơ phong cách mới nhất.",
                );
              })
            }
            className={`${button} bg-accent text-bg`}
          >
            <RefreshCw size={14} />
            Gợi ý lại
          </button>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="mb-5 text-danger text-sm rounded-xl border border-danger/40 p-4"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-5 text-success text-sm">
          {notice}
        </p>
      )}
      <div className="grid md:grid-cols-[1fr_1fr] gap-5 mb-7">
        <label className={`${panel} block text-sm`}>
          Mặc thử trên avatar
          <select
            value={avatarId}
            onChange={(e) => setAvatarId(e.target.value)}
            className={field}
          >
            <option value="">Chưa có avatar sẵn sàng</option>
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
            Chỉ áo đã dựng và mặc thử xong mới mở được 3D. Lần đầu có thể cần
            chờ GPU; lần sau dùng lại kết quả của đúng avatar và áo.
          </p>
          <Link
            href="/prepare"
            className="text-accent-text inline-flex items-center gap-1 mt-2"
          >
            Chuẩn bị avatar & áo <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
      {!loaded && !error && (
        <p role="status" className={`${panel} text-fg-muted`}>
          Đang mở tủ đồ của bạn…
        </p>
      )}
      {loaded && !rec && (
        <section className={panel}>
          <h2 className="text-xl font-medium">
            Bắt đầu bằng một chút về gu của bạn.
          </h2>
          <p className="text-sm text-fg-muted mt-3 mb-5">
            Quiz giúp chọn đúng áo thật từ tủ đồ của bạn.
          </p>
          <Link href="/quiz" className={`${button} bg-accent text-bg`}>
            Làm quiz
          </Link>
        </section>
      )}
      {rec && rec.data.length === 0 && (
        <section className={panel}>
          <Shirt className="mb-4 text-fg-muted" />
          <h2 className="text-xl">Chưa tìm thấy áo phù hợp.</h2>
          <p className="text-sm text-fg-muted mt-3 mb-4">
            Thêm áo thun / sơ mi vào tủ đồ hoặc thay đổi những họa tiết bạn muốn
            tránh, rồi bấm Gợi ý lại.
          </p>
          <Link href="/wardrobe" className={button}>
            Mở tủ đồ
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
                    m.kind === "fitting" &&
                    m.avatar_id === avatar.id &&
                    m.garment_id === garment.id,
                )
              : undefined;
          const job = fitting
            ? data?.jobs.find((j) => j.model_id === fitting.id)
            : undefined;
          const href = `/studio?avatar=${avatarId}&fitting=${fitting?.id}`;
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
                        ? "Áo chưa có ảnh xem trước"
                        : "Áo không còn trong tủ đồ"}
                    </span>
                  </div>
                )}
                <span className="absolute top-4 left-4 rounded-full bg-white/85 px-3 py-1 text-[11px]">
                  Lựa chọn 0{index + 1}
                </span>
                <span className="absolute bottom-4 left-4 text-[10px] uppercase tracking-widest">
                  Ảnh áo gốc · Chưa phải ảnh render
                </span>
              </div>
              <div className="p-6">
                <h2 className="font-display text-2xl break-words">
                  {look.itemName}
                </h2>
                <p className="text-xs text-accent-text mt-2">
                  {look.category === "shirt" ? "Sơ mi" : "Áo thun"} · Mặc thử
                  phần áo
                </p>
                <p className="text-sm text-fg-muted leading-6 mt-4">
                  {look.reason}
                </p>
                <div className="mt-6 space-y-3">
                  {!item ? (
                    <p className="text-sm text-fg-muted">
                      Bấm Gợi ý lại để cập nhật tủ đồ.
                    </p>
                  ) : !avatar ? (
                    <Link href="/prepare" className={`${button} w-full`}>
                      Tạo avatar trước
                    </Link>
                  ) : !garment ? (
                    <Link href="/prepare" className={`${button} w-full`}>
                      Chuẩn bị áo 3D
                    </Link>
                  ) : fitting?.output_asset_id ? (
                    <>
                      <Link
                        href={href}
                        className={`${button} bg-accent text-bg w-full`}
                      >
                        Mặc thử 3D <ArrowUpRight size={14} />
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
                            setNotice("Đã lưu look vào tài khoản.");
                          })
                        }
                        className={`${button} w-full`}
                      >
                        <Bookmark size={14} />
                        Lưu look
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
                        ? " · máy mặc thử chưa kết nối"
                        : ""}
                    </p>
                  ) : job && ["failed", "canceled"].includes(job.state) ? (
                    <Link className={`${button} w-full`} href="/prepare">
                      Xem lỗi & thử lại
                    </Link>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await prepareFitting(avatar, garment);
                          setNotice(
                            "Đã chuẩn bị tác vụ mặc thử. Khi hoàn tất, nút mở 3D sẽ xuất hiện.",
                          );
                        })
                      }
                      className={`${button} bg-accent text-bg w-full`}
                    >
                      Chuẩn bị lượt mặc thử 3D
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
                            "Đã ghi nhớ áo hợp gu để ưu tiên lần gợi ý sau.",
                          );
                        })
                      }
                    >
                      Hợp gu
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
                            "Đã ẩn áo này khỏi gợi ý. Bạn có thể hoàn tác bên dưới.",
                          );
                        })
                      }
                    >
                      Ẩn khỏi gợi ý
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
          <h2 className="text-sm font-medium mb-3">Áo đã ẩn khỏi gợi ý</h2>
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
                  {items.find((i) => i.id === v.item_id)?.name ?? "Áo đã ẩn"} ·
                  Hoàn tác
                </button>
              ))}
          </div>
        </section>
      )}
      {saved.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl mb-5">
            Look đã lưu trên tài khoản
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
                  aria-label={`Xóa look ${l.name}`}
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
        Gợi ý hiện dùng quy tắc có giải thích, không cần API AI trả phí. Chưa
        đánh giá độ vừa hoặc tạo quần / phụ kiện ngoài tủ đồ.
      </p>
    </main>
  );
}
