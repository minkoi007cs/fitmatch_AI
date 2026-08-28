"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("FitMatch application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-danger">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-2 max-w-md">
        <div className="eyebrow text-danger">System Disruption</div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-fg">
          Something interrupted the lookbook.
        </h2>
        <p className="text-sm text-fg-muted font-normal">
          An unexpected error occurred while rendering this view. You can safely retry or return to your wardrobe.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="accent" onClick={() => reset()} icon={<RotateCcw className="h-4 w-4" />}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
