"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCcw, Save, Sparkles, Wand2 } from "lucide-react";
import { ClothingAnalysis, OutfitSuggestion, StyleCategory, StyleProfile, WardrobeItem } from "@/lib/types";

const vibeCycle: StyleCategory[] = ["casual", "streetwear", "minimal", "formal"];

export default function OutfitsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [analysis, setAnalysis] = useState<ClothingAnalysis | null>(null);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [outfits, setOutfits] = useState<OutfitSuggestion[]>([]);
  const [history, setHistory] = useState<Array<{ id: string; created_at: string; data_json: OutfitSuggestion[] }>>([]);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vibeIndex, setVibeIndex] = useState(0);

  const selectedItem = useMemo(
    () => wardrobeItems.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId, wardrobeItems]
  );

  const loadWardrobe = useCallback(async () => {
    const response = await fetch("/api/wardrobe", { cache: "no-store" });
    const data = await response.json();
    if (response.ok && data.success) {
      setWardrobeItems(data.items);
      if (!selectedItemId && data.items.length > 0) {
        setSelectedItemId(data.items[0].id);
      }
    }
  }, [selectedItemId]);

  const loadProfile = useCallback(async () => {
    const response = await fetch("/api/user/profile", { cache: "no-store" });
    const data = await response.json();
    if (response.ok && data.success) {
      setProfile(data.profile);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/outfits", { cache: "no-store" });
    const data = await response.json();
    if (response.ok && data.success) {
      setHistory(data.outfits);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadWardrobe(), loadProfile(), loadHistory()]);
  }, [loadHistory, loadProfile, loadWardrobe]);

  useEffect(() => {
    if (!selectedItem) return;
    setAnalysis({
      type: selectedItem.category,
      primaryColor: selectedItem.color,
      secondaryColor: selectedItem.secondary_color ?? undefined,
      pattern: selectedItem.pattern ?? "plain",
      style: selectedItem.style,
      material: selectedItem.material ?? undefined,
      description: selectedItem.description ?? `${selectedItem.name} in ${selectedItem.color}`,
    });
  }, [selectedItem]);

  async function handleAnalyzeUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-item", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Could not upload image.");
      }

      setSelectedItemId("");
      setAnalysis(data.analysis);
    } catch (uploadError) {
      if (uploadError instanceof Error) {
        setError(uploadError.message);
      } else {
        setError(JSON.stringify(uploadError));
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function generate(vibeOverride?: StyleCategory) {
    if (!analysis) {
      setError("Choose a wardrobe item or upload a clothing photo first.");
      return;
    }

    setGenerating(true);
    setError(null);
    const response = await fetch("/api/generate-outfit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysis,
        count: 4,
        vibeOverride,
        styleProfile: profile ?? undefined,
      }),
    });

    const data = await response.json();
    setGenerating(false);

    if (!response.ok || !data.success) {
      setError(data.error ?? "Could not generate outfits.");
      return;
    }

    setOutfits(data.outfits);
  }

  async function saveOutfit(outfit: OutfitSuggestion) {
    setSavingId(outfit.id);
    const response = await fetch("/api/outfits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceItemId: selectedItemId || null,
        data: [outfit],
      }),
    });

    const data = await response.json();
    setSavingId(null);

    if (!response.ok || !data.success) {
      setError(data.error ?? "Could not save this outfit.");
      return;
    }

    await loadHistory();
  }

  function tryDifferentVibe() {
    const nextIndex = (vibeIndex + 1) % vibeCycle.length;
    setVibeIndex(nextIndex);
    void generate(vibeCycle[nextIndex]);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-xl shadow-black/5">
          <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Outfit generator</div>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Turn a single piece into four styled directions.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Pick something from your wardrobe or upload a fresh clothing image. FitMatch will analyze it, then generate
            diverse outfits across your core styles.
          </p>

          <div className="mt-6 grid gap-4">
            <div>
              <label htmlFor="sourceItem" className="mb-2 block text-sm font-medium text-foreground">
                Use an existing wardrobe item
              </label>
              <select
                id="sourceItem"
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
              >
                <option value="">Choose a saved item</option>
                {wardrobeItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.color}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[1.5rem] border border-dashed border-border bg-background p-5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleAnalyzeUpload(file);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:bg-secondary"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Upload or capture a new clothing image
              </button>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-background p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Detected item</div>
              {analysis ? (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{analysis.type}</span>
                    <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{analysis.primaryColor}</span>
                    <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{analysis.style}</span>
                    <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{analysis.pattern}</span>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{analysis.description}</p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No source item selected yet.</p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void generate()}
                disabled={generating}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate outfits
              </button>
              <button
                type="button"
                onClick={tryDifferentVibe}
                disabled={generating}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-60"
              >
                <RefreshCcw className="h-4 w-4" />
                Try different vibe
              </button>
            </div>

            {error ? <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          </div>
        </section>

        <section className="space-y-8">
          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-xl shadow-black/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">AI suggestions</div>
                <h2 className="mt-2 text-3xl font-semibold text-foreground">Generated outfits</h2>
              </div>
              {profile?.primaryStyle ? (
                <div className="rounded-full bg-secondary px-4 py-2 text-xs uppercase tracking-[0.2em] text-secondary-foreground">
                  Tuned for {profile.primaryStyle}
                </div>
              ) : null}
            </div>

            {outfits.length === 0 ? (
              <div className="mt-8 rounded-[1.5rem] border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
                Generate your first set of outfits to see styling combinations, accessories, explanations, and confidence scores.
              </div>
            ) : (
              <div className="mt-8 grid gap-5">
                {outfits.map((outfit) => (
                  <article key={outfit.id} className="rounded-[1.5rem] border border-border bg-background p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{outfit.styleCategory}</span>
                          <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
                            Confidence {outfit.confidenceScore}%
                          </span>
                          {outfit.occasion ? (
                            <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{outfit.occasion}</span>
                          ) : null}
                        </div>
                        <h3 className="mt-4 text-2xl font-semibold text-foreground">{outfit.name}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => void saveOutfit(outfit)}
                        disabled={savingId === outfit.id}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-60"
                      >
                        {savingId === outfit.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save outfit
                      </button>
                    </div>
                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Outfit pieces</div>
                        <div className="mt-3 grid gap-3">
                          {outfit.items.map((item) => (
                            <div key={`${outfit.id}-${item.category}-${item.description}`} className="rounded-2xl bg-card px-4 py-3">
                              <div className="text-sm font-medium text-foreground">{item.description}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {item.category} · {item.suggestedColor}
                              </div>
                              {item.notes ? <div className="mt-1 text-xs text-muted-foreground">{item.notes}</div> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Accessories + reasoning</div>
                        <div className="mt-3 grid gap-3">
                          {outfit.accessories.map((item) => (
                            <div key={`${outfit.id}-${item.category}-${item.description}`} className="rounded-2xl bg-card px-4 py-3">
                              <div className="text-sm font-medium text-foreground">{item.description}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {item.category} · {item.suggestedColor}
                              </div>
                            </div>
                          ))}
                          <div className="rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground">{outfit.colorExplanation}</div>
                          <div className="rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground">{outfit.styleExplanation}</div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-xl shadow-black/5">
            <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Saved history</div>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Previous outfit saves</h2>
            {history.length === 0 ? (
              <div className="mt-6 text-sm text-muted-foreground">No saved outfits yet.</div>
            ) : (
              <div className="mt-6 grid gap-4">
                {history.map((entry) => (
                  <div key={entry.id} className="rounded-[1.5rem] border border-border bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                    <div className="mt-2 text-base font-medium text-foreground">{entry.data_json[0]?.name ?? "Saved outfit"}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{entry.data_json[0]?.styleExplanation ?? "Saved styling set."}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
