"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { STYLE_CATEGORIES } from "@/lib/types";
import {
  Wand2,
  RefreshCcw,
  Sparkles,
  Bookmark,
  ImageIcon,
  Loader2,
  UploadCloud,
  Check,
  Clock,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  ClothingAnalysis,
  OutfitSuggestion,
  StyleCategory,
  StyleProfile,
  WardrobeItem,
} from "@/lib/types";
import {
  compressImage,
  validateImageFile,
  getColorHex,
  formatDate,
} from "@/lib/utils";
import { IMAGES } from "@/lib/images";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

const vibeCycle = STYLE_CATEGORIES;

export default function OutfitsPage() {
  return <Suspense fallback={<main className="pt-24 px-6">Loading outfits…</main>}><OutfitsRoute /></Suspense>;
}

function OutfitsRoute() {
  const params = useSearchParams();
  const value = params.get("vibe") as StyleCategory;
  const vibe = vibeCycle.includes(value) ? value : "casual";
  return <OutfitsContent key={vibe} initialVibe={vibe} />;
}

function OutfitsContent({ initialVibe }: { initialVibe: StyleCategory }) {
  const batchVersion = useRef(0);
  const lifecycle = useRef({ active: true });
  const [sourceItemId, setSourceItemId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const uploadVersion = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [uploadedAnalysis, setAnalysis] = useState<ClothingAnalysis | null>(null);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [outfits, setOutfits] = useState<OutfitSuggestion[]>([]);
  const [history, setHistory] = useState<
    Array<{ id: string; created_at: string; source_item_id?: string | null; data_json: OutfitSuggestion[] }>
  >([]);

  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [imageLoadingId, setImageLoadingId] = useState<string | null>(null);
  const [generatedPaths, setGeneratedPaths] = useState<Record<string, string>>({});
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [vibeIndex, setVibeIndex] = useState(vibeCycle.indexOf(initialVibe));

  const selectedItem = useMemo(
    () => wardrobeItems.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId, wardrobeItems]
  );

  const loadHistory = useCallback(async (cursor?: string) => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/outfits${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error("Could not load saved looks. Please retry.");
      setHistory(current => cursor ? [...current, ...(data.outfits ?? [])].filter((entry, index, all) => all.findIndex(other => other.id === entry.id) === index) : data.outfits ?? []);
      setNextCursor(data.nextCursor ?? null);
      if (data.invalidCount) toast("Some older looks contain invalid data and could not be displayed.", "info");
    } catch (error) { toast(error instanceof Error ? error.message : "Could not load archive.", "error"); }
    finally { setHistoryLoading(false); }
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    const current = lifecycle.current;
    current.active = true;
    const endpoints = ["/api/wardrobe", "/api/user/profile", "/api/outfits"];
    endpoints.forEach(async endpoint => {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error("Could not load saved data.");
        if (controller.signal.aborted) return;
        if (endpoint === "/api/wardrobe") setWardrobeItems(data.items ?? []);
        if (endpoint === "/api/user/profile") setProfile(data.profile);
        if (endpoint === "/api/outfits") { setHistory(data.outfits ?? []); setNextCursor(data.nextCursor ?? null); }
      } catch {
        if (!controller.signal.aborted) setLoadErrors(current => [...current, endpoint]);
      }
    });
    return () => { controller.abort(); current.active = false; };
  }, []);

  const analysis: ClothingAnalysis | null = selectedItem ? {
    type: selectedItem.category,
    primaryColor: selectedItem.color,
    secondaryColor: selectedItem.secondary_color ?? undefined,
    pattern: selectedItem.pattern ?? "plain",
    style: selectedItem.style,
    material: selectedItem.material ?? undefined,
    description: selectedItem.description ?? `${selectedItem.name} in ${selectedItem.color}`,
  } : uploadedAnalysis;

  async function handleAnalyzeUpload(file: File) {
    const valError = validateImageFile(file, 10);
    if (valError) {
      toast(valError, "error");
      return;
    }

    const version = ++uploadVersion.current;
    setUploading(true);
    try {
      const base64Data = await compressImage(file, 1200, 0.82);
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const compressedBlob = new Blob([byteArray], { type: "image/jpeg" });
      const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
        type: "image/jpeg",
      });

      const formData = new FormData();
      formData.append("file", compressedFile);

      const response = await fetch("/api/upload-item", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Could not analyze image.");
      }

      if (version !== uploadVersion.current) return;
      setSelectedItemId(""); // Unselect wardrobe item since fresh upload is active
      setAnalysis(data.analysis);
      toast("Fresh piece analyzed. Ready to generate looks.", "success");
    } catch (uploadError) {
      if (version !== uploadVersion.current) return;
      toast(uploadError instanceof Error ? uploadError.message : "Upload failed.", "error");
    } finally {
      if (version === uploadVersion.current) setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function generate(vibeOverride?: StyleCategory) {
    if (!analysis) {
      toast("Select a wardrobe piece or upload a fresh garment photo first.", "info");
      return;
    }

    if (generating || uploading) return;
    const version = ++batchVersion.current;
    const source = selectedItemId || null;
    const vibe = vibeOverride ?? vibeCycle[vibeIndex];
    setGenerating(true);
    try {
      const response = await fetch("/api/generate-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis,
          count: 4,
          vibeOverride: vibe,
          styleProfile: profile ?? undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Could not generate outfit suggestions.");
      }

      if (!lifecycle.current.active || version !== batchVersion.current) return;
      setOutfits(data.outfits || []);
      setSourceItemId(source);
      setGeneratedImages({});
      setGeneratedPaths({});
      toast(`Generated ${data.outfits.length} styled outfits (${vibe})`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Outfit generation failed.", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function saveOutfit(outfit: OutfitSuggestion) {
    setSavingId(outfit.id);
    try {
      const response = await fetch("/api/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceItemId,
          data: [{ ...outfit, imagePath: generatedPaths[outfit.id] ?? outfit.imagePath }],
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Could not save outfit.");
      }

      toast(`"${outfit.name}" saved to your collection.`, "success");
      await loadHistory();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save outfit.", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteSavedOutfit(id: string) {
    setDeleting(true);
    try {
      const response = await fetch(`/api/outfits?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error("Could not delete saved look.");
      setHistory(current => current.filter(entry => entry.id !== id));
      setDeleteEntry(null);
      toast("Saved look removed.", "success");
    } catch (error) { toast(error instanceof Error ? error.message : "Could not delete saved look.", "error"); }
    finally { setDeleting(false); }
  }

  async function generateOutfitPicture(outfit: OutfitSuggestion) {
    const version = batchVersion.current;
    setImageLoadingId(outfit.id);

    try {
      // Phase 4 fix: Send outfitName explicitly so AI prompt receives proper name
      const pendingPath = generatedPaths[outfit.id] ?? outfit.imagePath;
      const retryUrl = pendingPath && !generatedImages[outfit.id];
      const response = retryUrl ? await fetch(`/api/outfit-image?path=${encodeURIComponent(pendingPath)}`) : await fetch("/api/generate-outfit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...outfit,
          outfitName: outfit.name,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Could not generate editorial lookbook image.");
      }

      if (!lifecycle.current.active || version !== batchVersion.current) return;
      if (data.storagePath) setGeneratedPaths(current => ({ ...current, [outfit.id]: data.storagePath }));
      if (!data.signedUrl) {
        toast("Image saved. Preview is temporarily unavailable; retry the preview without generating again.", "info");
        return;
      }
      setGeneratedImages(current => ({ ...current, [outfit.id]: data.signedUrl }));
      toast("AI lookbook image generated successfully. Save the look to keep it in your archive.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Image generation failed.", "error");
    } finally {
      if (version === batchVersion.current) setImageLoadingId(null);
    }
  }

  function tryDifferentVibe() {
    const nextIndex = (vibeIndex + 1) % vibeCycle.length;
    setVibeIndex(nextIndex);
    void generate(vibeCycle[nextIndex]);
  }

  const currentVibeLabel = vibeCycle[vibeIndex];

  return (
    <main className="min-h-[calc(100vh-5rem)] pt-20 bg-bg text-fg">
      {loadErrors.length > 0 && <div role="alert" className="px-6 py-3 text-danger">Some saved data could not be loaded. Other sections remain available. <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Reload</Button></div>}
      {/* 1. Top Source Bar */}
      <section className="border-b border-border bg-bg-elevated/80 backdrop-blur-xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="eyebrow text-accent-text mb-1 inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                OUTFIT ENGINE
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-fg">
                Select your source piece.
              </h1>
            </div>

            {/* Action Buttons: Generate Outfits + Cycle Vibe */}
            <div className="flex items-center gap-3">
              <Button
                variant="accent"
                size="md"
                onClick={() => void generate()}
                loading={generating}
                disabled={uploading || imageLoadingId !== null}
                icon={<Wand2 className="h-4 w-4" />}
                className="uppercase tracking-wider font-bold text-xs"
              >
                Generate outfits
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={tryDifferentVibe}
                disabled={generating || uploading || imageLoadingId !== null}
                icon={<RefreshCcw className="h-3.5 w-3.5" />}
                className="text-xs"
              >
                <span>Try vibe: </span>
                <span className="font-mono text-accent-text font-bold uppercase ml-1">
                  {currentVibeLabel}
                </span>
              </Button>
            </div>
          </div>

          {/* Horizontal Thumbnail Picker (72px squares) + Upload Tile */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {/* Upload New Garment Tile */}
            <div className="shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAnalyzeUpload(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-[72px] w-[72px] rounded-[4px] border border-dashed border-border-strong bg-bg-raised hover:border-accent-ring hover:bg-bg-raised/80 flex flex-col items-center justify-center text-center p-2 text-fg-muted hover:text-fg transition cursor-pointer"
                aria-label="Upload new clothing piece"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-accent-text" />
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4 mb-1" />
                    <span className="text-[10px] font-mono leading-none">Upload</span>
                  </>
                )}
              </button>
            </div>

            {/* Wardrobe Items Thumbnails */}
            {wardrobeItems.map((item) => {
              const isSelected = selectedItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { uploadVersion.current++; setUploading(false); setSelectedItemId(item.id); }}
                  role="radio"
                  aria-checked={isSelected}
                  className={`group relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[4px] border transition-all cursor-pointer ${
                    isSelected
                      ? "border-accent-text ring-2 ring-accent-ring shadow-[0_0_12px_rgba(196,98,45,0.2)]"
                      : "border-border hover:border-border-strong opacity-70 hover:opacity-100"
                  }`}
                  aria-label={`Select ${item.name}`}
                >
                  {item.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-bg-raised flex items-center justify-center text-[10px] font-mono text-fg-subtle p-1 text-center">
                      {item.name.substring(0, 10)}
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-accent text-[#0A0A0B] flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Inline Detected Item Summary */}
          {analysis && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
              <span className="eyebrow text-fg-subtle mr-1">DETECTED:</span>
              <Badge variant="accent">{analysis.type}</Badge>
              <Badge variant="default">{analysis.primaryColor}</Badge>
              <Badge variant="outline">{analysis.style}</Badge>
              {analysis.material && <Badge variant="muted">{analysis.material}</Badge>}
              <span className="text-fg-muted font-normal text-xs ml-2 italic max-w-xl truncate">
                &ldquo;{analysis.description}&rdquo;
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 2. Results Section (Editorial 2-Column Cards) */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-12">
        {outfits.length === 0 ? (
          <EmptyState
            imageSrc={IMAGES.emptyOutfits.src}
            imageAlt="Outfit Styling Lookbook"
            eyebrow="AI STYLIST READY"
            headline="Pick a piece and we will build four ways to wear it."
            body="Select any garment from your wardrobe above or upload a fresh photo. FitMatch will coordinate outerwear, base layers, footwear, and accessories."
            action={
              <Button
                variant="accent"
                onClick={() => void generate()}
                loading={generating}
                disabled={uploading || imageLoadingId !== null}
                icon={<Wand2 className="h-4 w-4" />}
              >
                Generate 4 Styled Directions
              </Button>
            }
          />
        ) : (
          <div className="space-y-10">
            <div className="flex items-baseline justify-between border-b border-border pb-4">
              <div>
                <div className="eyebrow text-accent-text">AI GENERATION</div>
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-fg">
                  Curated looks for this piece.
                </h2>
              </div>
              {profile?.primaryStyle && (
                <span className="font-mono text-xs text-fg-subtle uppercase">
                  Tuned for {profile.primaryStyle}
                </span>
              )}
            </div>

            <div className="space-y-8">
              {outfits.map((outfit, index) => {
                const isImageLoading = imageLoadingId === outfit.id;
                const generatedImg = generatedImages[outfit.id];

                return (
                  <article
                    key={outfit.id || `outfit-${index}`}
                    className="rounded-[8px] border border-border bg-bg-elevated overflow-hidden p-6 sm:p-8 transition-colors hover:border-border-strong"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      {/* Left Hero: AI Generated Image / Placeholder Slot (3:4 Aspect) */}
                      <div className="lg:col-span-5 relative aspect-[3/4] w-full overflow-hidden rounded-[2px] border border-border bg-bg-raised flex flex-col items-center justify-center">
                        {isImageLoading ? (
                          /* Shimmering Skeleton with intentional message */
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-bg-raised">
                            <motion.div
                              animate={{ opacity: [0.4, 0.9, 0.4] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                              className="flex flex-col items-center gap-3"
                            >
                              <div className="h-10 w-10 rounded-full border border-accent-ring bg-accent-soft flex items-center justify-center text-accent-text">
                                <Sparkles className="h-5 w-5 animate-pulse" />
                              </div>
                              <div className="eyebrow text-accent-text">Rendering your look…</div>
                              <p className="text-xs text-fg-subtle max-w-xs">
                                Synthesizing editorial model and garment composition.
                              </p>
                            </motion.div>
                          </div>
                        ) : generatedImg ? (
                          <div className="relative h-full w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={generatedImg}
                              alt={`${outfit.name} AI lookbook preview`}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute bottom-3 right-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void generateOutfitPicture(outfit)}
                                disabled={imageLoadingId !== null || generating}
                                className="bg-bg/85 backdrop-blur-md text-xs py-1"
                              >
                                Re-render
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Empty Placeholder Tile with CTA */
                          <div className="p-8 text-center space-y-4">
                            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-subtle">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                              <div className="font-display text-lg font-bold text-fg">
                                High-Fashion Preview
                              </div>
                              <p className="text-xs text-fg-muted max-w-xs leading-relaxed">
                                Render a photorealistic lookbook image with AI on a model.
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void generateOutfitPicture(outfit)}
                              disabled={imageLoadingId !== null || generating}
                              icon={<Sparkles className="h-3.5 w-3.5 text-accent-text" />}
                              className="border-accent-ring/60 text-xs"
                            >
                              {generatedPaths[outfit.id] || outfit.imagePath ? "Retry preview" : "Generate AI picture"}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Right Breakdown: Header, Pieces, Reasoning */}
                      <div className="lg:col-span-7 space-y-6">
                        {/* Header Row */}
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="accent">{outfit.styleCategory}</Badge>
                              {outfit.occasion && <Badge variant="outline">{outfit.occasion}</Badge>}
                            </div>

                            {/* Confidence Visual Meter */}
                            <div className="flex items-center gap-2">
                              <span className="eyebrow text-[10px] text-fg-subtle">MATCH</span>
                              <div className="h-1.5 w-20 bg-bg-raised rounded-full overflow-hidden border border-border">
                                <div
                                  className="h-full bg-accent transition-all duration-500"
                                  style={{ width: `${Math.min(outfit.confidenceScore, 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs font-bold tabular-nums text-accent-text">
                                {outfit.confidenceScore}%
                              </span>
                            </div>
                          </div>

                          <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-fg">
                            {outfit.name}
                          </h3>
                        </div>

                        {/* Dedicated Right-Aligned Action Row */}
                        <div className="flex items-center justify-end gap-3 pt-1 border-t border-border/50">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void saveOutfit(outfit)}
                            disabled={savingId !== null || isImageLoading}
                            loading={savingId === outfit.id}
                            icon={<Bookmark className="h-3.5 w-3.5" />}
                          >
                            Save look
                          </Button>
                          <Button
                            variant="accent"
                            size="sm"
                            onClick={() => void generateOutfitPicture(outfit)}
                            disabled={imageLoadingId !== null || generating}
                            loading={isImageLoading}
                            icon={<Sparkles className="h-3.5 w-3.5" />}
                          >
                            {generatedImg ? "Regenerate picture" : generatedPaths[outfit.id] || outfit.imagePath ? "Retry preview" : "Generate AI picture"}
                          </Button>
                        </div>

                        {/* Outfit Pieces (Vertical list with color swatches) */}
                        <div className="space-y-3">
                          <div className="eyebrow text-fg-subtle">Primary Outfit Pieces</div>
                          <div className="space-y-2">
                            {outfit.items.map((item, idx) => {
                              const swatch = getColorHex(item.suggestedColor);
                              return (
                                <div
                                  key={`${outfit.id}-item-${idx}`}
                                  className="flex items-center justify-between p-3 rounded-[4px] border border-border/60 bg-bg-raised/50"
                                >
                                  <div className="flex items-center gap-3">
                                    <span
                                      className="h-3 w-3 rounded-full border border-white/20 shrink-0"
                                      style={{ backgroundColor: swatch }}
                                    />
                                    <div>
                                      <div className="text-xs font-semibold text-fg">
                                        {item.description}
                                      </div>
                                      <div className="text-[11px] text-fg-subtle font-mono">
                                        {item.category} · {item.suggestedColor}
                                      </div>
                                    </div>
                                  </div>
                                  {item.notes && (
                                    <span className="text-[11px] text-fg-muted font-normal max-w-xs text-right hidden sm:block">
                                      {item.notes}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Accessories */}
                        {outfit.accessories?.length > 0 && (
                          <div className="space-y-2">
                            <div className="eyebrow text-fg-subtle">Accessories</div>
                            <div className="flex flex-wrap gap-2">
                              {outfit.accessories.map((acc, idx) => (
                                <span
                                  key={`${outfit.id}-acc-${idx}`}
                                  className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-bg-raised px-2.5 py-1 text-xs text-fg-muted"
                                >
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: getColorHex(acc.suggestedColor) }}
                                  />
                                  <span>{acc.description}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Labeled Intelligence Paragraphs (Color & Style Reasoning) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/50">
                          <div className="rounded-[4px] border border-border/60 bg-bg-raised/30 p-4 space-y-1.5">
                            <div className="eyebrow text-[10px] text-accent-text">
                              Palette Dynamics
                            </div>
                            <p className="text-xs text-fg-muted leading-relaxed font-normal">
                              {outfit.colorExplanation}
                            </p>
                          </div>

                          <div className="rounded-[4px] border border-border/60 bg-bg-raised/30 p-4 space-y-1.5">
                            <div className="eyebrow text-[10px] text-accent-text">
                              Silhouette & Balance
                            </div>
                            <p className="text-xs text-fg-muted leading-relaxed font-normal">
                              {outfit.styleExplanation}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Saved Outfits History Strip */}
        <section className="pt-12 border-t border-border space-y-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-accent-text" />
            <h3 className="font-display text-xl font-bold tracking-tight text-fg">
              Saved outfit archive
            </h3>
          </div>

          {history.length === 0 ? (
            <p className="text-xs text-fg-subtle">No outfits saved to your archive yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((entry) => {
                const firstOutfit = entry.data_json[0];
                return (
                  <div
                    key={entry.id}
                    className="rounded-[4px] border border-border bg-bg-elevated p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-fg-subtle tabular-nums">
                        {formatDate(entry.created_at)}
                      </span>
                      {firstOutfit?.styleCategory && (
                        <Badge variant="outline" size="sm">
                          {firstOutfit.styleCategory}
                        </Badge>
                      )}
                    </div>

                    {firstOutfit?.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={firstOutfit.imageUrl} alt={firstOutfit.name} className="w-full aspect-square object-cover rounded" />
                    )}
                    <Button variant="outline" size="sm" disabled={generating} onClick={() => { batchVersion.current++; setImageLoadingId(null); setSourceItemId(entry.source_item_id ?? null); setOutfits(entry.data_json); setGeneratedPaths(Object.fromEntries(entry.data_json.filter(o => o.imagePath).map(o => [o.id, o.imagePath!]))); setGeneratedImages(Object.fromEntries(entry.data_json.filter(o => o.imageUrl).map(o => [o.id, o.imageUrl!]))); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Open saved look</Button>
                    {deleteEntry === entry.id ? <div className="flex gap-2"><Button variant="outline" size="sm" loading={deleting} onClick={() => void deleteSavedOutfit(entry.id)}>Confirm delete</Button><Button variant="ghost" size="sm" disabled={deleting} onClick={() => setDeleteEntry(null)}>Cancel</Button></div> : <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteEntry(entry.id)}>Delete saved look</Button>}
                    <h4 className="font-display text-base font-bold text-fg">
                      {firstOutfit?.name ?? "Archived Outfit"}
                    </h4>

                    <p className="text-xs text-fg-muted line-clamp-2 leading-relaxed">
                      {firstOutfit?.styleExplanation ?? "Saved styling formula."}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          {nextCursor && <Button variant="outline" loading={historyLoading} onClick={() => void loadHistory(nextCursor)}>Load more saved looks</Button>}
        </section>
      </div>
    </main>
  );
}
