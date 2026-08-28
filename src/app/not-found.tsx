import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="eyebrow text-accent-text">404 Error</div>
      <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight text-fg">
        Look not found.
      </h1>
      <p className="text-sm sm:text-base text-fg-muted max-w-md font-normal leading-relaxed">
        The page or collection you are seeking has been archived or does not exist in our styling index.
      </p>
      <div className="mt-2">
        <Link href="/">
          <Button variant="accent" icon={<ArrowLeft className="h-4 w-4" />}>
            Return Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
