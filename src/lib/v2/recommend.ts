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
  /** top-only when the wardrobe has no jeans yet; full-look pairs an owned top with owned jeans */
  renderScope: "top-only" | "full-look";
  bottomItemId?: string;
  bottomItemName?: string;
  engine: "rules-v1";
};
const NEUTRAL = ["black", "white", "cream", "gray", "navy", "brown"];
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
  const tops = recommendTops(candidates, profile, feedback, 50);
  const jeans = candidates.filter((i) => i.category === "jeans" && feedback[i.id] !== "skip");
  if (!jeans.length) return tops.slice(0, 3).map(publicLook);
  return pairWithJeans(tops, jeans, profile, feedback);
}
function colorFamily(color: string) {
  const lower = color.toLocaleLowerCase();
  return Object.entries(colors).find(([, words]) => words.some((w) => lower.includes(w)))?.[0] ?? null;
}
/**
 * Pairs owned tops with owned jeans. Returns at most three outfits and never more than the
 * wardrobe can make; each outfit uses a different top when possible, then a different jeans.
 */
type RankedTop = SuggestedLook & { itemColor?: string };
function publicLook(look: RankedTop): SuggestedLook {
  const copy = { ...look };
  delete copy.itemColor;
  return copy;
}
function pairWithJeans(
  tops: RankedTop[],
  jeans: Candidate[],
  profile: StyleAnswers,
  feedback: Record<string, "like" | "skip">,
): SuggestedLook[] {
  const bottomScore = (b: Candidate) => {
    const fam = colorFamily(b.color);
    return (
      (b.style === profile.style ? 3 : 0) +
      (fam && profile.favoriteColors.includes(fam as StyleAnswers["favoriteColors"][number]) ? 2 : 0) +
      (b.is_favorite ? 1 : 0) +
      (feedback[b.id] === "like" ? 2 : 0)
    );
  };
  const pairs = tops.flatMap((top, rank) =>
    jeans.map((b) => {
      const topFamily = colorFamily(top.itemColor ?? "");
      const bottomFamily = colorFamily(b.color);
      // A neutral piece on either side keeps a two-piece outfit calm; two strong colors are ranked lower.
      const balanced = !topFamily || !bottomFamily || NEUTRAL.includes(topFamily) || NEUTRAL.includes(bottomFamily) || topFamily === "blue" || bottomFamily === "blue";
      return { top, b, balanced, score: (tops.length - rank) * 2 + bottomScore(b) + (balanced ? 2 : 0) };
    }),
  );
  pairs.sort((x, y) => y.score - x.score || x.top.itemId.localeCompare(y.top.itemId) || x.b.id.localeCompare(y.b.id));
  const chosen: typeof pairs = [];
  for (const pass of [0, 1, 2]) {
    for (const p of pairs) {
      if (chosen.length >= 3) break;
      if (chosen.includes(p)) continue;
      const topUsed = chosen.some((c) => c.top.itemId === p.top.itemId);
      const bottomUsed = chosen.some((c) => c.b.id === p.b.id);
      if ((pass === 0 && (topUsed || bottomUsed)) || (pass === 1 && topUsed)) continue;
      chosen.push(p);
    }
  }
  return chosen.map(({ top, b, balanced }, i) => ({
    ...publicLook(top),
    id: `look-${i + 1}`,
    name: `${i + 1}. ${top.itemName} + ${b.name}`,
    renderScope: "full-look",
    bottomItemId: b.id,
    bottomItemName: b.name,
    reason:
      top.reason.replace(/\. Shape and fit.*$/, "") +
      `; paired with ${b.name}` +
      (balanced ? " (balanced color)" : "") +
      (feedback[b.id] === "like" ? ", a bottom you previously liked" : "") +
      ". Shape and fit need to be checked on your avatar; they are not inferred from the quiz.",
  }));
}
function recommendTops(
  candidates: Candidate[],
  profile: StyleAnswers,
  feedback: Record<string, "like" | "skip">,
  limit: number,
): RankedTop[] {
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
  while (scored.length && chosen.length < limit) {
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
    renderScope: "top-only" as const,
    engine: "rules-v1" as const,
    itemColor: item.color,
    reason:
      [
        style ? "Matches your selected style" : "Another option from your wardrobe",
        color ? " includes a favorite color" : null,
        feedback[item.id] === "like" ? " you previously liked this top" : null,
        profile.occasion === "work" && item.category === "shirt"
          ? " a shirt for your workwear preference"
          : null,
      ]
        .filter(Boolean)
        .join("; ") +
      ". Shape and fit need to be checked on your avatar; they are not inferred from the quiz.",
  }));
}
