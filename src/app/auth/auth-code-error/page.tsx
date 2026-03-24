import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full rounded-[2rem] border border-border bg-card p-8 text-center shadow-xl shadow-black/5 sm:p-10">
        <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Authentication Error</div>
        <h1 className="mt-4 text-3xl font-semibold text-foreground">We could not finish your Microsoft sign-in.</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Double-check your Supabase Microsoft provider settings and redirect URL, then try again.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
        >
          Back to Login
        </Link>
      </div>
    </main>
  );
}
