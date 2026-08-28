// ============================================================
// Utility Constants & Helpers
// ============================================================

import { StyleCategory } from "./types";

export const WARDROBE_BUCKET = "fitmatch-wardrobe";

export const STYLE_COLORS: Record<StyleCategory, { bg: string; text: string; border: string }> = {
  casual: { bg: "bg-sky-500/10", text: "text-sky-300", border: "border-sky-500/20" },
  streetwear: { bg: "bg-amber-500/10", text: "text-amber-300", border: "border-amber-500/20" },
  minimal: { bg: "bg-zinc-500/10", text: "text-zinc-300", border: "border-zinc-500/20" },
  formal: { bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-500/20" },
  sporty: { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/20" },
  bohemian: { bg: "bg-orange-500/10", text: "text-orange-300", border: "border-orange-500/20" },
  preppy: { bg: "bg-rose-500/10", text: "text-rose-300", border: "border-rose-500/20" },
  vintage: { bg: "bg-teal-500/10", text: "text-teal-300", border: "border-teal-500/20" },
};

export const COLOR_SWATCHES: Record<string, string> = {
  black: "#111111",
  white: "#F5F5F0",
  cream: "#EDE8D0",
  olive: "#556B2F",
  navy: "#1B2A4A",
  brown: "#5C4033",
  gray: "#808080",
  grey: "#808080",
  red: "#B22222",
  pink: "#DDA0DD",
  blue: "#4682B4",
  beige: "#D2B48C",
  tan: "#D2B48C",
  charcoal: "#36454F",
  khaki: "#C3B091",
  green: "#2E8B57",
};

export function getColorHex(colorName: string): string {
  const normalized = colorName.toLowerCase().trim();
  return COLOR_SWATCHES[normalized] || "#6A665F";
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Validates file size (max 10MB) and image MIME type
 */
export function validateImageFile(file: File, maxMb = 10): string | null {
  if (!file.type.startsWith("image/")) {
    return "Please upload an image file (JPEG, PNG, WEBP, HEIC).";
  }
  if (file.size > maxMb * 1024 * 1024) {
    return `File is too large. Please upload an image under ${maxMb}MB.`;
  }
  return null;
}

export function compressImage(file: File, maxWidth = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", quality);
        resolve(base64.split(",")[1]);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
