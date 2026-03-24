"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, UploadCloud } from "lucide-react";
import { CLOTHING_CATEGORIES, STYLE_CATEGORIES, WardrobeItem } from "@/lib/types";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [draft, setDraft] = useState<DraftItem>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ category: "", color: "", style: "" });

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const categoryMatch = !filters.category || item.category === filters.category;
        const styleMatch = !filters.style || item.style === filters.style;
        const colorMatch = !filters.color || item.color.toLowerCase().includes(filters.color.toLowerCase());
        return categoryMatch && styleMatch && colorMatch;
      }),
    [filters, items]
  );

  useEffect(() => {
    void loadWardrobe();
  }, []);

  async function loadWardrobe() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/wardrobe", { cache: "no-store" });
    const data = await response.json();
    setLoading(false);

    if (!response.ok || !data.success) {
      setError(data.error ?? "Could not load wardrobe.");
      return;
    }

    setItems(data.items);
  }

  function resetDraft() {
    setDraft(emptyDraft);
    setEditingId(null);
  }

  async function uploadAndAnalyze(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload-item", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok || !uploadData.success) {
        throw new Error(uploadData.error ?? "Could not upload this image.");
      }

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const response = await fetch(editingId ? `/api/wardrobe/${editingId}` : "/api/wardrobe", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    const data = await response.json();
    setSaving(false);

    if (!response.ok || !data.success) {
      setError(data.error ?? "Could not save wardrobe item.");
      return;
    }

    if (editingId) {
      setItems((current) => current.map((item) => (item.id === editingId ? data.item : item)));
    } else {
      setItems((current) => [data.item, ...current]);
    }

    resetDraft();
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/wardrobe/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      setError(data.error ?? "Could not delete wardrobe item.");
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
    if (editingId === id) {
      resetDraft();
    }
  }

  function handleEdit(item: WardrobeItem) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      category: item.category,
      color: item.color,
      secondaryColor: item.secondary_color ?? "",
      style: item.style,
      pattern: item.pattern ?? "plain",
      material: item.material ?? "",
      description: item.description ?? "",
      notes: item.notes ?? "",
      imagePath: item.image_path ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-xl shadow-black/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Wardrobe manager</div>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">{editingId ? "Edit wardrobe item" : "Add a wardrobe item"}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Upload a photo to auto-fill the clothing metadata, or enter the details manually.
              </p>
            </div>
            <button
              type="button"
              onClick={resetDraft}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
            >
              New item
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <div className="rounded-[1.5rem] border border-dashed border-border bg-background p-5">
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void uploadAndAnalyze(file);
                }
              }} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:opacity-90"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                Upload or capture image
              </button>
              <p className="mt-3 text-xs text-muted-foreground">Camera capture is enabled on supported mobile browsers.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  placeholder="Cream zip hoodie"
                  required
                />
              </Field>
              <Field label="Category">
                <select
                  value={draft.category}
                  onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                >
                  {CLOTHING_CATEGORIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Primary color">
                <input
                  value={draft.color}
                  onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  placeholder="Cream"
                  required
                />
              </Field>
              <Field label="Secondary color">
                <input
                  value={draft.secondaryColor}
                  onChange={(event) => setDraft((current) => ({ ...current, secondaryColor: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  placeholder="Heather gray"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Style">
                <select
                  value={draft.style}
                  onChange={(event) => setDraft((current) => ({ ...current, style: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                >
                  {STYLE_CATEGORIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pattern">
                <input
                  value={draft.pattern}
                  onChange={(event) => setDraft((current) => ({ ...current, pattern: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                />
              </Field>
              <Field label="Material">
                <input
                  value={draft.material}
                  onChange={(event) => setDraft((current) => ({ ...current, material: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
              />
            </Field>

            <Field label="Notes">
              <textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-24 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                placeholder="Fit notes, seasonal notes, or care instructions"
              />
            </Field>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Update item" : "Save item"}
              </button>
              {error ? <div className="text-sm text-red-700">{error}</div> : null}
            </div>
          </form>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-xl shadow-black/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Closet overview</div>
              <h2 className="mt-2 text-3xl font-semibold text-foreground">Your wardrobe</h2>
            </div>
            <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-3">
              <input
                value={filters.color}
                onChange={(event) => setFilters((current) => ({ ...current, color: event.target.value }))}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                placeholder="Filter by color"
              />
              <select
                value={filters.category}
                onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm"
              >
                <option value="">All categories</option>
                {CLOTHING_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={filters.style}
                onChange={(event) => setFilters((current) => ({ ...current, style: event.target.value }))}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm"
              >
                <option value="">All styles</option>
                {STYLE_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-96 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="mt-8 rounded-[1.5rem] border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
              Your wardrobe is empty. Upload your first item to unlock AI outfit suggestions.
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {filteredItems.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-[1.5rem] border border-border bg-background">
                  <div className="aspect-[4/5] bg-secondary">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image</div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{item.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.color}
                          {item.secondary_color ? ` / ${item.secondary_color}` : ""} · {item.style}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="rounded-full border border-border bg-card p-2 text-foreground transition hover:bg-secondary"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item.id)}
                          className="rounded-full border border-border bg-card p-2 text-foreground transition hover:bg-secondary"
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{item.category}</span>
                      {item.pattern ? <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{item.pattern}</span> : null}
                      {item.material ? <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{item.material}</span> : null}
                    </div>
                    {item.description ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.description}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
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
