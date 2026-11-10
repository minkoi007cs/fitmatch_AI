import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { modelBytes, ModelDownloadError, type ModelResponse } from "../src/lib/studio/cloud";
import type { ModelRow } from "../src/lib/v2/contracts";
import { mesh } from "./fixtures/mesh.mjs";

// CL-URL-01: bounded same-version refresh of an expired signed URL. Synthetic GLB only.
const glb = new Uint8Array(mesh());
const sha = createHash("sha256").update(glb).digest("hex");
const row: ModelRow = {
  id: "fit-1", user_id: "owner", kind: "fitting", name: "Tee", wardrobe_item_id: null, avatar_id: "av", garment_id: "g",
  input_assets: [], params: {}, output_asset_id: "asset-1", created_at: "2026-11-06T00:00:00Z",
};
const record = (url: string, over: Partial<{ sha256: string; bytes: number; id: string; output: string }> = {}): ModelResponse => ({
  model: { ...row, id: over.id ?? row.id, output_asset_id: over.output ?? row.output_asset_id },
  asset: { url, sha256: over.sha256 ?? sha, bytes: over.bytes ?? glb.byteLength },
});
type Answer = number | "network" | Uint8Array;
function server(answers: Record<string, Answer[]>) {
  const calls: string[] = [];
  const doFetch = async (url: string, init?: RequestInit) => {
    calls.push(url);
    init?.signal?.throwIfAborted();
    const a = answers[url]?.shift() ?? 404;
    if (a === "network") throw new TypeError("fetch failed");
    if (typeof a === "number") return new Response(JSON.stringify({ error: "x" }), { status: a });
    return new Response(a.slice().buffer, { status: 200 });
  };
  return { calls, doFetch };
}
const reason = (r: DownloadFailureLike) => (e: unknown) => e instanceof ModelDownloadError && e.reason === r;
type DownloadFailureLike = ModelDownloadError["reason"];

test("expired URL is re-signed once for the same version, then succeeds", async () => {
  const s = server({ old: [400], new: [glb] });
  let refreshes = 0;
  const bytes = await modelBytes(record("old"), { fetch: s.doFetch, refresh: async () => (refreshes++, record("new")) });
  assert.equal(bytes.byteLength, glb.byteLength);
  assert.equal(refreshes, 1);
  assert.deepEqual(s.calls, ["old", "new"]);
});

test("403 is also treated as expired; a second expiry is not retried again", async () => {
  const s = server({ old: [403], new: [403] });
  let refreshes = 0;
  await assert.rejects(modelBytes(record("old"), { fetch: s.doFetch, refresh: async () => (refreshes++, record("new")) }), reason("expired"));
  assert.equal(refreshes, 1, "bounded: at most one refresh");
  assert.deepEqual(s.calls, ["old", "new"]);
});

test("missing object, network failure and corrupt bytes are never refreshed", async () => {
  for (const [answer, why] of [[404, "missing"], ["network", "network"], [500, "network"]] as const) {
    const s = server({ old: [answer] });
    let refreshes = 0;
    await assert.rejects(modelBytes(record("old"), { fetch: s.doFetch, refresh: async () => (refreshes++, record("new")) }), reason(why));
    assert.equal(refreshes, 0, String(answer));
  }
  const corrupt = glb.slice();
  corrupt[corrupt.length - 1] ^= 0xff;
  const s = server({ old: [corrupt] });
  let refreshes = 0;
  await assert.rejects(modelBytes(record("old"), { fetch: s.doFetch, refresh: async () => (refreshes++, record("new")) }), reason("integrity"));
  assert.equal(refreshes, 0, "hash mismatch is not retried");
  const longer = server({ old: [new Uint8Array([...glb, 0, 0, 0, 0])] });
  await assert.rejects(modelBytes(record("old"), { fetch: longer.doFetch }), reason("integrity"), "more bytes than recorded");
});

test("refreshed record must be the identical asset; any change is refused without download", async () => {
  for (const changed of [{ sha256: "f".repeat(64) }, { bytes: glb.byteLength + 1 }, { id: "fit-2" }, { output: "asset-2" }]) {
    const s = server({ old: [401], new: [glb] });
    await assert.rejects(modelBytes(record("old"), { fetch: s.doFetch, refresh: async () => record("new", changed) }), reason("changed"));
    assert.deepEqual(s.calls, ["old"], JSON.stringify(changed));
  }
});

test("revoked or foreign model: the authenticated refresh fails and nothing is downloaded", async () => {
  const s = server({ old: [400] });
  await assert.rejects(
    modelBytes(record("old"), { fetch: s.doFetch, refresh: async () => Promise.reject(new Error("Unable to complete this action. Please try again.")) }),
    reason("unavailable"),
  );
  assert.deepEqual(s.calls, ["old"]);
});

test("pinned snapshot hash is checked before any download", async () => {
  const s = server({ old: [glb] });
  await assert.rejects(modelBytes(record("old"), { fetch: s.doFetch, expectedSha256: "0".repeat(64) }), reason("changed"));
  assert.deepEqual(s.calls, []);
  assert.equal((await modelBytes(record("old"), { fetch: s.doFetch, expectedSha256: sha })).byteLength, glb.byteLength);
});

test("abort during refresh (selection changed A→B) stops before the second download", async () => {
  const s = server({ old: [400], new: [glb] });
  const controller = new AbortController();
  await assert.rejects(
    modelBytes(record("old"), {
      fetch: s.doFetch,
      signal: controller.signal,
      refresh: async () => {
        controller.abort();
        return record("new");
      },
    }),
    (e: unknown) => (e as Error).name === "AbortError",
  );
  assert.deepEqual(s.calls, ["old"]);
});
