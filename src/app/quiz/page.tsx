"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonalStyleRecommendation, QuizAnswers } from "@/lib/types";
import { getColorHex } from "@/lib/utils";
import { IMAGES, DARK_BLUR_DATA_URL } from "@/lib/images";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Chip } from "@/components/ui/Chip";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

const ageOptions = ["13-17", "18-24", "25-34", "35-44", "45+"];
const genderOptions = ["Feminine", "Masculine", "Androgynous", "Fluid", "Prefer not to say"];
const bodyShapeOptions = [
  "Slim",
  "Athletic",
  "Curvy",
  "Broad shoulders",
  "Petite",
  "Tall frame",
  "Prefer not to say",
];
const heightOptions = [
  "Under 5'4",
  "5'4 - 5'7",
  "5'8 - 5'11",
  "6'0 and above",
  "Prefer not to say",
];
const lifestyleOptions = [
  "Office and meetings",
  "Campus or school",
  "Creative work and city life",
  "Mostly casual daily wear",
  "Active and outdoors",
];
const goalOptions = [
  "Look taller",
  "Look more polished",
  "Look more relaxed",
  "Highlight shape",
  "Build easy repeat outfits",
];
const fitPriorityOptions = [
  "Waist definition",
  "Longer leg line",
  "Shoulder balance",
  "Relaxed comfort",
  "Layering",
  "Minimal styling effort",
];
const colorOptions = [
  "Black",
  "White",
  "Cream",
  "Olive",
  "Navy",
  "Brown",
  "Gray",
  "Red",
  "Pink",
  "Blue",
];

const outfitTileOptions = [
  {
    label: "Relaxed denim + tee",
    detail: "Easy, low-effort everyday uniform with elevated cuts",
    image: IMAGES.quizDenim,
  },
  {
    label: "Tailored monochrome",
    detail: "Sharp, clean, and elevated architectural lines",
    image: IMAGES.quizTailored,
  },
  {
    label: "Oversized streetwear layers",
    detail: "Bold silhouette with tactile contemporary personality",
    image: IMAGES.quizStreetwear,
  },
  {
    label: "Sporty athleisure",
    detail: "Comfort-first technical fabrics with effortless movement",
    image: IMAGES.quizSporty,
  },
  {
    label: "Soft minimalist neutrals",
    detail: "Quiet, refined luxury palette with tactile knitwear",
    image: IMAGES.quizMinimal,
  },
  {
    label: "Classic smart casual",
    detail: "Balanced and timeless versatility from day to evening",
    image: IMAGES.quizSmartCasual,
  },
];

const inspirationOptions = [
  "Korean minimal",
  "Classic tailoring",
  "Scandi clean",
  "Sneaker culture",
  "Quiet luxury",
  "Vintage prep",
];

const stepBackgrounds = [
  IMAGES.quizStep1,
  IMAGES.quizStep2,
  IMAGES.quizStep3,
];

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

const defaultAnswers: QuizAnswers = {
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
};

