import test from "node:test";
import assert from "node:assert/strict";
import { generateOutfitSuggestions, analyzeClothingImage } from "../src/lib/openai";

test("outfit identities do not depend on duplicate model IDs and preferences reach the prompt", async t => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  let prompt = "";
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    prompt = String(init?.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ outfits: Array.from({ length: 3 }, () => ({ id: "same-model-id", styleCategory: "minimal", confidenceScore: 90 })) }) } }] });
  });
  try {
    const results = await generateOutfitSuggestions({ type: "shirt", primaryColor: "white", pattern: "plain", style: "minimal", description: "White cotton shirt" }, { primaryStyle: "minimal", favoriteColors: ["Black"], bodyShape: "Petite", lifestyle: "Office", fitPriorities: ["Relaxed comfort"] });
    assert.equal(new Set(results.map(outfit => outfit.id)).size, 3);
    assert.ok(results.every(outfit => /^[0-9a-f-]{36}$/.test(outfit.id) && outfit.id !== "same-model-id"));
    for (const preference of ["Petite", "Office", "Relaxed comfort"]) assert.ok(prompt.includes(preference));
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});

test("unrecognized vision categories and patterns fall back to editable enum values", async t => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  t.mock.method(globalThis, "fetch", async () => Response.json({ choices: [{ message: { content: JSON.stringify({ type: "unlisted garment", pattern: "unlisted weave", style: "unlisted aesthetic", primaryColor: "White", description: "A garment" }) } }] }));
  try {
    const result = await analyzeClothingImage("synthetic-image");
    assert.equal(result.type, "other"); assert.equal(result.pattern, "other"); assert.equal(result.style, "casual");
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});
