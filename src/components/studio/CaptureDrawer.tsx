"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Download, ImagePlus, X } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import type { Measurements } from "@/lib/v2/contracts";
import {
  captureArchive,
  downloadBlob,
  inspectPhoto,
  inspectVideo,
  requiredSlots,
  type CaptureKind,
  type CaptureSlot,
} from "@/lib/studio/capture";
const labels: Record<CaptureSlot, string> = {
  front: "Front",
  side: "Side",
  back: "Back",
  detail: "Detail / logo",
  face: "Face close-up",
};
export type CaptureExtras = { video?: File; measurements?: Measurements };
const MEASURES: Array<[keyof Measurements, string]> = [
  ["chestCm", "Chest (cm)"],
  ["waistCm", "Waist (cm)"],
  ["hipCm", "Hips (cm)"],
];
function PhotoSlot({
  slot,
  file,
  onChange,
  disabled,
}: {
  slot: CaptureSlot;
  file?: File;
  onChange: (file?: File) => void;
  disabled: boolean;
}) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    queueMicrotask(() => setPreview(url));
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="border border-border rounded-2xl p-3 bg-bg">
      <label className="block cursor-pointer">
        <span className="flex justify-between text-sm mb-3">
          {labels[slot]}
          {file ? (
            <Check size={16} className="text-success" />
          ) : (
            <ImagePlus size={16} className="text-fg-muted" />
          )}
        </span>
        {file && preview ? (
          <Image
            unoptimized
            width={600}
            height={600}
            src={preview}
            alt={`Photo: ${labels[slot].toLowerCase()}`}
            className="h-36 w-full object-contain rounded-xl"
          />
        ) : (
          <div className="h-36 grid place-items-center text-fg-subtle text-xs border border-dashed border-border rounded-xl">
            Choose an existing photo
          </div>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={labels[slot]}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onChange(f);
            e.target.value = "";
          }}
        />
      </label>
      {file && (
        <button
          type="button"
          onClick={() => onChange()}
          disabled={disabled}
          className="text-xs text-fg-muted flex items-center gap-1 mt-3"
        >
          <X size={12} />
          Remove photo
        </button>
      )}
    </div>
  );
}
export default function CaptureDrawer({
  kind,
  onClose,
  onSend,
  progress,
}: {
  kind: CaptureKind;
  onClose: () => void;
  onSend?: (
    name: string,
    height: number | null,
    photos: Partial<Record<CaptureSlot, File>>,
    extras: CaptureExtras,
  ) => Promise<void>;
  progress?: string;
}) {
  const [video, setVideo] = useState<File | undefined>();
  const [measures, setMeasures] = useState<Partial<Record<keyof Measurements, string>>>({});
  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  const [photos, setPhotos] = useState<Partial<Record<CaptureSlot, File>>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const alive = useRef(true);
  const versions = useRef<Partial<Record<CaptureSlot, number>>>({});
  const exporting = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const avatar = kind === "avatar";
  const slots: CaptureSlot[] = [
    ...requiredSlots(kind),
    ...(avatar ? [] : ["detail" as const]),
  ];
  const complete = requiredSlots(kind).filter((s) => photos[s]).length;
  // Cloud avatars may use a video instead of the three body photos; then a face photo is required.
  // Partial body sets are refused so a photo is never sent under the wrong view role.
  const extended = avatar && !!onSend;
  const ready =
    complete === requiredSlots(kind).length ||
    (extended && !!video && !!photos.face && complete === 0);
  async function select(slot: CaptureSlot, file?: File) {
    const version = (versions.current[slot] ?? 0) + 1;
    versions.current[slot] = version;
    if (!file) {
      setPhotos((p) => ({ ...p, [slot]: undefined }));
      setDone(false);
      return;
    }
    try {
      await inspectPhoto(file);
      if (
        alive.current &&
        versions.current[slot] === version &&
        !exporting.current
      ) {
        setPhotos((p) => ({ ...p, [slot]: file }));
        setError("");
        setDone(false);
      }
    } catch (e) {
      if (alive.current && versions.current[slot] === version)
        setError(e instanceof Error ? e.message : "Invalid photo.");
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (exporting.current) return;
    exporting.current = true;
    setBusy(true);
    setError("");
    try {
      if (onSend) {
        const m = Object.fromEntries(
          Object.entries(measures)
            .filter(([, v]) => v && v.trim())
            .map(([k, v]) => [k, Number(v)]),
        ) as Measurements;
        if (Object.values(m).some((v) => !Number.isFinite(v))) throw new Error("Measurements must be numbers.");
        await onSend(name.trim(), avatar ? Number(height) : null, photos, {
          video,
          measurements: Object.keys(m).length ? m : undefined,
        });
        if (alive.current) setDone(true);
        return;
      }
      const zip = await captureArchive(
        kind,
        name,
        avatar ? Number(height) : null,
        photos,
      );
      if (alive.current) {
        downloadBlob(
          new Blob([zip], { type: "application/zip" }),
          `fitmatch-${kind}-capture.zip`,
        );
        setDone(true);
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Unable to export the photo bundle.");
    } finally {
      exporting.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={avatar ? "Create your avatar" : "Prepare your garment"}
      eyebrow="Step 01 / Prepare photos"
      description={
        onSend
          ? "Photos are saved to your private account storage and sent to your connected processor when you submit."
          : "Photos are processed only in your browser. You decide when to transfer the bundle to your PC."
      }
      width="lg"
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-6">
        <div className="rounded-2xl bg-accent-soft p-4 text-sm leading-6">
          <Camera size={20} className="text-accent-text mb-2" />
          {avatar
            ? "Take full-body front, side and back photos in consistent lighting, with the camera level. Wear close-fitting clothes with your arms slightly away from your body. No nude photos are needed."
            : kind === "jeans"
              ? "Lay the jeans flat on a plain background, legs straight and waistband at the top. Photograph the front and back in natural light without filters. Add pocket or logo details if needed."
              : "Lay the garment flat on a plain background. Photograph the front and back in natural light without filters. Add detail photos to preserve the logo, collar and buttons."}
        </div>
        {!avatar && (
          <div className="flex gap-2 text-xs text-fg-muted">
            <span className="border border-border px-3 py-2 rounded-full">
              {kind === "shirt" ? "Shirt" : kind === "jeans" ? "Jeans" : "T-shirt"}
            </span>
            <span className="px-3 py-2">One garment / one photo bundle</span>
          </div>
        )}
        <label className="block text-sm">
          {avatar ? "Avatar name" : "Garment name"}
          <input
            required
            maxLength={80}
            value={name}
            disabled={busy}
            onChange={(e) => {
              setName(e.target.value);
              setDone(false);
            }}
            placeholder={avatar ? "My avatar" : "White graphic T-shirt"}
            className="mt-2 w-full rounded-xl border border-border bg-bg p-3"
          />
        </label>
        {avatar && (
          <label className="block text-sm">
            Height (cm)
            <input
              type="number"
              required
              min={100}
              max={230}
              value={height}
              disabled={busy}
              onChange={(e) => {
                setHeight(e.target.value);
                setDone(false);
              }}
              placeholder="170"
              className="mt-2 w-full rounded-xl border border-border bg-bg p-3"
            />
          </label>
        )}
        <div>
          <div className="flex justify-between text-xs text-fg-muted mb-3">
            <span>Required views</span>
            <span>
              {complete}/{requiredSlots(kind).length} selected
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {slots.map((slot) => (
              <PhotoSlot
                key={slot}
                slot={slot}
                file={photos[slot]}
                disabled={busy}
                onChange={(file) => void select(slot, file)}
              />
            ))}
          </div>
          <p className="text-xs text-fg-muted mt-3">
            JPG / PNG / WebP · Up to 12 MB each · At least 512 × 512 px
            {!avatar && " · Detail photos are optional"}
          </p>
        </div>
        {extended && (
          <fieldset className="space-y-4 rounded-2xl border border-border p-4">
            <legend className="text-sm px-1">Add more detail (optional)</legend>
            <p className="text-xs text-fg-muted leading-5">
              A slow video around your body can replace the three body photos. Leave those photos empty and add a face photo instead. The processor will report which frames it actually uses.
            </p>
            <PhotoSlot slot="face" file={photos.face} disabled={busy} onChange={(file) => void select("face", file)} />
            <label className="block text-sm">
              Body video (MP4 / WebM / MOV, up to 150 MB)
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                aria-label="Body video"
                disabled={busy}
                className="mt-2 block w-full text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  try {
                    if (f) inspectVideo(f);
                    setVideo(f);
                    setError("");
                    setDone(false);
                  } catch (err) {
                    setVideo(undefined);
                    setError((err as Error).message);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            {video && <p className="text-xs text-success">Video selected · {(video.size / 1024 / 1024).toFixed(1)} MB</p>}
            <div className="grid grid-cols-3 gap-2">
              {MEASURES.map(([key, label]) => (
                <label key={key} className="text-xs text-fg-muted">
                  {label}
                  <input
                    type="number"
                    inputMode="decimal"
                    min={40}
                    max={180}
                    value={measures[key] ?? ""}
                    disabled={busy}
                    onChange={(e) => {
                      setMeasures((m) => ({ ...m, [key]: e.target.value }));
                      setDone(false);
                    }}
                    className="mt-1 w-full rounded-xl border border-border bg-bg p-2 text-fg"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="text-sm text-success">
            {onSend
              ? "Queued. Track your job on Prepare 3D."
              : "Photo ZIP exported. Transfer it to your PC for processing. No GPU job has been sent automatically."}
          </p>
        )}
        {busy && progress && (
          <p role="status" className="text-sm text-fg-muted">
            {progress}
          </p>
        )}
        <div className="border-t border-border pt-5">
          <p className="text-xs text-fg-muted leading-5 mb-4">
            {onSend
              ? "Submit to save photos privately and make them available to your account's processor. If it is offline, the job waits; it will not switch to another AI service."
              : "The downloaded bundle contains your personal photos. Send it only to your own processor. When your PC returns results, open the 3D bundle in Studio to try them on."}
          </p>
          <button
            disabled={
              busy ||
              (done && !!onSend) ||
              !ready
            }
            className="w-full rounded-full bg-accent text-bg p-3 text-sm font-semibold flex justify-center items-center gap-2 disabled:opacity-40"
          >
            <Download size={16} />
            {busy
              ? onSend
                ? "Sending…"
                : "Packaging…"
              : onSend
                ? done
                  ? "Submitted"
                  : "Submit photos & create 3D"
                : "Export photos for PC"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
