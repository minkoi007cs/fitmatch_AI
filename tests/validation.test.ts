import test from "node:test";
import assert from "node:assert/strict";
import { InputError, readJson, wardrobePatchSchema, wardrobeUpdate, profileUpdateSchema, saveOutfitSchema, savedQuizAnswers } from "../src/lib/validation";

test("partial wardrobe updates preserve omitted values and keep explicit false/null", () => {
  assert.deepEqual(wardrobeUpdate(wardrobePatchSchema.parse({ name: "Renamed" })), { name: "Renamed" });
  assert.deepEqual(wardrobeUpdate(wardrobePatchSchema.parse({ notes: null, isFavorite: false })), { notes: null, is_favorite: false });
  for (const value of [{}, null, [], { name: "" }, { isFavorite: "false" }, { name: null }, { category: "arbitrary" }]) assert.equal(wardrobePatchSchema.safeParse(value).success, false);
});

test("empty and invalid profiles cannot erase saved data", () => {
  for (const value of [{}, null, [], { styleProfile: null }, { styleProfile: { primaryStyle: "minimal", favoriteColors: "red" } }]) assert.equal(profileUpdateSchema.safeParse(value).success, false);
  const value = profileUpdateSchema.parse({ styleProfile: { primaryStyle: "minimal", favoriteColors: ["Black"] } });
  assert.equal(Object.hasOwn(value, "quizAnswers"), false);
});

test("archive rejects malformed nested parts before persistence", () => {
  for (const value of [null, {}, { data: [null] }, { data: [{ name: "Broken", items: [null], accessories: [null] }] }]) assert.equal(saveOutfitSchema.safeParse(value).success, false);
});

test("legacy quiz hydration never passes null or malformed arrays into the form", () => {
  assert.deepEqual(savedQuizAnswers({ ageRange: "45+", favoriteColors: null, preferredOutfits: "bad", fashionInspirations: [null] }), { ageRange: "45+" });
  assert.equal(savedQuizAnswers(null), null);
});

test("invalid JSON and oversized requests are client errors", async () => {
  await assert.rejects(readJson(new Request("http://localhost", { method: "POST", body: "{bad" }), wardrobePatchSchema), error => error instanceof InputError && error.status === 400);
  await assert.rejects(readJson(new Request("http://localhost", { method: "POST", body: JSON.stringify({ notes: "x".repeat(200) }) }), wardrobePatchSchema, 100), error => error instanceof InputError && error.status === 413);
});
