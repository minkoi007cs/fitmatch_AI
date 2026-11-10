import Link from "next/link";
import LegacyLogin from "@/components/LegacyLogin";
import { createClient } from "@/lib/supabase/server";
import { hubEnabled } from "@/lib/auth/config";
import { safeNext } from "@/lib/auth/session";

const messages: Record<string, string> = {
  state: "This sign-in link has expired or was opened in another browser. Please start again.",
  denied: "You canceled sign-in. You can try again anytime.",
  link_expired: "Sign in to your existing FitMatch account before connecting App System.",
  IDENTITY_ALREADY_LINKED: "This App System account is already connected to another wardrobe. Your accounts remain separate.",
  unavailable: "Unable to sign in. Your wardrobe is still saved. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; legacy?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (!hubEnabled()) return <LegacyLogin returnTo={next} />;
  if (params.legacy === "1") return <LegacyLogin hosted returnTo={`/login?next=${encodeURIComponent(next)}`} />;
  const legacy = await (await createClient()).auth.getUser();
  const connect = !!legacy.data.user;

  return (
    <main className="min-h-[75vh] px-6 pt-32 pb-16 flex items-start justify-center bg-bg">
      <section className="w-full max-w-md rounded-lg border border-border bg-bg-elevated p-7 space-y-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-accent-text">FitMatch AI</p>
          <h1 className="font-display text-3xl font-bold">{connect ? "Connect your existing wardrobe." : "Welcome to your wardrobe."}</h1>
          <p className="text-sm leading-relaxed text-fg-muted">
            {connect ? "You are signed in to FitMatch. Connect App System to use one account while keeping this wardrobe." : "Sign in with App System. You will return to the page you were opening."}
          </p>
        </div>
        {params.error && <p role="alert" className="rounded border border-danger/40 p-3 text-sm text-fg">{messages[params.error] ?? messages.unavailable}</p>}
        {connect ? (
          <form action={`/auth/link?next=${encodeURIComponent(next)}`} method="post">
            <button type="submit" className="w-full rounded-lg bg-accent p-3 font-semibold text-black">Connect App System to this wardrobe</button>
          </form>
        ) : (
          <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="block rounded-lg bg-accent p-3 text-center font-semibold text-black">Continue with App System</Link>
        )}
        <p className="text-sm leading-relaxed text-fg-muted">Your wardrobe and saved looks are private to your account.</p>
        {!connect && <p className="text-sm text-fg-muted">Already have a FitMatch wardrobe? <Link className="text-accent-text underline" href={`/login?legacy=1&next=${encodeURIComponent(next)}`}>Sign in to your existing account first</Link> to connect it and keep your data.</p>}
      </section>
    </main>
  );
}
