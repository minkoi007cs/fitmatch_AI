import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full rounded-[8px] border border-border bg-bg-elevated p-8 text-center sm:p-10 space-y-5">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-danger">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="eyebrow text-danger">Authentication Error</div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-fg">
          Unable to complete Microsoft sign-in.
        </h1>
        <p className="text-xs sm:text-sm text-fg-muted font-normal leading-relaxed">
          Verify your Azure / Microsoft provider configuration in Supabase, confirm the redirect callback URL, and attempt authentication again.
        </p>
        <div className="pt-4">
          <Link href="/login">
            <Button variant="accent" size="md" icon={<ArrowLeft className="h-4 w-4" />}>
              Back to Login
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
