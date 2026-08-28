import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg text-fg-subtle">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Brand & Manifesto */}
          <div className="space-y-4">
            <Link href="/" className="inline-block">
              <span className="font-display text-2xl font-extrabold tracking-tight text-fg">
                FITMATCH<span className="text-accent-text">.AI</span>
              </span>
            </Link>
            <p className="text-xs leading-relaxed text-fg-muted font-normal">
              High-fashion intelligence for your personal wardrobe. Analyze any garment, discover high-fidelity looks, and build a timeless aesthetic lookbook.
            </p>
            <div className="text-[11px] font-mono tabular-nums text-fg-subtle">
              © {new Date().getFullYear()} FitMatch AI. All rights reserved.
            </div>
          </div>

          {/* Column 2: Navigation */}
          <div>
            <div className="eyebrow mb-4 text-fg-muted">Product</div>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/outfits" className="text-fg-muted hover:text-fg transition">
                  Outfit Generator
                </Link>
              </li>
              <li>
                <Link href="/wardrobe" className="text-fg-muted hover:text-fg transition">
                  Digital Wardrobe
                </Link>
              </li>
              <li>
                <Link href="/quiz" className="text-fg-muted hover:text-fg transition">
                  Personal Style Quiz
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-fg-muted hover:text-fg transition">
                  Account & Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform Architecture */}
          <div>
            <div className="eyebrow mb-4 text-fg-muted">Architecture</div>
            <ul className="space-y-2.5 text-xs text-fg-subtle">
              <li>Next.js 16 App Router</li>
              <li>OpenAI Vision & Stylist Engine</li>
              <li>Supabase Auth & Storage</li>
              <li>Tailwind CSS 4 & Framer Motion</li>
            </ul>
          </div>

          {/* Column 4: Photography & Credits */}
          <div>
            <div className="eyebrow mb-4 text-fg-muted">Imagery</div>
            <p className="text-xs leading-relaxed text-fg-subtle mb-3">
              Editorial lookbook photography curated via Unsplash.
            </p>
            <div className="text-[11px] text-fg-subtle space-y-1 font-mono">
              <div>Maxime · Tamara Bellis</div>
              <div>Laura Chouette · Hunters Race</div>
              <div>Ksenia Chernaya · Aiony Haust</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
