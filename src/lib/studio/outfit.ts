/**
 * Two independent outfit slots with a selection snapshot.
 *
 * - `wanted` is what the user last chose. Choosing one slot never changes the other one.
 * - `shown` is what the viewer renders. It only ever becomes a complete `wanted` snapshot:
 *   a full outfit (top + bottom) switches in one step, and while an item is still loading or
 *   being prepared the current outfit stays on screen.
 * - Late results (an item that finished after the user moved on, or a result for another avatar
 *   version) are cached but never change `shown` unless they belong to the current snapshot.
 */
export type Slot = "top" | "bottom";
export const SLOTS: readonly Slot[] = ["top", "bottom"];
export type Outfit = { top: string | null; bottom: string | null };
export type OutfitState = {
  /** avatar version the outfit belongs to (model id, or "local" + bundle revision) */
  avatar: string;
  /** increments on every user choice; lets UIs tell a stale snapshot from the current one */
  seq: number;
  wanted: Outfit;
  shown: Outfit;
  loaded: ReadonlySet<string>;
};

export const EMPTY: Outfit = { top: null, bottom: null };

export function initOutfit(avatar: string, start: Outfit = EMPTY, loaded: Iterable<string> = []): OutfitState {
  return settle({ avatar, seq: 0, wanted: { ...start }, shown: { ...EMPTY }, loaded: new Set(loaded) });
}

function settle(s: OutfitState): OutfitState {
  const ready = SLOTS.every((slot) => s.wanted[slot] === null || s.loaded.has(s.wanted[slot]!));
  if (!ready) return s;
  if (s.shown.top === s.wanted.top && s.shown.bottom === s.wanted.bottom) return s;
  return { ...s, shown: { ...s.wanted } };
}

/** User picks an item for some slots (one slot, or a full outfit). Unlisted slots keep their choice. */
export function choose(s: OutfitState, patch: Partial<Outfit>): OutfitState {
  return settle({ ...s, seq: s.seq + 1, wanted: { ...s.wanted, ...patch } });
}

/** An item's 3D asset is now available in the viewer cache. Ignored for another avatar version. */
export function itemLoaded(s: OutfitState, avatar: string, id: string): OutfitState {
  if (avatar !== s.avatar || s.loaded.has(id)) return s;
  const loaded = new Set(s.loaded);
  loaded.add(id);
  return settle({ ...s, loaded });
}

/** An item can no longer be prepared (failed/canceled). If it is still wanted, fall back to what is shown. */
export function itemFailed(s: OutfitState, avatar: string, id: string): OutfitState {
  if (avatar !== s.avatar) return s;
  const wanted = { ...s.wanted };
  let changed = false;
  for (const slot of SLOTS)
    if (wanted[slot] === id) {
      wanted[slot] = s.shown[slot];
      changed = true;
    }
  return changed ? settle({ ...s, wanted }) : s;
}

export function pendingSlots(s: OutfitState): Slot[] {
  return SLOTS.filter((slot) => s.wanted[slot] !== s.shown[slot]);
}
