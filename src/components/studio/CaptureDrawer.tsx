"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Download, ImagePlus, X } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import {
  captureArchive,
  downloadBlob,
  inspectPhoto,
  requiredSlots,
  type CaptureKind,
  type CaptureSlot,
} from "@/lib/studio/capture";
const labels: Record<CaptureSlot, string> = {
  front: "Mặt trước",
  side: "Mặt bên",
  back: "Mặt sau",
  detail: "Chi tiết / logo",
};
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
            alt={`Ảnh ${labels[slot].toLowerCase()}`}
            className="h-36 w-full object-contain rounded-xl"
          />
        ) : (
          <div className="h-36 grid place-items-center text-fg-subtle text-xs border border-dashed border-border rounded-xl">
            Chọn ảnh đã chụp
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
          Bỏ ảnh
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
  ) => Promise<void>;
  progress?: string;
}) {
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
        setError(e instanceof Error ? e.message : "Ảnh không hợp lệ.");
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
        await onSend(name.trim(), avatar ? Number(height) : null, photos);
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
        setError(e instanceof Error ? e.message : "Không thể xuất bộ ảnh.");
    } finally {
      exporting.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={avatar ? "Tạo avatar của bạn" : "Chuẩn bị áo của bạn"}
      eyebrow="Bước 01 / Chuẩn bị ảnh"
      description={
        onSend
          ? "Ảnh được lưu vào kho riêng của tài khoản và gửi đến máy xử lý đã kết nối khi bạn bấm gửi."
          : "Ảnh chỉ được xử lý trong trình duyệt. Bạn quyết định khi nào chuyển bộ ảnh sang PC."
      }
      width="lg"
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-6">
        <div className="rounded-2xl bg-accent-soft p-4 text-sm leading-6">
          <Camera size={20} className="text-accent-text mb-2" />
          {avatar
            ? "Chụp toàn thân trước, bên và sau, cùng ánh sáng, máy ngang tầm người. Mặc đồ ôm vừa, tay cách thân nhẹ; không cần ảnh khỏa thân."
            : kind === "jeans"
              ? "Trải quần phẳng trên nền trơn, hai ống duỗi thẳng, cạp quần ở trên. Chụp mặt trước và mặt sau cùng ánh sáng tự nhiên, không bộ lọc; thêm ảnh chi tiết túi/logo nếu cần."
              : "Trải áo phẳng trên nền trơn, chụp trước và sau với ánh sáng tự nhiên. Không dùng bộ lọc; thêm ảnh chi tiết để giữ logo, cổ và hàng nút."}
        </div>
        {!avatar && (
          <div className="flex gap-2 text-xs text-fg-muted">
            <span className="border border-border px-3 py-2 rounded-full">
              {kind === "shirt" ? "Sơ mi" : kind === "jeans" ? "Jeans" : "Áo thun"}
            </span>
            <span className="px-3 py-2">Một áo / một bộ ảnh</span>
          </div>
        )}
        <label className="block text-sm">
          {avatar ? "Tên avatar" : "Tên chiếc áo"}
          <input
            required
            maxLength={80}
            value={name}
            disabled={busy}
            onChange={(e) => {
              setName(e.target.value);
              setDone(false);
            }}
            placeholder={avatar ? "Avatar của tôi" : "Áo thun trắng in hình"}
            className="mt-2 w-full rounded-xl border border-border bg-bg p-3"
          />
        </label>
        {avatar && (
          <label className="block text-sm">
            Chiều cao (cm)
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
            <span>Góc ảnh bắt buộc</span>
            <span>
              {complete}/{requiredSlots(kind).length} đã chọn
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
            JPG / PNG / WebP · tối đa 12 MB/ảnh · ít nhất 512 × 512 px
            {!avatar && " · ảnh chi tiết không bắt buộc"}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="text-sm text-success">
            {onSend
              ? "Đã đưa vào hàng đợi. Theo dõi tác vụ ở trang Chuẩn bị 3D."
              : "Đã xuất bộ ảnh ZIP. Chuyển file sang PC để xử lý; chưa có tác vụ GPU được gửi tự động."}
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
              ? "Bấm gửi để lưu ảnh vào kho riêng và cho máy xử lý của tài khoản tải xuống. Nếu máy chưa kết nối, tác vụ sẽ chờ; không tự chuyển sang dịch vụ AI khác."
              : "Bộ ảnh tải xuống có chứa ảnh cá nhân của bạn. Chỉ gửi đến máy xử lý của bạn. Khi PC trả kết quả, mở bộ 3D trong Studio để mặc thử."}
          </p>
          <button
            disabled={
              busy ||
              (done && !!onSend) ||
              complete !== requiredSlots(kind).length
            }
            className="w-full rounded-full bg-accent text-bg p-3 text-sm font-semibold flex justify-center items-center gap-2 disabled:opacity-40"
          >
            <Download size={16} />
            {busy
              ? onSend
                ? "Đang gửi…"
                : "Đang đóng gói…"
              : onSend
                ? done
                  ? "Đã gửi"
                  : "Gửi ảnh và tạo 3D"
                : "Xuất bộ ảnh cho PC"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
