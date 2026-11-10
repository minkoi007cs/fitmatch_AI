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
    const extra = `${r.canceledJobs ? ` Canceled ${r.canceledJobs} jobs using them.` : ""}${
      r.affectedModels ? ` ${r.affectedModels} other versions sharing these photos can no longer rebuild from this source.` : ""
    }`;
    return r.storageCleanupPending
      ? `Deletion was requested, but some files are still in storage. Select "Retry deletion" in a few minutes.${extra}`
      : `Original photos and video deleted from storage.${extra}`;
  };
  return (
    <div className="mt-4 border-t border-border pt-4 space-y-3 text-xs">
      {model.accepted_at ? (
        <p className="text-success">You are using this version.</p>
      ) : (
        <>
          <p className="text-fg-muted leading-5">
            Draft. Open it in Studio to review, then use it provisionally or add photos to rebuild. A draft does not confirm likeness.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              className={button}
              onClick={() =>
                void run(async () => {
                  await api(`models/${model.id}/accept`, {});
                  return "This avatar is now selected provisionally. You can create a new version anytime.";
                })
              }
            >
              Use this draft
            </button>
            <button disabled={busy} className="text-accent-text underline underline-offset-2" onClick={onRecapture}>
              Add photos / rebuild
            </button>
          </div>
        </>
      )}
      <div>
        <p className="text-fg-muted mb-2">Original photos and video</p>
        {retention === "deleted" ? (
          cleanup === "pending" || cleanup === "failed" ? (
            <div role="status" aria-label="Source deletion status" className="space-y-2">
              <p className="leading-5 text-accent-text">
                {cleanup === "failed"
                  ? "Deletion incomplete: storage could not remove the files after several attempts."
                  : "Deleting: your request is recorded, but source files have not all been removed from storage."}{" "}
                These photos and video can no longer be used to rebuild.
              </p>
              <button disabled={busy} className={button} onClick={() => void run(remove)}>
                Retry deletion
              </button>
            </div>
          ) : (
            <p className="text-fg-muted leading-5">Deleted from storage. Your avatar, fittings and looks are preserved; this source can no longer be used to rebuild.</p>
          )
        ) : confirm ? (
          <div role="group" aria-label="Confirm source deletion" className="space-y-2">
            <p className="leading-5">
              Permanently delete the photos and video used to create this avatar? Your avatar, fittings and looks are preserved. Jobs using these photos will be canceled.
            </p>
            <div className="flex gap-2">
              <button
                disabled={busy}
                className={`${button} border-danger text-danger`}
                onClick={() => void run(remove)}
              >
                Confirm deletion
              </button>
              <button disabled={busy} className="text-fg-muted underline" onClick={() => setConfirm(false)}>
                Keep files
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {cleanup && (
              <p className="w-full text-fg-muted leading-5">
                Some photos shared with another avatar were deleted{cleanup === "completed" ? "" : " (storage cleanup pending)"}; this source can no longer support a complete rebuild.
              </p>
            )}
            {retention === "keep" ? (
              <span className="text-fg-muted">Keeping originals.</span>
            ) : (
              <button
                disabled={busy}
                className={button}
                onClick={() =>
                  void run(async () => {
                    await api(`models/${model.id}/source`, { action: "keep" });
                    return "Original photos and video kept. You can delete them later.";
                  })
                }
              >
                Keep originals
              </button>
            )}
            <button disabled={busy} className="text-fg-muted underline underline-offset-2" onClick={() => setConfirm(true)}>
              Delete originals
            </button>
          </div>
        )}
      </div>
      <details>
        <summary className="cursor-pointer text-fg-muted">Edit face, body, hair and skin</summary>
        <p className="mt-2 leading-5 text-fg-muted">
          Not available yet: the processor does not have an avatar editor, so sliders and text edits are not enabled. You can currently add face photos, video or measurements and rebuild.
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
