"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Loader2, Sparkles, UserRound } from "lucide-react";
import { PersonalStyleRecommendation, QuizAnswers } from "@/lib/types";

const ageOptions = ["13-17", "18-24", "25-34", "35-44", "45+"];
const genderOptions = ["Feminine", "Masculine", "Androgynous", "Fluid", "Prefer not to say"];
const bodyShapeOptions = ["Slim", "Athletic", "Curvy", "Broad shoulders", "Petite", "Tall frame", "Prefer not to say"];
const heightOptions = ["Under 5'4", "5'4 - 5'7", "5'8 - 5'11", "6'0 and above", "Prefer not to say"];
const lifestyleOptions = ["Office and meetings", "Campus or school", "Creative work and city life", "Mostly casual daily wear", "Active and outdoors"];
const goalOptions = ["Look taller", "Look more polished", "Look more relaxed", "Highlight shape", "Build easy repeat outfits"];
const fitPriorityOptions = ["Waist definition", "Longer leg line", "Shoulder balance", "Relaxed comfort", "Layering", "Minimal styling effort"];
const colorOptions = ["Black", "White", "Cream", "Olive", "Navy", "Brown", "Gray", "Red", "Pink", "Blue"];
const outfitOptions = [
  { label: "Relaxed denim + tee", detail: "Easy, low-effort everyday uniform" },
  { label: "Tailored monochrome", detail: "Sharp, clean, and elevated" },
  { label: "Oversized streetwear layers", detail: "Bold silhouette with personality" },
  { label: "Sporty athleisure", detail: "Comfort-first with movement" },
  { label: "Soft minimalist neutrals", detail: "Quiet and polished" },
  { label: "Classic smart casual", detail: "Balanced and timeless" },
];
const inspirationOptions = ["Korean minimal", "Classic tailoring", "Scandi clean", "Sneaker culture", "Quiet luxury", "Vintage prep"];

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function QuizPage() {
  const [answers, setAnswers] = useState<QuizAnswers>({
    ageRange: "25-34",
    genderExpression: "Prefer not to say",
    bodyShape: "Prefer not to say",
    heightRange: "Prefer not to say",
    lifestyle: "Mostly casual daily wear",
    shoppingGoal: "Build easy repeat outfits",
    fitPriorities: ["Minimal styling effort"],
    favoriteColors: ["Black", "Cream"],
    preferredOutfits: ["Soft minimalist neutrals"],
    fashionInspirations: ["Quiet luxury"],
  });
  const [loading, setLoading] = useState(false);
  const [savedProfile, setSavedProfile] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<PersonalStyleRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(
    () =>
      answers.favoriteColors.length > 0 &&
      answers.preferredOutfits.length > 0 &&
      answers.fashionInspirations.length > 0 &&
      (answers.fitPriorities?.length ?? 0) > 0,
    [answers]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizAnswers: answers }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok || !data.success) {
      setError(data.error ?? "Could not save your style profile.");
      return;
    }

    setSavedProfile(data.profile?.primaryStyle ?? "casual");
    setRecommendations(data.recommendations ?? null);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-xl shadow-black/5 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="h-4 w-4 text-accent" />
              Personal Style Quiz
            </div>
            <div>
              <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
                Tell FitMatch about you, not just your clothes.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                This version of the quiz asks personal fit and lifestyle questions so the app can recommend outfits that
                should actually suit your frame, your routine, and the style you want to project.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                "Personal fit questions",
                "Lifestyle and styling goals",
                "Instant recommendations after submit",
              ].map((item) => (
                <div key={item} className="rounded-[1.5rem] border border-border bg-background p-4 text-sm text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-foreground p-6 text-background">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-background/10 p-3">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-background/60">What you get</div>
                <div className="text-xl font-semibold">A style profile plus outfit directions</div>
              </div>
            </div>
            <div className="mt-6 grid gap-3 text-sm text-background/75">
              <div>What silhouettes should flatter you more</div>
              <div>What style details to focus on</div>
              <div>3 recommended outfit formulas tailored to your answers</div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="grid gap-6">
          <QuizSection number="01" title="Personal fit profile" subtitle="The app uses these answers to give more personal advice.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Age range">
                <select
                  value={answers.ageRange}
                  onChange={(event) => setAnswers((current) => ({ ...current, ageRange: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                >
                  {ageOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Gender expression">
                <select
                  value={answers.genderExpression}
                  onChange={(event) => setAnswers((current) => ({ ...current, genderExpression: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                >
                  {genderOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Body shape / frame">
                <select
                  value={answers.bodyShape}
                  onChange={(event) => setAnswers((current) => ({ ...current, bodyShape: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                >
                  {bodyShapeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Height range">
                <select
                  value={answers.heightRange}
                  onChange={(event) => setAnswers((current) => ({ ...current, heightRange: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                >
                  {heightOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </QuizSection>

          <QuizSection number="02" title="Lifestyle and goals" subtitle="This helps the app recommend outfits that fit your life, not just a moodboard.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Your lifestyle">
                <select
                  value={answers.lifestyle}
                  onChange={(event) => setAnswers((current) => ({ ...current, lifestyle: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                >
                  {lifestyleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Main style goal">
                <select
                  value={answers.shoppingGoal}
                  onChange={(event) => setAnswers((current) => ({ ...current, shoppingGoal: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                >
                  {goalOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-5">
              <div className="mb-3 text-sm font-medium text-foreground">What matters most in the fit?</div>
              <div className="flex flex-wrap gap-3">
                {fitPriorityOptions.map((option) => {
                  const active = answers.fitPriorities?.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          fitPriorities: toggleValue(current.fitPriorities ?? [], option),
                        }))
                      }
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        active ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-secondary"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          </QuizSection>

          <QuizSection number="03" title="What you naturally like" subtitle="These help shape the final recommendations so they still feel like you.">
            <div>
              <div className="mb-3 text-sm font-medium text-foreground">Favorite colors</div>
              <div className="flex flex-wrap gap-3">
                {colorOptions.map((option) => {
                  const active = answers.favoriteColors.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setAnswers((current) => ({ ...current, favoriteColors: toggleValue(current.favoriteColors, option) }))}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        active ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-secondary"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 text-sm font-medium text-foreground">Outfit directions you like</div>
              <div className="grid gap-4 md:grid-cols-2">
                {outfitOptions.map((option) => {
                  const active = answers.preferredOutfits.includes(option.label);
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          preferredOutfits: toggleValue(current.preferredOutfits, option.label),
                        }))
                      }
                      className={`rounded-[1.5rem] border p-5 text-left transition ${
                        active ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-secondary"
                      }`}
                    >
                      <div className="text-base font-medium">{option.label}</div>
                      <div className={`mt-2 text-sm ${active ? "text-background/70" : "text-muted-foreground"}`}>{option.detail}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 text-sm font-medium text-foreground">Style inspirations</div>
              <div className="flex flex-wrap gap-3">
                {inspirationOptions.map((option) => {
                  const active = answers.fashionInspirations.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          fashionInspirations: toggleValue(current.fashionInspirations, option),
                        }))
                      }
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background text-foreground hover:bg-secondary"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          </QuizSection>

          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={!isValid || loading}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Get my personal recommendations
            </button>
            {savedProfile ? <div className="text-sm text-muted-foreground">Primary style: {savedProfile}</div> : null}
            {error ? <div className="text-sm text-red-700">{error}</div> : null}
          </div>
        </form>

        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-xl shadow-black/5">
          <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Live result panel</div>
          <h2 className="mt-2 text-3xl font-semibold text-foreground">What should fit with your answers</h2>
          {!recommendations ? (
            <div className="mt-8 rounded-[1.5rem] border border-dashed border-border bg-background p-8">
              <div className="text-sm text-muted-foreground">
                Submit the quiz and this panel will switch into your personal result, including styling focus points and outfit ideas tailored to you.
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-5">
              <div className="rounded-[1.5rem] bg-foreground p-5 text-background">
                <div className="text-xs uppercase tracking-[0.2em] text-background/60">Your fit summary</div>
                <h3 className="mt-2 text-2xl font-semibold">{recommendations.headline}</h3>
                <p className="mt-3 text-sm leading-6 text-background/80">{recommendations.summary}</p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <ResultList title="Focus on" items={recommendations.flatteringFocus} />
                <ResultList title="Watch out for" items={recommendations.avoidNotes} />
              </div>

              <div className="grid gap-4">
                {recommendations.outfits.map((outfit) => (
                  <article key={outfit.name} className="rounded-[1.5rem] border border-border bg-background p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                          {outfit.occasion}
                        </div>
                        <h3 className="mt-3 text-xl font-semibold text-foreground">{outfit.name}</h3>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{outfit.whyItFitsYou}</p>
                    <div className="mt-4 grid gap-2">
                      {outfit.pieces.map((piece) => (
                        <div key={piece} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-sm text-foreground">
                          <div className="rounded-full bg-secondary p-1">
                            <Check className="h-3.5 w-3.5 text-foreground" />
                          </div>
                          {piece}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function QuizSection({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-border bg-card p-6 shadow-xl shadow-black/5">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-foreground px-3 py-2 text-xs font-medium tracking-[0.2em] text-background">{number}</div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[1.5rem] bg-background p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</div>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={item} className="rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
