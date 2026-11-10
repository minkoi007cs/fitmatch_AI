"use client";

import { useEffect } from "react";
import Link from "next/link";
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
        <div className="eyebrow text-danger">Chưa mở được trang</div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-fg">
          Đã có lỗi khi tải nội dung.
        </h2>
        <p className="text-sm text-fg-muted font-normal">
          Hãy thử tải lại hoặc quay về tủ đồ để tiếp tục.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="accent" onClick={() => reset()} icon={<RotateCcw className="h-4 w-4" />}>
          Thử tải lại
        </Button>
        <Link href="/wardrobe" className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 py-3 text-sm">Về tủ đồ</Link>
      </div>
    </div>
  );
}
