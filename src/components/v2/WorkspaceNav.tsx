import Link from "next/link";
export const panel =
  "rounded-3xl border border-border bg-bg-elevated p-5 lg:p-7";
export const button =
  "inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium hover:bg-bg-raised disabled:opacity-40 disabled:cursor-not-allowed";
export const field =
  "mt-2 w-full rounded-xl border border-border bg-bg p-3 text-sm";
export function WorkspaceNav({ current }: { current: string }) {
  return (
    <nav
      aria-label="Personal space"
      className="mb-8 flex flex-wrap gap-2 text-xs"
    >
      {[
        ["/wardrobe", "Wardrobe"],
        ["/prepare", "Prepare 3D"],
        ["/quiz", "Your style"],
        ["/looks", "Outfit suggestions"],
        ["/studio", "Studio"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
          className={`rounded-full px-4 py-2 border ${current === href ? "border-accent text-accent-text bg-accent-soft" : "border-border text-fg-muted hover:text-fg"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
