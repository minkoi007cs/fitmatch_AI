import test from "node:test";
import assert from "node:assert/strict";
import { decodeFlow, decodeSession, flowName, safeNext, seal, unseal, ownsImagePath } from "../src/lib/auth/session";
import { coordinatedRefresh, type RefreshStore } from "../src/lib/auth/refresh-coordinator";
import type { RefreshOutcome } from "@infra/sdk";

const key = "test-only-signing-key";
const session = { pair: { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 600_000 },
  issuer: "https://hub.test", appId: "fitmatch", subject: "user-a", localUserId: "uuid-a" };

test("signed hub session binds both hub identity and local wardrobe owner", () => {
  assert.deepEqual(decodeSession(seal(session, key, "session"), key), session);
});
test("tampered local identity cannot select another wardrobe", () => {
  const sealed = seal(session, key, "session");
  const [, signature] = sealed.split(".");
  const modified = Buffer.from(JSON.stringify({ ...session, localUserId: "uuid-victim" })).toString("base64url");
  assert.equal(decodeSession(`${modified}.${signature}`, key), null);
});
test("keys, cookie purpose, malformed encodings and invalid shape are rejected", () => {
  const value = seal(session, key, "session");
  assert.equal(decodeSession(value, "other-key"), null);
  assert.equal(unseal(value, key, "flow"), null);
  for (const input of [undefined, "invalid", ".", "a.b.c", "a".repeat(13_000)]) assert.equal(decodeSession(input, key), null);
  assert.equal(decodeSession(seal({ ...session, pair: {} }, key, "session"), key), null);
});
test("PKCE flow rejects stale/future attempts and preserves explicit linking proof", () => {
  const flow = { state: "test-state", codeVerifier: "test-verifier", issuedAt: Date.now(), next: "/outfits?vibe=formal", legacyUserId: "existing-owner" };
  assert.deepEqual(decodeFlow(seal(flow, key, "flow"), key), flow);
  assert.equal(decodeFlow(seal({ ...flow, issuedAt: Date.now() - 601_000 }, key, "flow"), key), null);
  assert.equal(decodeFlow(seal({ ...flow, issuedAt: Date.now() + 60_000 }, key, "flow"), key), null);
  assert.equal(decodeFlow(seal({ ...flow, legacyUserId: 123 }, key, "flow"), key), null);
});
test("return paths preserve intent but reject redirect escapes and auth loops", () => {
  assert.equal(safeNext("/outfits?vibe=formal#result"), "/outfits?vibe=formal#result");
  for (const input of ["https://evil.test", "//evil.test", "/\\evil.test", "/\t/evil.test", "/.//evil.test", "/auth/logout", "/login", "/api/wardrobe", undefined]) {
    assert.equal(safeNext(input), "/wardrobe", String(input));
  }
});
test("each parallel sign-in attempt gets a safe independent cookie name", () => {
  assert.notEqual(flowName("a".repeat(24)), flowName("b".repeat(24)));
  for (const value of [null, "short", "../state", "x".repeat(129)]) assert.equal(flowName(value), null);
});
test("file ownership excludes traversal, encoded traversal, other tenants and absolute URLs", () => {
  assert.equal(ownsImagePath("user-a/looks/photo.png", "user-a"), true);
  for (const value of ["user-b/photo.png", "user-a/../user-b/photo", "user-a/%2e%2e/photo", "user-a/./photo", "user-a//photo", "https://evil.test/photo", "user-a\\photo"]) assert.equal(ownsImagePath(value, "user-a"), false);
});

function sharedStore() {
  const rows = new Map<string, { owner: string; result: string | null }>();
  const store: RefreshStore = {
    async claim(key, owner) { if (!rows.has(key)) rows.set(key, { owner, result: null }); const row = rows.get(key)!; return { owner: row.owner === owner, result: row.result }; },
    async read(key) { return rows.get(key)?.result ?? null; },
    async finish(key, owner, result) { const row = rows.get(key)!; assert.equal(row.owner, owner); row.result = result; },
  };
  return store;
}
const codec = { encode: JSON.stringify, decode: (value: string) => JSON.parse(value) as RefreshOutcome };

test("independent instances share one durable refresh and return the same successor", async () => {
  const database = sharedStore();
  let rotations = 0;
  const run = async () => { rotations++; await new Promise(resolve => setTimeout(resolve, 25)); return { pair: session.pair }; };
  const results = await Promise.all(Array.from({ length: 10 }, () => coordinatedRefresh({ ...database }, "same-old-token", run, codec)));
  assert.equal(rotations, 1);
  results.forEach(result => assert.deepEqual(result.pair, session.pair));
  await coordinatedRefresh({ ...database }, "same-old-token", run, codec);
  assert.equal(rotations, 1, "late request must not replay a spent token");
});
test("different tokens do not share refresh results", async () => {
  const store = sharedStore(); let calls = 0;
  await Promise.all(["token-a", "token-b"].map(key => coordinatedRefresh(store, key, async () => { calls++; return { pair: session.pair }; }, codec)));
  assert.equal(calls, 2);
});
test("ambiguous refresh transport failure is not retried with a possibly consumed token", async () => {
  const store = sharedStore(); let calls = 0;
  const fail = async () => { calls++; throw new Error("response lost"); };
  assert.equal((await coordinatedRefresh(store, "spent-token", fail, codec)).pair, null);
  assert.equal((await coordinatedRefresh(store, "spent-token", fail, codec)).pair, null);
  assert.equal(calls, 1);
});
test("revocation verdict is shared rather than rotating again", async () => {
  const store = sharedStore(); let calls = 0;
  const revoked = async () => { calls++; return { pair: null, terminal: { code: "UNAUTHENTICATED", message: "Revoked" } }; };
  await coordinatedRefresh(store, "revoked-token", revoked, codec);
  assert.equal((await coordinatedRefresh(store, "revoked-token", revoked, codec)).terminal?.code, "UNAUTHENTICATED");
  assert.equal(calls, 1);
});
