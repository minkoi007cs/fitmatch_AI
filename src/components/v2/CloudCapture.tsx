"use client";
import { useRef, useState } from "react";
import CaptureDrawer from "@/components/studio/CaptureDrawer";
import { api } from "@/lib/v2/client";
import {
  requiredSlots,
  inspectPhoto,
  type CaptureKind,
  type CaptureSlot,
} from "@/lib/studio/capture";
export default function CloudCapture({
  kind,
  wardrobeItemId,
  onClose,
  onDone,
}: {
  kind: CaptureKind;
  wardrobeItemId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const request = useRef<{
    key: string;
    assetIds: string[];
    fingerprint: string;
  }>({ key: crypto.randomUUID(), assetIds: [], fingerprint: "" });
  const [progress, setProgress] = useState("");
  async function send(
    name: string,
    height: number | null,
    photos: Partial<Record<CaptureSlot, File>>,
  ) {
    const slots = [
      ...requiredSlots(kind),
      ...(photos.detail ? ["detail" as const] : []),
    ];
    for (const slot of slots) await inspectPhoto(photos[slot]!);
    const fingerprint = JSON.stringify([
      name,
      height,
      wardrobeItemId,
      ...slots.map((s) => [
        s,
        photos[s]!.name,
        photos[s]!.size,
        photos[s]!.lastModified,
      ]),
    ]);
    if (request.current.fingerprint !== fingerprint)
      request.current = { key: crypto.randomUUID(), assetIds: [], fingerprint };
    const attempt = request.current;
    for (let i = attempt.assetIds.length; i < slots.length; i++) {
      const file = photos[slots[i]]!;
      setProgress(`Đang gửi ảnh ${i + 1}/${slots.length}…`);
      const intent = await api<{ assetId: string; uploadUrl: string }>(
        "assets/upload-intent",
        { kind: "photo", bytes: file.size },
      );
      const upload = await fetch(intent.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!upload.ok)
        throw new Error("Không tải được ảnh. Hãy kiểm tra kết nối và thử lại.");
      await api(`assets/${intent.assetId}/finalize`, {});
      attempt.assetIds.push(intent.assetId);
    }
    setProgress("Đang tạo tác vụ…");
    await api(
      "models",
      kind === "avatar"
        ? {
            kind: "avatar",
            name,
            inputAssetIds: attempt.assetIds,
            heightCm: height,
          }
        : {
            kind: "garment",
            name,
            inputAssetIds: attempt.assetIds,
            wardrobeItemId,
          },
      { "Idempotency-Key": attempt.key },
    );
    setProgress("Đã đưa vào hàng đợi. Bạn có thể đóng cửa sổ này.");
    onDone();
  }
  return (
    <CaptureDrawer
      kind={kind}
      onClose={onClose}
      onSend={send}
      progress={progress}
    />
  );
}
