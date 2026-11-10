"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  UploadCloud,
  Search,
  X,
  Camera,
  Check,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CLOTHING_CATEGORIES,
  STYLE_CATEGORIES,
  PATTERN_TYPES,
  WardrobeItem,
} from "@/lib/types";
import {
  compressImage,
  validateImageFile,
  getColorHex,
} from "@/lib/utils";
import { IMAGES } from "@/lib/images";
import { categoryLabels, styleLabels, patternLabels } from "@/lib/wardrobe-labels";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { Chip } from "@/components/ui/Chip";
import { Drawer } from "@/components/ui/Drawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { AnalysisPanel, useWardrobeAnalyses } from "@/components/v2/WardrobeAnalysis";
import { plural } from "@/lib/plural";

type DraftItem = {
  name: string;
  category: string;
  color: string;
  secondaryColor: string;
  style: string;
  pattern: string;
  material: string;
  description: string;
  notes: string;
  imagePath: string;
};

const emptyDraft: DraftItem = {
  name: "",
  category: "shirt",
  color: "",
  secondaryColor: "",
  style: "casual",
  pattern: "plain",
  material: "",
  description: "",
  notes: "",
  imagePath: "",
};

export default function WardrobePage() {
  const uploadVersion = useRef(0);
  const draftVersion = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [draft, setDraft] = useState<DraftItem>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  useEffect(() => () => { if (uploadedPreview?.startsWith("blob:")) URL.revokeObjectURL(uploadedPreview); }, [uploadedPreview]);
  const [dragOver, setDragOver] = useState(false);

  const [filters, setFilters] = useState({ category: "", color: "", style: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const analyses = useWardrobeAnalyses();

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category) count++;
    if (filters.style) count++;
    if (filters.color) count++;
    return count;
  }, [filters]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const categoryMatch = !filters.category || item.category === filters.category;
        const styleMatch = !filters.style || item.style === filters.style;
        const colorMatch =
          !filters.color ||
          (item.color ?? "").toLowerCase().includes(filters.color.toLowerCase()) ||
          (item.secondary_color &&
            item.secondary_color.toLowerCase().includes(filters.color.toLowerCase()));
        return categoryMatch && styleMatch && colorMatch;
      }),
    [filters, items]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/wardrobe", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error("Unable to load your wardrobe. Try again; existing items remain saved to your account.");
        setLoadError("");
        setItems(data.items ?? []);
      }).catch(error => { if (!controller.signal.aborted) setLoadError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [toast, reloadKey]);

  function openAddDrawer() {
    draftVersion.current++;
    uploadVersion.current++;
    setUploading(false);
    setDraft(emptyDraft);
    setEditingId(null);
    setUploadedPreview(null);
    setIsDrawerOpen(true);
  }

  function openEditDrawer(item: WardrobeItem) {
    draftVersion.current++;
    uploadVersion.current++;
    setUploading(false);
    setEditingId(item.id);
    setDraft({
      name: item.name,
      category: item.category,
      color: item.color ?? "",
      secondaryColor: item.secondary_color ?? "",
      style: item.style ?? "",
      pattern: item.pattern ?? "plain",
      material: item.material ?? "",
      description: item.description ?? "",
      notes: item.notes ?? "",
      imagePath: item.image_path ?? "",
    });
    setUploadedPreview(item.imageUrl ?? null);
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    draftVersion.current++;
    uploadVersion.current++;
    setUploading(false);
    setIsDrawerOpen(false);
    setEditingId(null);
    setUploadedPreview(null);
  }

  async function handleFileProcess(file: File) {
    const validationError = validateImageFile(file, 10);
    if (validationError) {
      toast(validationError, "error");
      return;
    }

    const version = ++uploadVersion.current;
    setUploading(true);
    try {
      // Compress client side first
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

      if (version !== uploadVersion.current) return;
      // Show local preview
      const previewUrl = URL.createObjectURL(compressedFile);
      setUploadedPreview(previewUrl);

      const formData = new FormData();
      formData.append("file", compressedFile);

      const uploadResponse = await fetch("/api/upload-item", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok || !uploadData.success) {
        throw new Error(uploadData.error ?? "Unable to analyze this image. You can enter the details yourself.");
      }

      if (version !== uploadVersion.current) return;
      // Auto-fill metadata into draft
      setDraft((current) => ({
        ...current,
        name: current.name || `${uploadData.analysis.primaryColor} ${uploadData.analysis.type}`,
        category: uploadData.analysis.type,
        color: uploadData.analysis.primaryColor,
        secondaryColor: uploadData.analysis.secondaryColor ?? "",
        style: uploadData.analysis.style,
        pattern: uploadData.analysis.pattern,
        material: uploadData.analysis.material ?? "",
        description: uploadData.analysis.description,
        imagePath: uploadData.storagePath,
      }));

      toast("Suggested details added. Please review them before saving.", "success");
    } catch (uploadError) {
      if (version !== uploadVersion.current) return;
      toast(uploadError instanceof Error ? uploadError.message : "Unable to upload the image. Please try again.", "error");
    } finally {
      if (version === uploadVersion.current) setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    const version = draftVersion.current;
    const itemId = editingId;
    setSaving(true);

    try {
      const response = await fetch(editingId ? `/api/wardrobe/${editingId}` : "/api/wardrobe", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Unable to save this item.");
      }

      if (itemId) {
        setItems((current) => current.map((item) => (item.id === itemId ? data.item : item)));
        toast("Wardrobe item updated.", "success");
      } else {
        setItems((current) => [data.item, ...current]);
        toast("New item saved to wardrobe.", "success");
      }

      if (version === draftVersion.current) closeDrawer();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to save this item. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const response = await fetch(`/api/wardrobe/${id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Unable to delete this item.");
      }

      setItems((current) => current.filter((item) => item.id !== id));
      setDeleteConfirmId(null);
      toast("Item removed from wardrobe.", "info");

      if (editingId === id) {
        closeDrawer();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to delete this item. Please try again.", "error");
    }
  }

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-bg text-fg pt-20">
      {/* Sticky Top Header Bar */}
      <div className="sticky top-20 z-30 border-b border-border bg-bg/90 backdrop-blur-xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-fg">
              Your wardrobe
            </h1>
            <span className="font-mono text-xs sm:text-sm font-semibold tabular-nums text-accent-text">
              ({loadError && !items.length ? "—" : plural(items.length, "item")})
            </span>
          </div>

          <Button
            variant="accent"
            size="md"
            onClick={openAddDrawer}
            icon={<Plus className="h-4 w-4" />}
          >
            Add item
          </Button>
        </div>

        {/* Filter Controls Row */}
        <div className="mx-auto max-w-7xl mt-4 pt-3 border-t border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
              <Filter className="h-3.5 w-3.5" />
              <span className="eyebrow text-[10px]">Filters</span>
            </div>

            {/* Category Chips Scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full sm:max-w-md scrollbar-none">
              <Chip
                active={!filters.category}
                onClick={() => setFilters((f) => ({ ...f, category: "" }))}
              >
                All categories
              </Chip>
              {CLOTHING_CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  active={filters.category === cat}
                  onClick={() =>
                    setFilters((f) => ({ ...f, category: f.category === cat ? "" : cat }))
                  }
                >
                  {categoryLabels[cat] ?? cat}
                </Chip>
              ))}
            </div>

            {/* Style Chips */}
            <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto pb-1 max-w-sm scrollbar-none">
              <Chip
                active={!filters.style}
                onClick={() => setFilters((f) => ({ ...f, style: "" }))}
              >
                All styles
              </Chip>
              {STYLE_CATEGORIES.map((st) => (
                <Chip
                  key={st}
                  active={filters.style === st}
                  onClick={() =>
                    setFilters((f) => ({ ...f, style: f.style === st ? "" : st }))
                  }
                >
                  {styleLabels[st] ?? st}
                </Chip>
              ))}
            </div>
          </div>

          {/* Color Search & Clear Active Filters */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="w-48 sm:w-56">
              <Input
                aria-label="Find items by color"
                placeholder="Search by color…"
                value={filters.color}
                onChange={(e) => setFilters((f) => ({ ...f, color: e.target.value }))}
                icon={<Search className="h-3.5 w-3.5" />}
                className="h-8 text-xs py-1.5"
              />
            </div>

            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => setFilters({ category: "", color: "", style: "" })}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-accent-text hover:underline cursor-pointer"
              >
                <X className="h-3 w-3" />
                Clear filters ({activeFilterCount})
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Wardrobe Grid / States */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loadError && <div role="alert" className="mb-6 rounded-2xl border border-danger/40 p-5 text-sm"><p className="text-danger">{loadError}</p><button type="button" disabled={loading} onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }} className="mt-3 min-h-11 rounded-full border border-border px-5 py-2 disabled:opacity-50">{loading ? "Retrying…" : "Try loading wardrobe again"}</button></div>}
        {loadError && !items.length && !loading ? null : loading ? (
          /* 8-Card Skeleton Loading */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`skel-${i}`} className="space-y-3">
                <Skeleton className="aspect-[3/4] w-full rounded-[2px]" />
                <Skeleton className="h-4 w-3/4 rounded-[2px]" />
                <Skeleton className="h-3 w-1/2 rounded-[2px]" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          /* Empty State */
          <EmptyState
            imageSrc={IMAGES.emptyWardrobe.src}
            imageAlt="No items in your wardrobe yet"
            eyebrow="PERSONAL WARDROBE"
            headline="Your wardrobe is empty"
            body="Add a photo and details for your first item. You can organize your wardrobe before creating an avatar."
            action={
              <Button variant="accent" onClick={openAddDrawer} icon={<Plus className="h-4 w-4" />}>
                Add your first item
              </Button>
            }
          />
        ) : filteredItems.length === 0 ? (
          /* Filter Empty State */
          <div className="py-20 text-center space-y-3">
            <p className="font-display text-2xl font-bold text-fg">No items match your filters.</p>
            <p className="text-xs text-fg-muted">
              Remove a color, category or style filter to see more.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ category: "", color: "", style: "" })}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          /* Responsive 2 / 3 / 4 / 5 Column Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {filteredItems.map((item) => {
              const swatchColor = getColorHex(item.color ?? "");
              const isConfirmingDelete = deleteConfirmId === item.id;

              return (
                <article
                  key={item.id}
                  className="group relative flex flex-col rounded-[2px] transition-all duration-300"
                >
                  {/* Image Container with 3:4 Aspect & Hover Reveal */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[2px] border border-border bg-bg-elevated transition-colors group-hover:border-border-strong">
                    {item.imageUrl ? (
                      /* Plain <img> for Supabase signed rotating URLs per constraint */
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-xs text-fg-subtle bg-bg-raised">
                        <span className="font-mono text-lg mb-1 opacity-40">∅</span>
                        <span>No image provided</span>
                      </div>
                    )}

                    {/* Gradient Overlay with Chips on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-elevated/95 via-bg-elevated/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 pointer-events-none">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-[2px] bg-bg/80 border border-border px-2 py-0.5 text-[10px] font-mono uppercase text-fg">
                          <span
                            className="h-2 w-2 rounded-full border border-white/20"
                            style={{ backgroundColor: swatchColor }}
                          />
                          {item.color}
                        </span>
                        <span className="rounded-[2px] bg-bg/80 border border-border px-2 py-0.5 text-[10px] font-mono uppercase text-fg-muted">
                          {item.style}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons Top-Right on Hover */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                      <button
                        type="button"
                        onClick={() => openEditDrawer(item)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border-strong bg-bg-elevated/90 text-fg hover:bg-bg-raised hover:text-accent-text transition cursor-pointer shadow-md"
                        aria-label={`Edit ${item.name}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border-strong bg-bg-elevated/90 text-fg-muted hover:bg-danger/20 hover:text-danger transition cursor-pointer shadow-md"
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Delete Confirmation Popover (No browser confirm alert) */}
                    {isConfirmingDelete && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-bg/95 backdrop-blur-sm p-4 text-center space-y-3">
                        <p className="text-xs font-semibold text-fg">Delete this item?</p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                          >
                            Delete
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Compact Two-Line Typography Block Below Image */}
                  <div className="mt-2.5 space-y-0.5">
                    <h3 className="font-display text-sm font-bold text-fg truncate">
                      {item.name}
                    </h3>
                    <p className="text-xs text-fg-muted uppercase tracking-wider font-mono text-[11px] truncate">
                      {categoryLabels[item.category] ?? item.category}
                      {item.material ? ` · ${item.material}` : ""}
                    </p>
                  </div>
                  {analyses.enabled && (
                    <AnalysisPanel
                      itemId={item.id}
                      itemName={item.name}
                      hasImage={!!item.image_path}
                      analysis={analyses.byItem[item.id]}
                      workerOnline={analyses.workerOnline}
                      gpuBusy={analyses.gpuBusy}
                      onUpdate={analyses.put}
                      onWardrobeChanged={() => setReloadKey((k) => k + 1)}
                    />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Right-Side Slide-Over Drawer for Add / Edit Item */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        eyebrow="YOUR WARDROBE"
        title={editingId ? "Edit item" : "Add item"}
        description="Add a photo or enter the details yourself. Review the fields before saving."
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Top Drag & Drop Upload Zone + Camera Capture */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFileProcess(file);
            }}
            className={`relative flex flex-col items-center justify-center p-6 border border-dashed rounded-[4px] transition-colors duration-150 text-center ${
              dragOver
                ? "border-accent-text bg-accent-soft"
                : "border-border-strong bg-bg-raised/40 hover:border-border-strong hover:bg-bg-raised"
            }`}
          >
            {/* Hidden Inputs for File Browser & Camera Capture */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileProcess(file);
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileProcess(file);
              }}
            />

            {uploading ? (
              <div className="py-6 space-y-3">
                <div className="h-1 w-36 mx-auto bg-bg-raised rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-accent"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                  />
                </div>
                <div className="eyebrow text-accent-text animate-pulse">Processing image…</div>
              </div>
            ) : uploadedPreview ? (
              <div className="space-y-3">
                <div className="relative h-32 w-24 mx-auto overflow-hidden rounded-[2px] border border-border shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedPreview}
                    alt="Your uploaded item photo"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change photo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-bg-raised text-fg-muted border border-border">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-fg">
                    Drag a photo here or{" "}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-accent-text hover:underline font-bold cursor-pointer"
                    >
                      choose a photo
                    </button>
                  </p>
                  <p className="text-[11px] text-fg-subtle">
                    JPG, PNG or WebP · Up to 10 MB
                  </p>
                </div>
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                    icon={<Camera className="h-3.5 w-3.5" />}
                  >
                    Take photo
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Form Fields with AI Auto-Fill Animation */}
          <AnimatePresence>
            <motion.div
              key="form-fields"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <Field label="Item name" htmlFor="field-name" required>
                <Input
                  id="field-name"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. White crew-neck T-shirt"
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Category" htmlFor="field-category">
                  <Select
                    id="field-category"
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  >
                    {CLOTHING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {categoryLabels[cat] ?? cat}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Style" htmlFor="field-style">
                  <Select
                    id="field-style"
                    required
                    value={draft.style}
                    onChange={(e) => setDraft((d) => ({ ...d, style: e.target.value }))}
                  >
                    <option value="" disabled>Choose a style</option>
                    {STYLE_CATEGORIES.map((st) => (
                      <option key={st} value={st}>
                        {styleLabels[st] ?? st}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Main color" htmlFor="field-color" required>
                  <Input
                    id="field-color"
                    value={draft.color}
                    onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                    placeholder="e.g. Black"
                    required
                  />
                </Field>

                <Field label="Secondary color" htmlFor="field-sec-color">
                  <Input
                    id="field-sec-color"
                    value={draft.secondaryColor}
                    onChange={(e) => setDraft((d) => ({ ...d, secondaryColor: e.target.value }))}
                    placeholder="e.g. Cream"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Pattern" htmlFor="field-pattern">
                  <Select
                    id="field-pattern"
                    value={draft.pattern}
                    onChange={(e) => setDraft((d) => ({ ...d, pattern: e.target.value }))}
                  >
                    {PATTERN_TYPES.map((p) => (
                      <option key={p} value={p}>
                        {patternLabels[p] ?? p}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Material" htmlFor="field-material">
                  <Input
                    id="field-material"
                    value={draft.material}
                    onChange={(e) => setDraft((d) => ({ ...d, material: e.target.value }))}
                    placeholder="e.g. Cotton"
                  />
                </Field>
              </div>

              <Field label="Item description" htmlFor="field-desc">
                <Textarea
                  id="field-desc"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Neckline, sleeves, logo details or stitching…"
                  rows={2}
                />
              </Field>

              <Field label="Styling notes" htmlFor="field-notes">
                <Textarea
                  id="field-notes"
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Favorite combinations, weather or care notes…"
                  rows={2}
                />
              </Field>
            </motion.div>
          </AnimatePresence>

          {/* Drawer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="accent"
              loading={saving}
              disabled={uploading}
              icon={<Check className="h-4 w-4" />}
            >
              {editingId ? "Save changes" : "Save to wardrobe"}
            </Button>
          </div>
        </form>
      </Drawer>
    </main>
  );
}
