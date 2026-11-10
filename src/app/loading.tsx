import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-4 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-strong bg-bg-raised">
        <Loader2 className="h-5 w-5 animate-spin text-accent-text" />
      </div>
      <div className="text-sm text-fg-muted">Loading your space…</div>
    </div>
  );
}
