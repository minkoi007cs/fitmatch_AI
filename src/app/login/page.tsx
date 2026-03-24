"use client";

import { useState } from "react";
import { Loader2, Mail, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePasswordAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const result = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage(isSignUp ? "Account created. Check your inbox if email confirmation is enabled." : "Signed in successfully.");
    if (result.data.session) {
      window.location.href = "/wardrobe";
    }
  }

  async function handleMicrosoftLogin() {
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/wardrobe`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-border bg-foreground p-8 text-background sm:p-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-background/10">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-6 text-4xl font-semibold">Sign in to save looks, build your wardrobe, and personalize your stylist.</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-background/75">
            Microsoft sign-in is ready through Supabase Auth, and email/password remains available for testing or fallback.
          </p>
          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-background/60">Included after sign-in</div>
            <div className="mt-4 grid gap-3 text-sm text-background/80">
              <div>Private wardrobe storage with signed image URLs</div>
              <div>AI style quiz saved to your profile</div>
              <div>Saved outfit history and retryable vibe generation</div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-8 shadow-xl shadow-black/5 sm:p-10">
          <h2 className="text-3xl font-semibold text-foreground">{isSignUp ? "Create your account" : "Welcome back"}</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Use Microsoft for the production auth path, or use email/password while configuring providers.
          </p>

          <button
            type="button"
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="mt-8 inline-flex w-full items-center justify-center rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-60"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Continue with Microsoft
          </button>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handlePasswordAuth} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground"
                placeholder="At least 8 characters"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-foreground px-4 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSignUp ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setIsSignUp((value) => !value)}
            className="mt-5 text-sm font-medium text-accent transition hover:opacity-80"
          >
            {isSignUp ? "Already have an account? Sign in." : "Need an account? Create one."}
          </button>

          {message ? <div className="mt-5 rounded-2xl bg-green-500/10 px-4 py-3 text-sm text-green-700">{message}</div> : null}
          {error ? <div className="mt-5 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        </div>
      </div>
    </main>
  );
}