export default function QuizPage() {
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState<QuizAnswers>(defaultAnswers);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<PersonalStyleRecommendation | null>(null);

  // Validation rules
  const isStep3Valid = useMemo(
    () =>
      answers.favoriteColors.length > 0 &&
      answers.preferredOutfits.length > 0 &&
      answers.fashionInspirations.length > 0 &&
      (answers.fitPriorities?.length ?? 0) > 0,
    [answers]
  );

  // Prefill profile on mount from server
  useEffect(() => {
    async function loadSavedProfile() {
      try {
        const response = await fetch("/api/user/profile", { cache: "no-store" });
        const data = await response.json();
        if (response.ok && data.success && data.quizAnswers) {
          setAnswers({ ...defaultAnswers, ...data.quizAnswers });
        }
      } catch (err) {
        console.error("Could not hydrate existing style profile:", err);
      }
    }
    void loadSavedProfile();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isStep3Valid) {
      toast("Please select at least one choice for each category.", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizAnswers: answers }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Could not save your style profile.");
      }

      setRecommendations(data.recommendations ?? null);
      toast("Personal style profile analyzed successfully!", "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Submission failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleRetake() {
    setRecommendations(null);
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const currentBg = stepBackgrounds[currentStep - 1] || IMAGES.quizStep1;

  // 1. Full-Screen Recommendations Reveal View
  if (recommendations) {
    return (
      <main className="min-h-screen bg-bg text-fg pb-24">
        {/* Editorial Hero Header */}
        <section className="relative h-[60svh] w-full flex items-end justify-start overflow-hidden border-b border-border">
          <Image
            src={IMAGES.stepStyle.src}
            alt="Editorial style lookbook recommendation header"
            fill
            priority
            sizes="100vw"
            placeholder="blur"
            blurDataURL={DARK_BLUR_DATA_URL}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-bg/30" />

          <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 lg:px-8 space-y-4">
            <div className="eyebrow text-accent-text inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              YOUR PERSONAL STYLE PROFILE
            </div>
            <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-fg leading-tight">
              {recommendations.headline}
            </h1>
            <p className="max-w-2xl text-sm sm:text-base text-fg-muted leading-relaxed font-normal">
              {recommendations.summary}
            </p>
          </div>
        </section>

        {/* Breakdown & Outfits Section */}
        <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 lg:px-8 space-y-12">
          {/* Two-Column Guidance Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Flattering Focus */}
            <div className="rounded-[8px] border border-border bg-bg-elevated p-6 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <div className="eyebrow text-emerald-400">Silhouettes to Prioritize</div>
              </div>
              <div className="space-y-2.5">
                {recommendations.flatteringFocus.map((focus, i) => (
                  <div
                    key={`focus-${i}`}
                    className="flex items-start gap-3 text-xs sm:text-sm text-fg leading-relaxed bg-bg-raised/50 p-3 rounded-[4px] border border-border/40"
                  >
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{focus}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Avoid Notes */}
            <div className="rounded-[8px] border border-border bg-bg-elevated p-6 space-y-4">
              <div className="flex items-center gap-2 text-accent-text">
                <AlertTriangle className="h-4 w-4" />
                <div className="eyebrow text-accent-text">Details to Moderate</div>
              </div>
              <div className="space-y-2.5">
                {recommendations.avoidNotes.map((avoid, i) => (
                  <div
                    key={`avoid-${i}`}
                    className="flex items-start gap-3 text-xs sm:text-sm text-fg-muted leading-relaxed bg-bg-raised/50 p-3 rounded-[4px] border border-border/40"
                  >
                    <span className="font-mono text-accent-text font-bold">✕</span>
                    <span>{avoid}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recommended Outfits Grid */}
          <div className="space-y-6">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <div>
                <div className="eyebrow text-accent-text">CALIBRATED DIRECTION</div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-fg">
                  Tailored Outfit Formulas
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recommendations.outfits.map((outfit, index) => (
                <article
                  key={`rec-${index}`}
                  className="rounded-[8px] border border-border bg-bg-elevated p-6 flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-3">
                    <Badge variant="accent">{outfit.occasion}</Badge>
                    <h3 className="font-display text-xl font-bold text-fg">{outfit.name}</h3>
                    <p className="text-xs text-fg-muted leading-relaxed font-normal">
                      {outfit.whyItFitsYou}
                    </p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-border/60">
                    <div className="eyebrow text-[10px] text-fg-subtle">Recommended Pieces</div>
                    <div className="space-y-1.5">
                      {outfit.pieces.map((piece, pIdx) => (
                        <div
                          key={`piece-${pIdx}`}
                          className="flex items-center gap-2 text-xs text-fg font-medium py-1"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                          <span>{piece}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Bottom Action Row */}
          <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <Button
              variant="ghost"
              size="md"
              onClick={handleRetake}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              Retake quiz
            </Button>

            <Link href="/outfits">
              <Button
                variant="accent"
                size="lg"
                icon={<ArrowRight className="h-4 w-4" />}
                className="uppercase tracking-wider font-bold text-xs"
              >
                Generate outfits from this profile
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 2. 3-Step Wizard View
  return (
    <main className="relative min-h-[calc(100vh-5rem)] w-full flex flex-col justify-between overflow-hidden bg-bg text-fg">
      {/* Background Editorial Cross-Fade Photo */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={`step-bg-${currentStep}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0"
          >
            <Image
              src={currentBg.src}
              alt={currentBg.alt}
              fill
              priority
              sizes="100vw"
              placeholder="blur"
              blurDataURL={DARK_BLUR_DATA_URL}
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg/90 to-bg" />
      </div>

      {/* Pinned Thin Progress Bar */}
      <div className="sticky top-20 z-30 w-full bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="h-[2px] w-full bg-border">
          <motion.div
            className="h-full bg-accent"
            animate={{ width: `${(currentStep / 3) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 text-xs font-mono">
          <span className="text-fg-subtle uppercase tracking-widest">
            Step {currentStep === 1 ? "Personal Fit" : currentStep === 2 ? "Lifestyle" : "Preferences"}
          </span>
          <span className="tabular-nums text-accent-text font-bold">
            0{currentStep} / 03
          </span>
        </div>
      </div>

      {/* Centered Step Form Container (max 720px) */}
      <div className="relative z-10 mx-auto w-full max-w-[720px] px-4 py-8 sm:py-12 flex-1">
        <AnimatePresence mode="wait">
          {/* STEP 1: Personal Fit */}
          {currentStep === 1 && (
            <motion.div
              key="quiz-step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <div className="eyebrow text-accent-text">STEP 01 OF 03</div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-fg">
                  Personal fit & proportions.
                </h1>
                <p className="text-xs sm:text-sm text-fg-muted font-normal leading-relaxed">
                  FitMatch calibrates silhouette geometry and drape to match your frame.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Age Range" htmlFor="q-age">
                  <Select
                    id="q-age"
                    value={answers.ageRange}
                    onChange={(e) => setAnswers((a) => ({ ...a, ageRange: e.target.value }))}
                  >
                    {ageOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Gender Expression" htmlFor="q-gender">
                  <Select
                    id="q-gender"
                    value={answers.genderExpression}
                    onChange={(e) =>
                      setAnswers((a) => ({ ...a, genderExpression: e.target.value }))
                    }
                  >
                    {genderOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Body Shape / Frame" htmlFor="q-body">
                  <Select
                    id="q-body"
                    value={answers.bodyShape}
                    onChange={(e) => setAnswers((a) => ({ ...a, bodyShape: e.target.value }))}
                  >
                    {bodyShapeOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Height Range" htmlFor="q-height">
                  <Select
                    id="q-height"
                    value={answers.heightRange}
                    onChange={(e) => setAnswers((a) => ({ ...a, heightRange: e.target.value }))}
                  >
                    {heightOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Lifestyle & Goals */}
          {currentStep === 2 && (
            <motion.div
              key="quiz-step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <div className="eyebrow text-accent-text">STEP 02 OF 03</div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-fg">
                  Lifestyle & tailoring goals.
                </h1>
                <p className="text-xs sm:text-sm text-fg-muted font-normal leading-relaxed">
                  Helps prioritize looks that fit your real weekly routine, not just a moodboard.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Daily Lifestyle" htmlFor="q-lifestyle">
                  <Select
                    id="q-lifestyle"
                    value={answers.lifestyle}
                    onChange={(e) => setAnswers((a) => ({ ...a, lifestyle: e.target.value }))}
                  >
                    {lifestyleOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Main Style Goal" htmlFor="q-goal">
                  <Select
                    id="q-goal"
                    value={answers.shoppingGoal}
                    onChange={(e) => setAnswers((a) => ({ ...a, shoppingGoal: e.target.value }))}
                  >
                    {goalOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {/* Fit Priorities Chips */}
              <div className="space-y-3 pt-2">
                <div className="eyebrow text-fg-subtle">
                  Fit Priorities <span className="text-accent-text">*</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {fitPriorityOptions.map((priority) => {
                    const isSelected = answers.fitPriorities?.includes(priority);
                    return (
                      <Chip
                        key={priority}
                        active={isSelected}
                        onClick={() =>
                          setAnswers((a) => ({
                            ...a,
                            fitPriorities: toggleValue(a.fitPriorities ?? [], priority),
                          }))
                        }
                      >
                        {priority}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Visual Preferences */}
          {currentStep === 3 && (
            <motion.div
              key="quiz-step-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <div className="eyebrow text-accent-text">STEP 03 OF 03</div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-fg">
                  What you naturally like.
                </h1>
                <p className="text-xs sm:text-sm text-fg-muted font-normal leading-relaxed">
                  Select your favorite palettes, aesthetic formulas, and stylistic inspirations.
                </p>
              </div>

              {/* Color Swatches */}
              <div className="space-y-3">
                <div className="eyebrow text-fg-subtle">
                  Favorite Color Palettes <span className="text-accent-text">*</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => {
                    const isSelected = answers.favoriteColors.includes(color);
                    const swatch = getColorHex(color);
                    return (
                      <Chip
                        key={color}
                        active={isSelected}
                        colorSwatch={swatch}
                        onClick={() =>
                          setAnswers((a) => ({
                            ...a,
                            favoriteColors: toggleValue(a.favoriteColors, color),
                          }))
                        }
                      >
                        {color}
                      </Chip>
                    );
                  })}
                </div>
              </div>

              {/* Outfit Direction Visual Image Tiles */}
              <div className="space-y-3">
                <div className="eyebrow text-fg-subtle">
                  Outfit Directions You Like <span className="text-accent-text">*</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {outfitTileOptions.map((tile) => {
                    const isSelected = answers.preferredOutfits.includes(tile.label);
                    return (
                      <button
                        key={tile.label}
                        type="button"
                        onClick={() =>
                          setAnswers((a) => ({
                            ...a,
                            preferredOutfits: toggleValue(a.preferredOutfits, tile.label),
                          }))
                        }
                        className={`group relative h-28 overflow-hidden rounded-[4px] border p-4 flex flex-col justify-end text-left transition-all cursor-pointer ${
                          isSelected
                            ? "border-accent-text ring-2 ring-accent-ring shadow-[0_0_16px_rgba(196,98,45,0.2)]"
                            : "border-border hover:border-border-strong opacity-80 hover:opacity-100"
                        }`}
                      >
                        <Image
                          src={tile.image.src}
                          alt={tile.label}
                          fill
                          sizes="(max-width: 768px) 100vw, 360px"
                          placeholder="blur"
                          blurDataURL={DARK_BLUR_DATA_URL}
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-transparent" />

                        {isSelected && (
                          <div className="absolute top-2.5 right-2.5 h-4 w-4 rounded-full bg-accent text-[#0A0A0B] flex items-center justify-center">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}

                        <div className="relative z-10">
                          <div className="font-display text-sm font-bold text-fg group-hover:text-accent-text transition">
                            {tile.label}
                          </div>
                          <div className="text-[11px] text-fg-muted font-normal truncate mt-0.5">
                            {tile.detail}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fashion Inspirations Chips */}
              <div className="space-y-3">
                <div className="eyebrow text-fg-subtle">
                  Style Inspirations <span className="text-accent-text">*</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {inspirationOptions.map((insp) => {
                    const isSelected = answers.fashionInspirations.includes(insp);
                    return (
                      <Chip
                        key={insp}
                        active={isSelected}
                        onClick={() =>
                          setAnswers((a) => ({
                            ...a,
                            fashionInspirations: toggleValue(a.fashionInspirations, insp),
                          }))
                        }
                      >
                        {insp}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wizard Bottom Navigation Row */}
        <div className="mt-12 pt-6 border-t border-border flex items-center justify-between gap-4">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setCurrentStep((s) => s - 1)}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 3 ? (
            <Button
              type="button"
              variant="accent"
              size="md"
              onClick={() => setCurrentStep((s) => s + 1)}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              variant="accent"
              size="md"
              onClick={handleSubmit}
              disabled={!isStep3Valid}
              loading={loading}
              icon={<Sparkles className="h-4 w-4" />}
              className="uppercase tracking-wider font-bold text-xs"
            >
              Get my recommendations
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
