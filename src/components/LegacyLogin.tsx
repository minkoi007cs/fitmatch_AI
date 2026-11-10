"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { IMAGES, DARK_BLUR_DATA_URL } from "@/lib/images";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export default function LegacyLogin({ returnTo = "/wardrobe", hosted = false }: { returnTo?: string; hosted?: boolean }) {
  const supabase = createClient();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  async function handlePasswordAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const result = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      setLoading(false);

      if (result.error) {
        toast(result.error.message, "error");
        return;
      }

      if (isSignUp) {
        toast("Account created. Check your email to confirm if required.", "success");
      } else {
        toast("Signed in.", "success");
      }

      if (result.data.session) {
        window.location.href = returnTo;
      }
    } catch (err) {
      setLoading(false);
      toast(err instanceof Error ? err.message : "Unable to sign in. Please try again.", "error");
    }
  }

  async function handleMicrosoftLogin() {
    setOauthLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
        },
      });

      if (oauthError) {
        toast(oauthError.message, "error");
        setOauthLoading(false);
      }
    } catch (err) {
      setOauthLoading(false);
      toast(err instanceof Error ? err.message : "Unable to connect to the sign-in service.", "error");
    }
  }

  return (
    <main className="mt-20 min-h-[calc(100vh-5rem)] lg:h-[calc(100vh-5rem)] w-full flex overflow-hidden bg-bg">
      {/* Left 55%: Full-Bleed Editorial Photo Hero (Desktop Only) */}
      <div className="hidden lg:relative lg:flex lg:w-[55%] h-full overflow-hidden bg-bg-elevated border-r border-border">
        <div
          className="absolute inset-0 z-0"
        >
          <Image
            src={IMAGES.heroLogin.src}
            alt={IMAGES.heroLogin.alt}
            fill
            priority
            sizes="55vw"
            placeholder="blur"
            blurDataURL={DARK_BLUR_DATA_URL}
            className="object-cover"
          />
        </div>

        {/* Gradient Scrim */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(10,10,11,0.96) 0%, rgba(10,10,11,0.3) 50%, rgba(10,10,11,0.7) 100%)",
          }}
        />

        {/* Brand Overlay */}
        <div className="relative z-20 flex h-full w-full flex-col justify-between p-12">
          <div>
            <Link href="/" className="inline-block select-none">
              <span className="font-display text-3xl font-extrabold tracking-tight text-fg">
                FITMATCH<span className="text-accent-text">.AI</span>
              </span>
            </Link>
          </div>

          <div className="space-y-3 max-w-md">
            <div className="eyebrow text-accent-text">PERSONAL ACCOUNT</div>
            <h2 className="font-display text-4xl font-extrabold text-fg leading-tight">
              Your wardrobe. Your personal style.
            </h2>
            <p className="text-xs text-fg-muted leading-relaxed font-normal">
              Save your clothes, remember your style and revisit your favorite looks.
            </p>
          </div>
        </div>
      </div>

      {/* Right 45%: Auth Form Container */}
      <div className="flex w-full lg:w-[45%] h-full items-center justify-center px-6 py-12 sm:px-12 bg-bg">
        <div className="w-full max-w-[400px] space-y-7">
          <div className="space-y-2">
            <div className="eyebrow text-accent-text">
              {isSignUp ? "Create account" : "Welcome back"}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-fg">
              {isSignUp ? "Create your FitMatch account." : "Sign in to your wardrobe."}
            </h1>
            <p className="text-xs text-fg-muted leading-relaxed font-normal">
              Use your existing FitMatch account to keep your wardrobe.
            </p>
          </div>

          {/* Microsoft OAuth Button */}
          <div hidden={hosted}>
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={oauthLoading || loading}
              className="w-full h-12 flex items-center justify-center gap-3 rounded-[8px] border border-border-strong bg-bg-raised hover:bg-bg-raised/80 hover:border-accent-ring text-fg text-sm font-medium transition duration-150 cursor-pointer disabled:opacity-50"
            >
              {oauthLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-accent-text" />
              ) : (
                /* Microsoft 4-square icon */
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 21 21">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
              )}
              <span>Continue with Microsoft</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="h-px w-full bg-border" />
            <span className="absolute bg-bg px-3 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
              Email and password
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handlePasswordAuth} className="space-y-4">
            <Field label="Email address" htmlFor="email-input">
              <Input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="editor@fitmatch.ai"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Password" htmlFor="password-input">
              <div className="relative">
                <Input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg transition p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Button
              type="submit"
              variant="accent"
              loading={loading}
              className="w-full h-12 uppercase tracking-wider text-xs font-bold mt-2"
            >
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>

          {/* Sign in / Sign up Toggle */}
          <div hidden={hosted} className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp((prev) => !prev)}
              className="text-xs text-fg-muted hover:text-accent-text transition cursor-pointer"
            >
              {isSignUp ? "Already have an account? Sign in." : "New here? Create an account."}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
