"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { WorkspaceNav, panel, button } from "@/components/v2/WorkspaceNav";
import { api } from "@/lib/v2/client";
import { styleAnswers, type StyleAnswers } from "@/lib/v2/contracts";
import { IMAGES } from "@/lib/images";
const defaults: StyleAnswers = {
  occasion: "daily",
  style: "minimal",
  fit: "regular",
  favoriteColors: ["black", "white"],
  avoidPatterns: [],
  climate: "mild",
};
const steps = [
  "Dịp mặc",
  "Phong cách",
  "Phom yêu thích",
  "Bảng màu",
  "Họa tiết",
  "Nhịp sống",
];
const colors = [
  ["black", "Đen", "#242424"],
  ["white", "Trắng", "#efefea"],
  ["cream", "Kem", "#d4c6ab"],
  ["blue", "Xanh dương", "#7a9db4"],
  ["navy", "Navy", "#28354d"],
  ["brown", "Nâu", "#80634d"],
  ["gray", "Xám", "#929391"],
  ["olive", "Olive", "#727b50"],
  ["red", "Đỏ", "#a73d38"],
  ["pink", "Hồng", "#cd9da9"],
] as const;
export default function QuizPage() {
  const router = useRouter(),
    [answers, setAnswers] = useState<StyleAnswers>(defaults),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const [draftKey, setDraftKey] = useState("");
  const saving = useRef(false);
  const [version, setVersion] = useState<{
    fingerprint: string;
    id: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      api<{ profile: { id: string; answers: unknown } | null }>(
        "style-profiles",
      ),
      fetch("/api/auth/session", {
        cache: "no-store",
        signal: controller.signal,
      }).then(async (r) => {
        if (!r.ok) throw new Error("Cần đăng nhập lại.");
        return r.json();
      }),
    ])
      .then(([d, session]) => {
        if (controller.signal.aborted) return;
        const parsed = styleAnswers.safeParse(d.profile?.answers);
        if (parsed.success) {
          setAnswers(parsed.data);
          setVersion({
            id: d.profile!.id,
            fingerprint: JSON.stringify(parsed.data),
          });
          setSaved(true);
        }
        if (typeof session.user?.id === "string") {
          const key = "fitmatch:quiz-v2:" + session.user.id;
          setDraftKey(key);
          try {
            const draft = JSON.parse(sessionStorage.getItem(key) ?? "null");
            const restored = styleAnswers.safeParse(draft?.answers);
            if (restored.success && draft.baseId === (d.profile?.id ?? null)) {
              setAnswers(restored.data);
              setSaved(false);
            }
          } catch {
            /* Storage may be disabled; cloud profile remains available. */
          }
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, []);
  function choose<K extends keyof StyleAnswers>(
    key: K,
    value: StyleAnswers[K],
  ) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (draftKey)
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            baseId: version?.id ?? null,
            answers: next,
          }),
        );
      } catch {
        /* Draft is optional. */
      }
    setSaved(false);
    setError("");
  }
  async function finish() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const fingerprint = JSON.stringify(answers);
      if (version?.fingerprint !== fingerprint) {
        const d = await api<{ profile: { id: string } }>(
          "style-profiles",
          answers,
        );
        setVersion({ id: d.profile.id, fingerprint });
      }
      setSaved(true);
      if (draftKey)
        try {
          sessionStorage.removeItem(draftKey);
        } catch {
          /* Draft is optional. */
        }
      await api("recommendations", {});
      router.push("/looks");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function options<K extends "occasion" | "fit" | "climate">(
    key: K,
    values: [StyleAnswers[K], string, string][],
  ) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {values.map(([value, title, detail]) => (
          <button
            key={value}
            type="button"
            aria-pressed={answers[key] === value}
            disabled={busy}
            onClick={() => choose(key, value)}
            className={`text-left rounded-2xl border p-5 transition ${answers[key] === value ? "border-accent bg-accent-soft" : "border-border hover:bg-bg-raised"}`}
          >
            <span className="block font-medium mb-2">{title}</span>
            <span className="text-xs text-fg-muted leading-5">{detail}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <main className="mx-auto max-w-6xl px-5 pt-28 pb-16">
      <WorkspaceNav current="/quiz" />
      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-8 lg:gap-14">
        <aside>
          <p className="text-xs text-accent-text uppercase tracking-[.2em] mb-4">
            Style, made personal
          </p>
          <h1 className="font-display text-4xl leading-tight">
            Bắt đầu từ
            <br />
            gu của bạn.
          </h1>
          <p className="mt-5 text-sm text-fg-muted leading-6">
            Vài lựa chọn để tìm áo phù hợp từ chính tủ đồ. Sau đó, xem chiếc áo
            ấy trên avatar của bạn.
          </p>
          <ol className="mt-8 space-y-3 hidden lg:block">
            {steps.map((s, i) => (
              <li
                key={s}
                className={`text-sm flex gap-3 ${i === step ? "text-accent-text" : "text-fg-muted"}`}
              >
                <span className="font-mono text-xs">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s}
              </li>
            ))}
          </ol>
          {saved && (
            <p className="text-xs mt-7 text-success">
              Đã lưu hồ sơ phong cách trên tài khoản.
            </p>
          )}
        </aside>
        <section className={panel} aria-busy={busy}>
          <div className="flex justify-between text-xs text-fg-muted mb-4">
            <span>Gu của bạn / {steps[step]}</span>
            <span>
              {step + 1} / {steps.length}
            </span>
          </div>
          <div className="h-1 bg-bg-raised rounded-full mb-8 overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl mb-3">
            {
              [
                "Bạn đang chọn áo cho dịp nào?",
                "Bạn thấy mình trong phong cách nào?",
                "Bạn thích áo ôm dáng thế nào?",
                "Màu nào khiến bạn muốn mặc?",
                "Bạn muốn tránh họa tiết nào?",
                "Thời tiết nơi bạn mặc thường thế nào?",
              ][step]
            }
          </h2>
          <p className="text-sm text-fg-muted mb-7 leading-6">
            {
              [
                "Chọn tình huống bạn mặc nhiều nhất.",
                "Chọn một hướng chính; bạn có thể đổi bất cứ lúc nào.",
                "Đây là sở thích. Quiz không đo cơ thể hoặc cam kết độ vừa.",
                "Chọn từ 1 đến 5 màu. Màu và logo của áo thật vẫn được giữ theo ảnh.",
                "Có thể bỏ qua nếu bạn thích tất cả.",
                "Lưu để phát triển gợi ý theo chất liệu. Hiện chưa dùng thời tiết và phom để chấm điểm áo.",
              ][step]
            }
          </p>
          {step === 0 &&
            options("occasion", [
              ["daily", "Mỗi ngày", "Dạo phố, cà phê, gặp bạn bè"],
              ["campus", "Đi học", "Thoải mái cho cả ngày"],
              ["work", "Đi làm", "Gọn gàng và chỉn chu"],
              ["evening", "Buổi tối", "Một dịp đặc biệt hơn"],
            ])}
          {step === 1 && (
            <div className="grid sm:grid-cols-2 gap-4">
              {(
                [
                  [
                    "minimal",
                    "Tối giản",
                    "Đường nét sạch, màu trung tính",
                    IMAGES.quizTailored,
                  ],
                  [
                    "casual",
                    "Tự nhiên",
                    "Áo thun, denim và sự thoải mái",
                    IMAGES.quizDenim,
                  ],
                  [
                    "streetwear",
                    "Streetwear",
                    "Phom rộng và điểm nhấn",
                    IMAGES.quizStreetwear,
                  ],
                  [
                    "formal",
                    "Chỉn chu",
                    "Sơ mi, đường cắt gọn gàng",
                    IMAGES.look2,
                  ],
                ] as const
              ).map(([value, title, detail, photo]) => {
                const image = photo;
                return (
                  <button
                    type="button"
                    key={value}
                    disabled={busy}
                    onClick={() => choose("style", value)}
                    aria-pressed={answers.style === value}
                    className={`text-left rounded-2xl overflow-hidden border ${answers.style === value ? "border-accent ring-1 ring-accent" : "border-border"}`}
                  >
                    <div className="relative h-44">
                      <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        sizes="(max-width:640px) 90vw, 360px"
                        className="object-cover"
                      />
                      {answers.style === value && (
                        <span className="absolute top-3 right-3 bg-accent rounded-full p-1">
                          <Check size={15} />
                        </span>
                      )}
                    </div>
                    <span className="block px-4 pt-3 text-sm font-medium">
                      {title}
                    </span>
                    <span className="block px-4 py-3 text-xs text-fg-muted">
                      {detail} · ảnh tham khảo
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {step === 2 &&
            options("fit", [
              ["regular", "Vừa người", "Gọn và có khoảng cử động"],
              ["relaxed", "Thoải mái", "Rộng nhẹ quanh vai và thân"],
              ["oversized", "Oversize", "Phom rộng là điểm nhấn"],
            ])}
          {step === 3 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {colors.map(([value, title, hex]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={answers.favoriteColors.includes(value)}
                  disabled={
                    busy ||
                    (!answers.favoriteColors.includes(value) &&
                      answers.favoriteColors.length >= 5)
                  }
                  onClick={() =>
                    choose(
                      "favoriteColors",
                      answers.favoriteColors.includes(value)
                        ? answers.favoriteColors.filter((c) => c !== value)
                        : [...answers.favoriteColors, value],
                    )
                  }
                  className={`rounded-2xl border p-3 text-sm disabled:opacity-40 ${answers.favoriteColors.includes(value) ? "border-accent bg-accent-soft" : "border-border"}`}
                >
                  <span
                    className="block h-14 rounded-xl mb-3 border border-white/10"
                    style={{ backgroundColor: hex }}
                  />
                  {title}
                </button>
              ))}
            </div>
          )}
          {step === 4 && (
            <div className="grid sm:grid-cols-2 gap-3">
              {(
                [
                  ["graphic", "In hình / logo"],
                  ["striped", "Kẻ sọc"],
                  ["plaid", "Ca rô"],
                  ["floral", "Hoa"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  aria-pressed={answers.avoidPatterns.includes(value)}
                  onClick={() =>
                    choose(
                      "avoidPatterns",
                      answers.avoidPatterns.includes(value)
                        ? answers.avoidPatterns.filter((p) => p !== value)
                        : [...answers.avoidPatterns, value],
                    )
                  }
                  className={`${button} ${answers.avoidPatterns.includes(value) ? "border-accent bg-accent-soft" : ""}`}
                >
                  {answers.avoidPatterns.includes(value) && <Check size={14} />}
                  Tránh {label}
                </button>
              ))}
            </div>
          )}
          {step === 5 &&
            options("climate", [
              ["warm", "Nóng", "Ưu tiên cảm giác nhẹ, thoáng"],
              ["mild", "Ôn hòa", "Linh hoạt trong ngày"],
              ["cool", "Se lạnh", "Có thể cần phối lớp"],
            ])}
          {error && (
            <p role="alert" className="mt-6 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="mt-9 pt-6 border-t border-border flex flex-wrap justify-between gap-3">
            <button
              type="button"
              disabled={step === 0 || busy}
              className={button}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft size={15} />
              Quay lại
            </button>
            <button
              disabled={busy || (step === 3 && !answers.favoriteColors.length)}
              type="button"
              className={`${button} bg-accent text-bg`}
              onClick={() =>
                step === 5 ? void finish() : setStep((s) => s + 1)
              }
            >
              {busy
                ? "Đang tải…"
                : step === 5
                  ? "Lưu & gợi ý mặc thử"
                  : "Tiếp theo"}
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
