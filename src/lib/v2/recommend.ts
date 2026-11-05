import type { StyleAnswers } from "./contracts";
export type Candidate = {
  id: string;
  name: string;
  category: string;
  color: string;
  style: string;
  pattern?: string | null;
  is_favorite?: boolean | null;
};
export type SuggestedLook = {
  id: string;
  name: string;
  itemId: string;
  itemName: string;
  category: string;
  reason: string;
  renderScope: "top-only";
  engine: "rules-v1";
};
const colors: Record<string, string[]> = {
  black: ["black", "đen"],
  white: ["white", "trắng"],
  cream: ["cream", "beige", "kem"],
  blue: ["blue", "xanh dương", "xanh lam", "xanh da trời"],
  navy: ["navy", "xanh than"],
  brown: ["brown", "nâu"],
  gray: ["gray", "grey", "xám"],
  olive: ["olive", "ô liu", "xanh rêu"],
  red: ["red", "đỏ"],
  pink: ["pink", "hồng"],
};
/** Deterministic baseline; only selects owned inventory supplied by the server, never invents IDs. */
export function recommend(
  candidates: Candidate[],
  profile: StyleAnswers,
  feedback: Record<string, "like" | "skip"> = {},
): SuggestedLook[] {
  const available = candidates.filter(
    (i) =>
      ["shirt", "t-shirt"].includes(i.category) &&
      feedback[i.id] !== "skip" &&
      !profile.avoidPatterns.includes(
        i.pattern as StyleAnswers["avoidPatterns"][number],
      ),
  );
  const scored = available
    .map((item) => {
      const color = profile.favoriteColors.some((c) =>
        colors[c].some((word) => item.color.toLocaleLowerCase().includes(word)),
      );
      const style = item.style === profile.style;
      const formal =
        profile.occasion === "work" || profile.occasion === "evening";
      const score =
        (color ? 3 : 0) +
        (style ? 4 : 0) +
        (item.is_favorite ? 1 : 0) +
        (feedback[item.id] === "like" ? 2 : 0) +
        (formal && item.category === "shirt" ? 2 : 0);
      return { item, score, color, style };
    })
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  // Alternate categories when similarly suitable, rather than identical top suggestions.
  const chosen: typeof scored = [];
  while (scored.length && chosen.length < 3) {
    const best = scored.shift()!;
    chosen.push(best);
    if (chosen.length === 1) {
      const alternate = scored.findIndex(
        (v) =>
          v.item.category !== best.item.category && v.score >= best.score - 2,
      );
      if (alternate > 0) scored.unshift(scored.splice(alternate, 1)[0]);
    }
  }
  return chosen.map(({ item, color, style }, i) => ({
    id: `look-${i + 1}`,
    name: `${i + 1}. ${item.name}`,
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    renderScope: "top-only",
    engine: "rules-v1",
    reason:
      [
        style ? "Hợp phong cách bạn chọn" : "Một lựa chọn khác từ tủ đồ",
        color ? "có màu bạn yêu thích" : null,
        feedback[item.id] === "like" ? "bạn từng thích áo này" : null,
        profile.occasion === "work" && item.category === "shirt"
          ? "sơ mi phù hợp định hướng đi làm"
          : null,
      ]
        .filter(Boolean)
        .join("; ") +
      ". Phom và độ vừa cần xem trên avatar; chưa được suy ra từ quiz.",
  }));
}
