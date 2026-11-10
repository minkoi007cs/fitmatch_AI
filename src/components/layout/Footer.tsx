import Link from "next/link";
export function Footer() {
  return (
    <footer className="border-t border-border bg-bg text-fg-muted">
      <div className="mx-auto max-w-7xl px-5 py-12 grid sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] gap-10">
        <div>
          <Link href="/" className="font-display text-2xl font-bold text-fg">
            FITMATCH<span className="text-accent-text">.AI</span>
          </Link>
          <p className="text-xs leading-6 mt-4 max-w-sm">
            Your real wardrobe, your own style. Explore outfit ideas and see each garment in your personal 3D space.
          </p>
          <p className="text-xs mt-5">
            © {new Date().getFullYear()} Fitmatch AI
          </p>
        </div>
        <nav aria-label="Explore">
          <p className="text-xs uppercase tracking-widest mb-4">
            Your space
          </p>
          <ul className="space-y-3 text-sm">
            {[
              ["/wardrobe", "Wardrobe"],
              ["/quiz", "Your style"],
              ["/looks", "Outfit suggestions"],
              ["/studio", "3D Studio"],
              ["/outfits", "2D outfit ideas"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="hover:text-fg">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-xs uppercase tracking-widest mb-4">
            From photos to 3D
          </p>
          <p className="text-xs leading-6">
            Create an avatar, add garment photos and track processing in your account.
          </p>
          <Link
            href="/prepare"
            className="text-accent-text text-sm inline-block mt-3"
          >
            Prepare photos →
          </Link>
          <p className="text-[11px] leading-5 mt-6">
            Style reference photography: Unsplash · Maxime, Tamara Bellis, Laura Chouette, Hunters Race, Ksenia Chernaya and Aiony Haust.
          </p>
        </div>
      </div>
    </footer>
  );
}
