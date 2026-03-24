import Link from "next/link";
import { ArrowRight, Check, Camera, Sparkles, Shirt } from "lucide-react";

const highlights = [
  "AI clothing recognition with color, pattern, and style extraction",
  "Multi-style outfit ideas across casual, streetwear, minimal, and formal",
  "Private digital wardrobe with saved history and preference learning",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col px-4 pb-16 sm:px-6 lg:px-8">
      <section className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent" />
            Personal stylist, wardrobe planner, and AI outfit engine
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
            FitMatch AI turns one clothing photo into a complete styled look.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Upload a shirt, sneaker, blazer, or any wardrobe piece. FitMatch analyzes the item, learns your style,
            and generates polished outfit combinations you can actually wear.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/outfits"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
            >
              Try Outfit Generator
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/wardrobe"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition hover:bg-secondary"
            >
              Build My Wardrobe
            </Link>
          </div>
          <div className="mt-8 grid gap-3">
            {highlights.map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <div className="mt-0.5 rounded-full bg-secondary p-1">
                  <Check className="h-4 w-4 text-foreground" />
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-xl shadow-black/5 sm:p-8">
          <div className="absolute inset-x-6 top-0 h-32 rounded-b-[2rem] bg-gradient-to-b from-accent/15 to-transparent" />
          <div className="relative grid gap-4">
            <div className="flex items-center justify-between rounded-[1.5rem] border border-border bg-background px-5 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Step 1</div>
                <div className="mt-1 text-lg font-semibold text-foreground">Upload or capture an item</div>
              </div>
              <Camera className="h-10 w-10 rounded-2xl bg-secondary p-2 text-foreground" />
            </div>
            <div className="rounded-[1.5rem] border border-border bg-background p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Step 2</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Cream hoodie", "Stone trousers", "Minimal", "Plain"].map((tag) => (
                  <span key={tag} className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-border bg-foreground p-5 text-background">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-background/10 p-2">
                  <Shirt className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.18em] text-background/70">Step 3</div>
                  <div className="text-xl font-semibold">Get four complete outfit directions</div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-background/80">
                FitMatch balances palette, silhouette, and accessories so each outfit feels intentional instead of random.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
