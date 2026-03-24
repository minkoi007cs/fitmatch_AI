"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { QuizAnswers } from "@/lib/types";

const ageOptions = ["13-17", "18-24", "25-34", "35-44", "45+"];
const genderOptions = ["Feminine", "Masculine", "Androgynous", "Fluid", "Prefer not to say"];
const colorOptions = ["Black", "White", "Cream", "Olive", "Navy", "Brown", "Gray", "Red", "Pink", "Blue"];
const outfitOptions = [
  "Relaxed denim + tee",
  "Tailored monochrome",
  "Oversized streetwear layers",
  "Sporty athleisure",
  "Soft minimalist neutrals",
  "Classic smart casual",
];
const inspirationOptions = ["Korean minimal", "Classic tailoring", "Scandi clean", "Sneaker culture", "Quiet luxury", "Vintage prep"];

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function QuizPage() {
  const [answers, setAnswers] = useState<QuizAnswers>({
    ageRange: "25-34",
    genderExpression: "Prefer not to say",
    favoriteColors: ["Black", "Cream"],
    preferredOutfits: ["Soft minimalist neutrals"],
    fashionInspirations: ["Quiet luxury"],
  });
  const [loading, setLoading] = useState(false);
  const [savedProfile, setSavedProfile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(
    () => answers.favoriteColors.length > 0 && answers.preferredOutfits.length > 0 && answers.fashionInspirations.length > 0,
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
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-4 w-4 text-accent" />
          Style onboarding
        </div>
        <h1 className="mt-5 text-4xl font-semibold text-foreground">Teach FitMatch what your personal style actually looks like.</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          We use these answers to classify your style profile and personalize outfit suggestions across your wardrobe history.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6">
        <section className="rounded-[2rem] border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">1. About you</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="ageRange" className="mb-2 block text-sm font-medium text-foreground">
                Age range
              </label>
              <select
                id="ageRange"
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
            </div>
            <div>
              <label htmlFor="genderExpression" className="mb-2 block text-sm font-medium text-foreground">
                Gender expression
              </label>
              <select
                id="genderExpression"
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
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">2. Favorite colors</h2>
          <div className="mt-5 flex flex-wrap gap-3">
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
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">3. Preferred outfit direction</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {outfitOptions.map((option) => {
              const active = answers.preferredOutfits.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    setAnswers((current) => ({ ...current, preferredOutfits: toggleValue(current.preferredOutfits, option) }))
                  }
                  className={`rounded-[1.5rem] border p-5 text-left transition ${
                    active ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  <div className="text-sm uppercase tracking-[0.2em] opacity-70">Visual choice</div>
                  <div className="mt-2 text-base font-medium">{option}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">4. Fashion inspirations</h2>
          <div className="mt-5 flex flex-wrap gap-3">
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
        </section>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={!isValid || loading}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Save style profile
          </button>
          {savedProfile ? <div className="text-sm text-muted-foreground">Profile saved. Your primary style is {savedProfile}.</div> : null}
          {error ? <div className="text-sm text-red-700">{error}</div> : null}
        </div>
      </form>
    </main>
  );
}
