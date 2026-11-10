import { parseBundle, validateGlb, type StudioBundle } from "./bundle";

import { cameraState, type CameraState } from "@/lib/v2/contracts";
export type LocalLook = {
  id: string;
  name: string;
  /** Legacy single-garment looks only had this; it is the top slot. */
  garmentId: string | null;
  top?: string | null;
  bottom?: string | null;
  camera?: CameraState | null;
  createdAt: string;
};
export function lookOutfit(look: LocalLook) {
  return { top: look.top !== undefined ? look.top : look.garmentId, bottom: look.bottom ?? null };
}
export type Workspace = {
  version: 1;
  bundle: StudioBundle;
  assets: Array<{ id: string; name: string; bytes: ArrayBuffer }>;
  looks: LocalLook[];
};
/** Explicit opt-in, one saved bundle per signed-in account, on this browser only. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("fitmatch-studio-local-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspaces");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("This browser does not allow local storage."));
    request.onblocked = () =>
      reject(new Error("Close other Studio tabs and try again."));
  });
}
export async function workspaceStorage(
  owner: string,
  action: "load",
): Promise<Workspace | undefined>;
export async function workspaceStorage(
  owner: string,
  action: "save",
  data: Workspace,
): Promise<void>;
export async function workspaceStorage(
  owner: string,
  action: "delete",
): Promise<void>;
export async function workspaceStorage(
  owner: string,
  action: "load" | "save" | "delete",
  data?: Workspace,
): Promise<Workspace | undefined | void> {
  if (!owner) throw new Error("Sign in to access the correct local storage.");
  const db = await openDb();
  try {
    return await new Promise<Workspace | undefined | void>(
      (resolve, reject) => {
        const tx = db.transaction(
          "workspaces",
          action === "load" ? "readonly" : "readwrite",
        );
        const store = tx.objectStore("workspaces");
        const request =
          action === "load"
            ? store.get(owner)
            : action === "save"
              ? store.put(data, owner)
              : store.delete(owner);
        let loaded: Workspace | undefined;
        request.onsuccess = () => {
          if (action === "load") loaded = request.result;
        };
        tx.oncomplete = () => resolve(loaded);
        tx.onabort = tx.onerror = () =>
          reject(
            new Error(
              "Unable to save or read the 3D bundle. Check browser storage permissions and available space.",
            ),
          );
      },
    );
  } finally {
    db.close();
  }
}
export function validateWorkspace(value: unknown): Workspace {
  const w = value as Workspace;
  if (
    !w ||
    w.version !== 1 ||
    !Array.isArray(w.assets) ||
    !Array.isArray(w.looks) ||
    w.looks.length > 30
  )
    throw new Error("Invalid local save.");
  const bundle = parseBundle(w.bundle);
  const expected = ["avatar", ...bundle.garments.map((g) => g.id)];
  if (
    w.assets.length !== expected.length ||
    new Set(w.assets.map((a) => a.id)).size !== expected.length
  )
    throw new Error("Missing or duplicate models in the saved bundle.");
  let total = 0;
  for (const a of w.assets) {
    if (!expected.includes(a.id) || !(a.bytes instanceof ArrayBuffer))
      throw new Error("Invalid saved model.");
    validateGlb(a.bytes);
    total += a.bytes.byteLength;
  }
  if (w.assets[0]?.id !== "avatar" || total > 120 * 1024 * 1024)
    throw new Error("The saved bundle exceeds limits or has an invalid avatar order.");
  for (const look of w.looks) {
    if (
      !look ||
      typeof look.id !== "string" ||
      typeof look.name !== "string" ||
      !look.name.trim() ||
      look.name.length > 80 ||
      [look.garmentId, look.top, look.bottom].some(
        (g) => g !== undefined && g !== null && !bundle.garments.some((x) => x.id === g),
      ) ||
      (look.top && bundle.garments.find((g) => g.id === look.top)?.category === "jeans") ||
      (look.bottom && bundle.garments.find((g) => g.id === look.bottom)?.category !== "jeans") ||
      (look.camera != null && !cameraState.safeParse(look.camera).success)
    )
      throw new Error("This saved look does not belong to this avatar and garment bundle.");
  }
  return w;
}
