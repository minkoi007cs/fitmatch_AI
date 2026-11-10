import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="eyebrow text-accent-text">404 · Page not found</div>
      <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight text-fg">
        {"This page doesn't exist."}
      </h1>
      <p className="text-sm sm:text-base text-fg-muted max-w-md font-normal leading-relaxed">
        The address may have changed or may no longer exist. Return home to open your space again.
      </p>
      <div className="mt-2">
        <Link href="/" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </main>
  );
}
