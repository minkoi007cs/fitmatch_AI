import { test } from "node:test";
import assert from "node:assert/strict";
import { choose, initOutfit, itemFailed, itemLoaded, pendingSlots } from "../src/lib/studio/outfit";

const AV = "avatar-v1";

test("changing the top keeps the jeans and the reverse", () => {
  let s = initOutfit(AV, { top: "teeA", bottom: "jeans1" }, ["teeA", "teeB", "jeans1", "jeans2"]);
  assert.deepEqual(s.shown, { top: "teeA", bottom: "jeans1" });
  s = choose(s, { top: "teeB" });
  assert.deepEqual(s.shown, { top: "teeB", bottom: "jeans1" });
  s = choose(s, { bottom: "jeans2" });
  assert.deepEqual(s.shown, { top: "teeB", bottom: "jeans2" });
});

test("A→B→A with B finishing late never overrides the current choice", () => {
  let s = initOutfit(AV, { top: "teeA", bottom: null }, ["teeA"]);
  s = choose(s, { top: "teeB" }); // B not ready: keep showing A
  assert.deepEqual(s.shown.top, "teeA");
  assert.deepEqual(pendingSlots(s), ["top"]);
  s = choose(s, { top: "teeA" }); // back to A: immediately consistent
  assert.equal(s.shown.top, "teeA");
  assert.deepEqual(pendingSlots(s), []);
  s = itemLoaded(s, AV, "teeB"); // late completion of B
  assert.equal(s.shown.top, "teeA", "late B is cached, not applied");
  assert.ok(s.loaded.has("teeB"));
  s = choose(s, { top: "teeB" }); // now B is instant because it was cached
  assert.equal(s.shown.top, "teeB");
});

test("pending item auto-applies only if it is still selected", () => {
  let s = initOutfit(AV, { top: "teeA", bottom: "jeans1" }, ["teeA", "jeans1"]);
  s = choose(s, { bottom: "jeans2" });
  assert.equal(s.shown.bottom, "jeans1");
  s = itemLoaded(s, AV, "jeans2");
  assert.deepEqual(s.shown, { top: "teeA", bottom: "jeans2" }, "still selected → applied, top untouched");
  s = choose(s, { top: "teeB" });
  s = choose(s, { top: "teeC" });
  s = itemLoaded(s, AV, "teeB");
  assert.equal(s.shown.top, "teeA", "teeB no longer selected");
});

test("full outfit switches both slots in one step, never half", () => {
  let s = initOutfit(AV, { top: "teeA", bottom: "jeans1" }, ["teeA", "jeans1", "teeB"]);
  s = choose(s, { top: "teeB", bottom: "jeans2" });
  assert.deepEqual(s.shown, { top: "teeA", bottom: "jeans1" }, "teeB ready but jeans2 not: keep old outfit");
  s = itemLoaded(s, AV, "jeans2");
  assert.deepEqual(s.shown, { top: "teeB", bottom: "jeans2" });
});

test("results for another avatar version are ignored", () => {
  let s = initOutfit(AV, { top: null, bottom: null });
  s = choose(s, { top: "teeA" });
  s = itemLoaded(s, "avatar-v0", "teeA");
  assert.equal(s.shown.top, null);
  assert.ok(!s.loaded.has("teeA"));
});

test("a failed pending item falls back to what is shown", () => {
  let s = initOutfit(AV, { top: "teeA", bottom: null }, ["teeA"]);
  s = choose(s, { top: "teeX" });
  s = itemFailed(s, AV, "teeX");
  assert.deepEqual(s.wanted, s.shown);
  assert.deepEqual(pendingSlots(s), []);
});
