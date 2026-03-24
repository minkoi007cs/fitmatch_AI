// ============================================================
// Utility Constants & Helpers
// ============================================================

import { StyleCategory } from "./types";

export const STYLE_COLORS: Record<StyleCategory, { bg: string; text: string; border: string }> = {
  casual: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  streetwear: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  minimal: { bg: "bg-zinc-500/10", text: "text-zinc-300", border: "border-zinc-500/20" },
  formal: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  sporty: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  bohemian: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  preppy: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  vintage: { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/20" },
};

export const CATEGORY_ICONS: Record<string, string> = {
  shirt: "👔",
  "t-shirt": "👕",
  hoodie: "🧥",
  jacket: "🧥",
  sweater: "🧶",
  blazer: "🤵",
  pants: "👖",
  jeans: "👖",
  shorts: "🩳",
  skirt: "👗",
  dress: "👗",
  shoes: "👞",
  sneakers: "👟",
  boots: "🥾",
  hat: "🎩",
  bag: "👜",
  watch: "⌚",
  accessory: "💍",
  other: "🏷️",
};

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function compressImage(file: File, maxWidth = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
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
