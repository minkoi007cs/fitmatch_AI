"use client";
import { useState } from "react";
import { api } from "@/lib/v2/client";
import type { ModelRow } from "@/lib/v2/contracts";
import { button } from "./WorkspaceNav";

/**
 * Draft decision, source retention and edit availability for one finished avatar version.
 * A draft is not a likeness pass: the user decides to use it for now or to add photos and rebuild.
 */
export default function AvatarDraft({
  model,
  onChanged,
  onRecapture,
}: {
  model: ModelRow;
  onChanged: (message: string) => void;
  onRecapture: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError("");
    try {
      onChanged(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };
  const retention = model.source_retention ?? null;
  const cleanup = model.source_cleanup ?? null;
  // CL-PRIV-01: "deleted" is only claimed once storage confirmed removal; otherwise the request is
  // recorded (it survives reload) and can be retried.
  const remove = async () => {
    const r = await api<{ canceledJobs: number; affectedModels: number; storageCleanupPending: boolean }>(
      `models/${model.id}/source`,
      { action: "delete" },
    );
    const extra = `${r.canceledJobs ? ` Đã hủy ${r.canceledJobs} tác vụ đang dùng chúng.` : ""}${
      r.affectedModels ? ` ${r.affectedModels} phiên bản khác dùng chung ảnh này cũng không dựng lại được từ nguồn này.` : ""
    }`;
    return r.storageCleanupPending
      ? `Đã ghi nhận yêu cầu xóa nhưng chưa xóa xong tệp khỏi bộ nhớ lưu trữ. Bấm "Thử xóa lại" sau ít phút.${extra}`
      : `Đã xóa ảnh/video gốc khỏi bộ nhớ lưu trữ.${extra}`;
  };
  return (
    <div className="mt-4 border-t border-border pt-4 space-y-3 text-xs">
      {model.accepted_at ? (
        <p className="text-success">Bạn đang dùng bản này.</p>
      ) : (
        <>
          <p className="text-fg-muted leading-5">
            Bản nháp. Mở trong Studio để xem, rồi chọn dùng tạm hoặc bổ sung ảnh để dựng lại. Bản nháp chưa phải xác nhận là giống bạn.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              className={button}
              onClick={() =>
                void run(async () => {
                  await api(`models/${model.id}/accept`, {});
                  return "Đã chọn dùng tạm avatar này. Bạn vẫn có thể tạo bản mới bất cứ lúc nào.";
                })
              }
            >
              Dùng tạm bản này
            </button>
            <button disabled={busy} className="text-accent-text underline underline-offset-2" onClick={onRecapture}>
              Bổ sung ảnh / tạo lại
            </button>
          </div>
        </>
      )}
      <div>
        <p className="text-fg-muted mb-2">Ảnh/video gốc</p>
        {retention === "deleted" ? (
          cleanup === "pending" || cleanup === "failed" ? (
            <div role="status" aria-label="Trạng thái xóa ảnh gốc" className="space-y-2">
              <p className="leading-5 text-accent-text">
                {cleanup === "failed"
                  ? "Chưa xóa xong: bộ nhớ lưu trữ chưa xóa được tệp sau nhiều lần thử."
                  : "Đang xóa: đã ghi nhận yêu cầu, tệp gốc chưa được xóa xong khỏi bộ nhớ lưu trữ."}{" "}
                Ảnh/video này đã không còn dùng được để dựng lại.
              </p>
              <button disabled={busy} className={button} onClick={() => void run(remove)}>
                Thử xóa lại
              </button>
            </div>
          ) : (
            <p className="text-fg-muted leading-5">Đã xóa khỏi bộ nhớ lưu trữ. Avatar, đồ đã mặc thử và look vẫn giữ; không thể dựng lại từ nguồn này.</p>
          )
        ) : confirm ? (
          <div role="group" aria-label="Xác nhận xóa ảnh gốc" className="space-y-2">
            <p className="leading-5">
              Xóa vĩnh viễn ảnh/video dùng để tạo avatar này? Avatar, đồ đã mặc thử và look vẫn giữ. Tác vụ đang dùng các ảnh này sẽ bị hủy.
            </p>
            <div className="flex gap-2">
              <button
                disabled={busy}
                className={`${button} border-danger text-danger`}
                onClick={() => void run(remove)}
              >
                Xác nhận xóa
              </button>
              <button disabled={busy} className="text-fg-muted underline" onClick={() => setConfirm(false)}>
                Không xóa
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {cleanup && (
              <p className="w-full text-fg-muted leading-5">
                Một số ảnh dùng chung với avatar khác đã bị xóa{cleanup === "completed" ? "" : " (đang dọn khỏi bộ nhớ)"}; không thể dựng lại đầy đủ từ nguồn này.
              </p>
            )}
            {retention === "keep" ? (
              <span className="text-fg-muted">Đang giữ.</span>
            ) : (
              <button
                disabled={busy}
                className={button}
                onClick={() =>
                  void run(async () => {
                    await api(`models/${model.id}/source`, { action: "keep" });
                    return "Đã giữ ảnh/video gốc. Bạn có thể xóa sau.";
                  })
                }
              >
                Giữ ảnh gốc
              </button>
            )}
            <button disabled={busy} className="text-fg-muted underline underline-offset-2" onClick={() => setConfirm(true)}>
              Xóa ảnh gốc
            </button>
          </div>
        )}
      </div>
      <details>
        <summary className="cursor-pointer text-fg-muted">Chỉnh mặt, dáng, tóc, da</summary>
        <p className="mt-2 leading-5 text-fg-muted">
          Chưa khả dụng: máy xử lý chưa có công cụ chỉnh avatar, nên thanh kéo và chỉnh bằng lời chưa được bật. Hiện bạn có thể bổ sung ảnh mặt, video hoặc số đo rồi tạo lại.
        </p>
      </details>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
