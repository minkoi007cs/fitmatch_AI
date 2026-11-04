"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, Sparkles, LogOut, ChevronDown, User } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

const navLinks = [
  { href: "/outfits", label: "Outfits" },
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/quiz", label: "Style Quiz" },
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

  async function handleSignOut() {
    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      if (response.ok) window.location.href = "/";
      else toast("Could not finish signing out. Please retry.", "error");
    } catch { toast("Connection interrupted. Please retry signing out.", "error"); }
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
            : "border-b border-transparent bg-transparent py-5"
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
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-xs uppercase tracking-[0.16em] font-medium transition-colors duration-150 py-1 relative",
                    isActive
                      ? "text-fg"
                      : "text-fg-muted hover:text-fg"
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
          <div className="hidden md:flex items-center gap-4">
            {email ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 rounded-full border border-border-strong bg-bg-raised/80 pl-1.5 pr-3 py-1 text-sm text-fg transition hover:border-accent-ring hover:bg-bg-raised focus-visible:outline-2 focus-visible:outline-accent-ring"
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="true"
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
                        <div className="text-[10px] uppercase tracking-wider text-fg-subtle">Signed In As</div>
                        <div className="text-fg font-medium truncate mt-0.5">{email}</div>
                      </div>

                      <div className="space-y-0.5">
                        <Link
                          href="/wardrobe"
                          className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-fg-muted hover:text-fg hover:bg-bg-raised transition"
                        >
                          Wardrobe Collection
                        </Link>
                        <Link
                          href="/outfits"
                          className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-fg-muted hover:text-fg hover:bg-bg-raised transition"
                        >
                          Outfit Generator
                        </Link>
                        <Link
                          href="/quiz"
                          className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-fg-muted hover:text-fg hover:bg-bg-raised transition"
                        >
                          Personal Style Quiz
                        </Link>
                      </div>

                      <div className="border-t border-border/80 mt-1 pt-1">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2 rounded-[4px] px-3 py-2 text-danger hover:bg-danger/10 transition text-left"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Sign Out
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
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex md:hidden rounded-[4px] border border-border bg-bg-raised p-2 text-fg"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Fullscreen Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-30 flex flex-col justify-between bg-bg/98 backdrop-blur-2xl px-6 pt-28 pb-12 md:hidden"
          >
            <nav className="flex flex-col gap-6">
              {navLinks.map((link, idx) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * idx, duration: 0.3 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="font-display text-4xl font-extrabold tracking-tight text-fg hover:text-accent-text transition"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            <div className="border-t border-border pt-6 space-y-4">
              {email ? (
                <div className="space-y-3">
                  <div className="text-xs text-fg-subtle">Signed in as {email}</div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 rounded-[8px] border border-border bg-bg-raised px-5 py-3 text-sm font-medium text-danger"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 rounded-[8px] bg-accent text-[#0A0A0B] px-5 py-3.5 text-sm font-bold uppercase tracking-wider"
                >
                  <Sparkles className="h-4 w-4" />
                  Sign In / Register
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
