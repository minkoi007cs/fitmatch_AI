import { randomUUID } from "node:crypto";
import type { RefreshOutcome } from "@infra/sdk";

export interface RefreshStore {
  claim(key: string, owner: string): Promise<{ owner: boolean; result: string | null }>;
  read(key: string): Promise<string | null>;
  finish(key: string, owner: string, result: string): Promise<void>;
}

/** The durable claim is shared by all instances, not an in-process promise cache. */
export async function coordinatedRefresh(
  store: RefreshStore, key: string, run: () => Promise<RefreshOutcome>,
  codec: { encode(value: RefreshOutcome): string; decode(value: string): RefreshOutcome },
) {
  const owner = randomUUID();
  const claim = await store.claim(key, owner);
  if (claim.result) return codec.decode(claim.result);
  if (claim.owner) {
    // Never send the same rotating token twice, even after an ambiguous transport failure.
    const result = await run().catch(() => ({ pair: null }));
    await store.finish(key, owner, codec.encode(result));
    return result;
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await store.read(key);
    if (result) return codec.decode(result);
  }
  // The first request may still be running. Preserve cookies and let the user retry.
  return { pair: null } satisfies RefreshOutcome;
}
