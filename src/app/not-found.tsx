import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="eyebrow text-accent-text">404 · Không tìm thấy trang</div>
      <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight text-fg">
        Trang này chưa có ở đây.
      </h1>
      <p className="text-sm sm:text-base text-fg-muted max-w-md font-normal leading-relaxed">
        Địa chỉ có thể đã thay đổi hoặc không còn tồn tại. Về trang chủ để mở lại không gian của bạn.
      </p>
      <div className="mt-2">
        <Link href="/" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
