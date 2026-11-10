"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, Sparkles, LogOut, ChevronDown, User } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Drawer } from "@/components/ui/Drawer";

import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

const navLinks = [
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/studio", label: "Studio 3D" },
  { href: "/looks", label: "Ideas & saved looks" },
  { href: "/prepare", label: "Prepare 3D" },
  { href: "/quiz", label: "Your style" },
];

export function Navbar() {
  const pathname = usePathname();
  const { toast } = useToast();
  const isLanding = pathname === "/";

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (response.ok) setEmail((await response.json()).user?.email ?? null);
      }).catch(() => undefined);
    return () => controller.abort();
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen && !userDropdownOpen) return;
    const media = window.matchMedia("(min-width: 1024px)");
    const resize = () => { if (media.matches) setMobileMenuOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && userDropdownOpen) {
        setUserDropdownOpen(false);
        dropdownRef.current?.querySelector("button")?.focus();
      }
    };
    media.addEventListener("change", resize);
    document.addEventListener("keydown", escape);
    return () => { media.removeEventListener("change", resize); document.removeEventListener("keydown", escape); };
  }, [mobileMenuOpen, userDropdownOpen]);

  async function handleSignOut() {
    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      // Clear all client route state after revoking both authentication sessions.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (response.ok) window.location.href = "/";
      else toast("Unable to sign out. Please try again.", "error");
    } catch { toast("Lost connection. Please try signing out again.", "error"); }
  }

  const userInitial = email ? email.charAt(0).toUpperCase() : "U";

  // Solid header on all routes other than landing hero when un-scrolled
  const showSolidBackground = !isLanding || isScrolled;

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-all duration-300",
          showSolidBackground
            ? "border-b border-border bg-bg/90 backdrop-blur-xl py-3.5 shadow-lg shadow-black/20"
            // Over the landing hero photo: keep the image visible but guarantee readable text on any photo
            // (CL-UX-47: links measured 2.4:1 over a bright image with a fully transparent header).
            : "border-b border-transparent bg-gradient-to-b from-black/80 via-black/55 to-black/0 py-5"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Wordmark Left */}
          <Link href="/" className="flex items-center gap-2 group select-none">
            <span className="font-display text-2xl font-extrabold tracking-tight text-fg transition-opacity group-hover:opacity-90">
              FITMATCH<span className="text-accent-text">.AI</span>
            </span>
          </Link>

          {/* Nav Links Center */}
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-5 xl:gap-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "text-xs uppercase tracking-[0.16em] font-medium transition-colors duration-150 py-1 relative",
                    isActive
                      ? "text-fg"
                      : showSolidBackground
                        ? "text-fg-muted hover:text-fg"
                        : "text-white/85 hover:text-white"
                  )}
                >
                  {link.label}
                  {isActive ? (
                    <span className="absolute bottom-0 inset-x-0 h-[2px] bg-accent" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Auth Cluster Right */}
          <div className="hidden lg:flex items-center gap-4">
            {email ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 rounded-full border border-border-strong bg-bg-raised/80 pl-1.5 pr-3 py-1 text-sm text-fg transition hover:border-accent-ring hover:bg-bg-raised focus-visible:outline-2 focus-visible:outline-accent-ring"
                  aria-expanded={userDropdownOpen}
                  aria-label="Open account menu"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[#0A0A0B] text-xs font-bold font-mono">
                    {userInitial}
                  </div>
                  <span className="text-xs text-fg-muted font-medium max-w-[120px] truncate">
                    {email.split("@")[0]}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-fg-subtle" />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {userDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 rounded-[8px] border border-border-strong bg-bg-elevated/95 backdrop-blur-xl p-2 shadow-2xl z-50 text-xs"
                    >
                      <div className="px-3 py-2 border-b border-border/80 mb-1">
                        <div className="text-[10px] uppercase tracking-wider text-fg-subtle">Account</div>
                        <div className="text-fg font-medium truncate mt-0.5">{email}</div>
                      </div>

                      <div className="space-y-0.5">
                        <Link
                          href="/wardrobe"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-fg-muted hover:text-fg hover:bg-bg-raised transition"
                        >
                          Your wardrobe
                        </Link>
                        <Link
                          href="/outfits"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-fg-muted hover:text-fg hover:bg-bg-raised transition"
                        >
                          2D outfit ideas
                        </Link>
                        <Link
                          href="/quiz"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-fg-muted hover:text-fg hover:bg-bg-raised transition"
                        >
                          Your style
                        </Link>
                      </div>

                      <div className="border-t border-border/80 mt-1 pt-1">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2 rounded-[4px] px-3 py-2 text-danger hover:bg-danger/10 transition text-left"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-[8px] bg-accent hover:bg-accent-hover text-[#0A0A0B] px-4 py-2 text-xs uppercase tracking-[0.14em] font-bold transition shadow-sm"
              >
                <User className="h-3.5 w-3.5" />
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex lg:hidden rounded-[4px] border border-border bg-bg-raised min-h-11 min-w-11 items-center justify-center p-2 text-fg"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <Drawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} title="Your space" description="Your wardrobe, your style and your saved looks.">
        <nav id="mobile-navigation" aria-label="Mobile navigation" className="flex flex-col gap-2">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} onClick={() => setMobileMenuOpen(false)} className={cn("flex min-h-12 items-center rounded-xl px-4 py-3 text-base", pathname === link.href ? "bg-accent-soft text-accent-text" : "text-fg hover:bg-bg-raised")}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-border pt-6">
          {email ? <div className="space-y-4"><p className="break-all text-xs text-fg-muted">Signed in as: {email}</p><button type="button" onClick={handleSignOut} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm text-danger"><LogOut size={16} />Sign out</button></div> : <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg"><Sparkles size={16} />Sign in</Link>}
        </div>
      </Drawer>
    </>
  );
}
