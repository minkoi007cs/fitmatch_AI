"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Shirt, Sparkles, User, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { href: "/outfits", label: "Outfits" },
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/quiz", label: "Style Quiz" },
];

export function Navbar() {
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setEmail(data.user?.email ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background shadow-lg shadow-black/10">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground">FitMatch</div>
            <div className="text-lg font-semibold text-foreground">AI Stylist</div>
          </div>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
              {link.label}
            </Link>
          ))}
          {email ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right lg:block">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Signed in</div>
                <div className="max-w-48 truncate text-sm font-medium text-foreground">{email}</div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-foreground/20 hover:bg-secondary"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
            >
              <User className="h-4 w-4" />
              Sign In
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="inline-flex rounded-full border border-border bg-card p-2 text-foreground md:hidden"
          aria-label="Toggle navigation"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-border bg-card md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-foreground transition hover:bg-secondary"
              >
                <Shirt className="h-4 w-4 text-muted-foreground" />
                {link.label}
              </Link>
            ))}
            {email ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-2xl bg-foreground px-4 py-3 text-left text-sm font-medium text-background"
              >
                Sign Out
              </button>
            ) : (
              <Link href="/login" onClick={() => setIsOpen(false)} className="rounded-2xl bg-foreground px-4 py-3 text-sm font-medium text-background">
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
