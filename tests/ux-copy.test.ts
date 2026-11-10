import assert from "node:assert/strict";
import { test } from "node:test";
import { plural } from "../src/lib/plural";
import { recommend } from "../src/lib/v2/recommend";

// CL-UX-FIX-46 F3/F8: English counts and recommendation reasons.
test("plural uses the singular only for exactly one", () => {
  assert.equal(plural(1, "item"), "1 item");
  assert.equal(plural(0, "item"), "0 items");
  assert.equal(plural(2, "top"), "2 tops");
  assert.equal(plural(1, "job"), "1 job");
  assert.equal(plural(3, "person", "people"), "3 people");
});

test("recommendation reasons contain no doubled spaces", () => {
  const inventory = [
    { id: "a", name: "White shirt", category: "shirt", color: "white", style: "minimal", pattern: "plain" },
  ];
  const profile = { occasion: "work", style: "minimal", fit: "regular", favoriteColors: ["white"], avoidPatterns: [], climate: "mild" };
  const [look] = recommend(inventory as never, profile as never, { a: "like" });
  assert.ok(look, "a look is produced");
  assert.doesNotMatch(look.reason, / {2}/);
  assert.match(look.reason, /^Matches your selected style; includes a favorite color; you previously liked this top; a shirt for your workwear preference\./);
});
