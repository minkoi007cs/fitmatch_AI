"use client";
import { useRef, useState } from "react";
import CaptureDrawer, { type CaptureExtras } from "@/components/studio/CaptureDrawer";
import { api } from "@/lib/v2/client";
import {
  requiredSlots,
  inspectPhoto,
  inspectVideo,
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
    extras: CaptureExtras,
  ) {
    const avatar = kind === "avatar";
    // Body photos are optional for an avatar only when a video is given.
    const body = requiredSlots(kind).filter((s) => photos[s]);
    const slots: CaptureSlot[] = [
      ...body,
      ...(photos.detail && !avatar ? ["detail" as const] : []),
      ...(photos.face && avatar ? ["face" as const] : []),
    ];
    for (const slot of slots) await inspectPhoto(photos[slot]!);
    const videoType = extras.video ? inspectVideo(extras.video) : null;
    const files = [...slots.map((s) => [s, photos[s]!] as const), ...(extras.video ? [["video", extras.video] as const] : [])];
    const fingerprint = JSON.stringify([
      name,
      height,
      wardrobeItemId,
      extras.measurements ?? null,
      ...files.map(([s, f]) => [s, f.name, f.size, f.lastModified]),
    ]);
    if (request.current.fingerprint !== fingerprint)
      request.current = { key: crypto.randomUUID(), assetIds: [], fingerprint };
    const attempt = request.current;
    for (let i = attempt.assetIds.length; i < files.length; i++) {
      const [slot, file] = files[i];
      setProgress(slot === "video" ? "Uploading video…" : `Uploading photo ${i + 1}/${files.length}…`);
      const intent = await api<{ assetId: string; uploadUrl: string }>(
        "assets/upload-intent",
        slot === "video" ? { kind: "video", bytes: file.size, contentType: videoType } : { kind: "photo", bytes: file.size },
      );
      const upload = await fetch(intent.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!upload.ok)
        throw new Error(slot === "video" ? "Unable to upload the video. Check your connection and try again." : "Unable to upload the photo. Check your connection and try again.");
      await api(`assets/${intent.assetId}/finalize`, {});
      attempt.assetIds.push(intent.assetId);
    }
    const idOf = (slot: string) => attempt.assetIds[files.findIndex(([s]) => s === slot)];
    setProgress("Creating job…");
    await api(
      "models",
      avatar
        ? {
            kind: "avatar",
            name,
            heightCm: height,
            inputAssetIds: body.map(idOf),
            ...(photos.face ? { faceAssetIds: [idOf("face")] } : {}),
            ...(extras.video ? { videoAssetId: idOf("video") } : {}),
            ...(extras.measurements ? { measurements: extras.measurements } : {}),
          }
        : {
            kind: "garment",
            name,
            inputAssetIds: attempt.assetIds,
            wardrobeItemId,
          },
      { "Idempotency-Key": attempt.key },
    );
    setProgress("Queued. You can close this window.");
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
