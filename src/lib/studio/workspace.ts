import { parseBundle, validateGlb, type StudioBundle } from "./bundle";

export type LocalLook = {
  id: string;
  name: string;
  garmentId: string | null;
  createdAt: string;
};
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
      reject(new Error("Trình duyệt không cho phép lưu cục bộ."));
    request.onblocked = () =>
      reject(new Error("Hãy đóng tab Studio khác và thử lại."));
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
  if (!owner) throw new Error("Cần đăng nhập để chọn đúng kho cục bộ.");
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
              "Không thể lưu/đọc bộ 3D. Kiểm tra dung lượng và quyền lưu trữ trình duyệt.",
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
    throw new Error("Bộ lưu cục bộ không hợp lệ.");
  const bundle = parseBundle(w.bundle);
  const expected = ["avatar", ...bundle.garments.map((g) => g.id)];
  if (
    w.assets.length !== expected.length ||
    new Set(w.assets.map((a) => a.id)).size !== expected.length
  )
    throw new Error("Thiếu hoặc trùng mô hình trong bộ lưu.");
  let total = 0;
  for (const a of w.assets) {
    if (!expected.includes(a.id) || !(a.bytes instanceof ArrayBuffer))
      throw new Error("Mô hình lưu không hợp lệ.");
    validateGlb(a.bytes);
    total += a.bytes.byteLength;
  }
  if (w.assets[0]?.id !== "avatar" || total > 120 * 1024 * 1024)
    throw new Error("Bộ lưu vượt giới hạn hoặc sai thứ tự avatar.");
  for (const look of w.looks) {
    if (
      !look ||
      typeof look.id !== "string" ||
      typeof look.name !== "string" ||
      !look.name.trim() ||
      look.name.length > 80 ||
      (look.garmentId !== null &&
        !bundle.garments.some((g) => g.id === look.garmentId))
    )
      throw new Error("Look đã lưu không thuộc bộ avatar/áo này.");
  }
  return w;
}
