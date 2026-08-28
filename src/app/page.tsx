"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronDown, Sparkles, Layers, ShieldCheck, Cpu } from "lucide-react";
import { motion } from "framer-motion";
import { IMAGES, DARK_BLUR_DATA_URL } from "@/lib/images";

const editorialSteps = [
  {
    step: "01",
    title: "Capture",
    description: "Snap or upload any garment directly from your camera or library.",
    image: IMAGES.stepCapture,
  },
  {
    step: "02",
    title: "Analyze",
    description: "Vision AI extracts palette, silhouette, material, and aesthetic category.",
    image: IMAGES.stepAnalyze,
  },
  {
    step: "03",
    title: "Style",
    description: "Generates four coordinated outfits tuned precisely to your lifestyle.",
    image: IMAGES.stepStyle,
  },
];

const looksGeneratedToday = [
  {
    id: "look-1",
    title: "Tonal Relaxed Layering",
    category: "Casual Minimal",
    image: IMAGES.look1,
    pieces: ["Cream Waffle Knit", "Pleated Charcoal Trouser", "Derby Shoes"],
  },
  {
    id: "look-2",
    title: "Architectural Suiting",
    category: "Formal Editorial",
    image: IMAGES.look2,
    pieces: ["Double-Breasted Blazer", "Poplin Shirt", "Slim Loafers"],
  },
  {
    id: "look-3",
    title: "Monochrome Trench Line",
    category: "Minimal",
    image: IMAGES.look3,
    pieces: ["Oversized Trench", "Mockneck Base", "Structured Denim"],
  },
  {
    id: "look-4",
    title: "Urban Texture Contrast",
    category: "Streetwear",
    image: IMAGES.look4,
    pieces: ["Boxy Wool Blouson", "Relaxed Cargo", "Clean Leather Sneaker"],
  },
  {
    id: "look-5",
    title: "High-Contrast Contemporary",
    category: "Editorial",
    image: IMAGES.look5,
    pieces: ["Sculptural Knit", "Raw Edge Skirt/Pants", "Minimalist Jewelry"],
  },
];

const styleLaneData = [
  { style: "casual" as const, image: IMAGES.styleCasual, label: "Casual" },
  { style: "streetwear" as const, image: IMAGES.styleStreetwear, label: "Streetwear" },
  { style: "minimal" as const, image: IMAGES.styleMinimal, label: "Minimal" },
  { style: "formal" as const, image: IMAGES.styleFormal, label: "Formal" },
  { style: "sporty" as const, image: IMAGES.styleSporty, label: "Sporty" },
  { style: "vintage" as const, image: IMAGES.styleVintage, label: "Vintage" },
];

const alternatingLooks = [
  {
    id: "alt-1",
    lookName: "The Effortless Overcoat",
    category: "Minimal / Streetwear",
    occasion: "Gallery Openings & Evening Coffee",
    confidence: "98%",
    description: "Built around a relaxed neutral overcoat. High collar creates vertical length while relaxed raw denim balances formal tailored structure.",
    pieces: [
      { name: "Oversized Wool Trench", color: "Oatmeal" },
      { name: "Heavyweight Cotton Tee", color: "Off-White" },
      { name: "Raw Selvedge Denim", color: "Deep Indigo" },
      { name: "Chunky Lug-Sole Loafers", color: "Black" },
    ],
    image: IMAGES.altLook1,
  },
  {
    id: "alt-2",
    lookName: "Tactile Monochrome Knit",
    category: "Casual Luxury",
    occasion: "Weekend Dinners & Travel",
    confidence: "95%",
    description: "An exercise in subtle texture contrast. Deep charcoal cashmere meets crisp cotton poplin and fluid tailored trousers.",
    pieces: [
      { name: "Chunky Ribbed Crewneck", color: "Charcoal" },
      { name: "Relaxed Wool Trousers", color: "Slate" },
      { name: "Minimalist Leather Tote", color: "Black" },
      { name: "Retro Court Sneakers", color: "Cream/Gum" },
    ],
    image: IMAGES.altLook2,
  },
  {
    id: "alt-3",
    lookName: "Sharp Editorial Tailoring",
    category: "Modern Formal",
    occasion: "Client Presentations & Nights Out",
    confidence: "99%",
    description: "Unstructured soft shoulder blazer paired with tonal inner layers for a look that commands respect without stiff rigidity.",
    pieces: [
      { name: "Relaxed Unstructured Blazer", color: "Midnight Navy" },
      { name: "Fine Gauge Silk-Cotton Knit", color: "Ink" },
      { name: "Straight Fit Pleated Pants", color: "Midnight Navy" },
      { name: "Polished Chelsea Boots", color: "Espresso" },
    ],
    image: IMAGES.altLook3,
  },
];

const savedFormulas = [
  {
    title: "The Coffee Run Uniform",
    pieces: "Heavyweight Crew + Wide Denim + Retro Runner",
    vibe: "Casual Minimal",
    isTop: true,
    score: "98%",
  },
  {
    title: "Casual Friday Office",
    pieces: "Boxy Blazer + Supima Tee + Pleated Chino",
    vibe: "Smart Casual",
    isTop: false,
    score: "94%",
  },
  {
    title: "Creative Studio Meeting",
    pieces: "Cardigan Layer + Straight Trousers + Derby Shoes",
    vibe: "Contemporary",
    isTop: false,
    score: "96%",
  },
  {
    title: "Night Out Dinner",
    pieces: "Camp Collar Silk Shirt + Dark Trousers + Minimal Boots",
    vibe: "Relaxed Formal",
    isTop: false,
    score: "92%",
  },
];

const testimonials = [
  {
    quote: "FitMatch stopped me from buying duplicate jackets. It built five looks I had never thought of with pieces already in my closet.",
    author: "Elena Rostova",
    role: "Architect & Creative Director",
    avatar: IMAGES.avatar1,
  },
  {
    quote: "The vision model understands silhouette and color contrast better than most personal stylists I’ve booked in London.",
    author: "Marcus Keller",
    role: "Product Designer",
    avatar: IMAGES.avatar2,
  },
  {
    quote: "Taking one photo of vintage trousers and instantly getting 4 styled outfits with confidence scores is purely addictive.",
    author: "Sofia Torres",
    role: "Fashion Photographer",
    avatar: IMAGES.avatar3,
  },
];

const communityImages = [
  IMAGES.comm1,
  IMAGES.comm2,
  IMAGES.comm3,
  IMAGES.comm4,
  IMAGES.comm5,
  IMAGES.comm6,
];

export default function Home() {
  return (
    <main className="min-h-screen bg-bg text-fg overflow-hidden">
      {/* 1. Full-Bleed 100svh Hero */}
      <section className="relative h-[100svh] w-full flex items-end justify-start overflow-hidden">
        {/* Ken Burns Background Image */}
        <motion.div
          animate={{ scale: [1, 1.08] }}
          transition={{ duration: 8, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
          className="absolute inset-0 z-0"
        >
          <Image
            src={IMAGES.heroLanding.src}
            alt={IMAGES.heroLanding.alt}
            fill
            priority
            sizes="100vw"
            placeholder="blur"
            blurDataURL={DARK_BLUR_DATA_URL}
            className="object-cover object-top"
          />
        </motion.div>

        {/* Gradient Scrim */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(10,10,11,0.98) 0%, rgba(10,10,11,0.45) 45%, rgba(10,10,11,0.7) 100%)",
          }}
        />

        {/* Hero Content Anchored Bottom-Left */}
        <div className="relative z-20 mx-auto w-full max-w-7xl px-4 pb-16 sm:pb-20 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-3xl"
          >
            <div className="eyebrow text-accent-text mb-4 inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              AI PERSONAL STYLIST & WARDROBE INTELLIGENCE
            </div>

            <h1 className="font-display text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tight text-fg leading-[0.92] text-balance">
              One photo. <br />
              A whole look.
            </h1>

            <p className="mt-6 max-w-xl text-base sm:text-lg text-fg-muted font-normal leading-relaxed">
              Upload a shirt, sneaker, blazer, or any wardrobe piece. FitMatch analyzes the item, learns your style, and generates polished outfit combinations you can actually wear.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href="/outfits"
                className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-accent hover:bg-accent-hover text-[#0A0A0B] px-8 py-4 text-sm font-bold uppercase tracking-wider transition duration-150 shadow-lg shadow-accent/20"
              >
                Try Outfit Generator
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/wardrobe"
                className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-border-strong bg-bg-elevated/80 hover:bg-bg-raised text-fg px-7 py-4 text-sm font-medium transition duration-150 backdrop-blur-sm"
              >
                Build My Wardrobe
              </Link>
            </div>
          </motion.div>

          {/* Animated Scroll Indicator */}
          <div className="absolute bottom-6 right-6 sm:right-8 hidden md:flex flex-col items-center gap-2 text-fg-subtle">
            <span className="eyebrow text-[10px]">Scroll</span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown className="h-4 w-4" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. Three Full-Height Editorial Blocks (Capture / Analyze / Style) */}
      <section className="border-t border-border bg-bg">
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
          {editorialSteps.map((item, idx) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="group relative h-[480px] sm:h-[560px] overflow-hidden flex flex-col justify-between p-8 sm:p-10 cursor-pointer"
            >
              {/* Background Photo */}
              <div className="absolute inset-0 z-0 overflow-hidden">
                <Image
                  src={item.image.src}
                  alt={item.image.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  placeholder="blur"
                  blurDataURL={DARK_BLUR_DATA_URL}
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 opacity-40 group-hover:opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
              </div>

              {/* Step Mono Number */}
              <div className="relative z-10 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold tabular-nums text-accent-text border border-accent-ring/40 bg-bg/80 px-2.5 py-1 rounded-[4px] backdrop-blur-sm">
                  STEP {item.step}
                </span>
                <span className="eyebrow text-fg-subtle opacity-0 group-hover:opacity-100 transition-opacity">
                  Explore
                </span>
              </div>

              {/* Step Info */}
              <div className="relative z-10 space-y-2 transform transition-transform duration-300 group-hover:-translate-y-1">
                <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-fg">
                  {item.title}
                </h3>
                <p className="text-sm text-fg-muted leading-relaxed font-normal max-w-sm">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 3. Horizontal Scroll Strip — "Looks Generated Today" */}
      <section className="py-20 sm:py-28 border-t border-border bg-bg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-8 sm:mb-12 flex items-end justify-between">
          <div>
            <div className="eyebrow text-accent-text mb-2">Live Curation Stream</div>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-fg leading-none">
              Looks generated today.
            </h2>
          </div>
          <Link
            href="/outfits"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-fg-muted hover:text-accent-text transition"
          >
            Open Generator <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Snap Scrolling Strip */}
        <div className="flex gap-6 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-6 snap-x snap-mandatory scrollbar-thin">
          {looksGeneratedToday.map((look) => (
            <div
              key={look.id}
              className="flex-none w-[280px] sm:w-[320px] snap-start group cursor-pointer"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[2px] border border-border bg-bg-elevated">
                <Image
                  src={look.image.src}
                  alt={look.image.alt}
                  fill
                  sizes="320px"
                  placeholder="blur"
                  blurDataURL={DARK_BLUR_DATA_URL}
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-elevated via-transparent to-transparent opacity-80" />
                <div className="absolute top-3 left-3">
                  <span className="eyebrow bg-bg/80 border border-border px-2.5 py-1 rounded-[2px] backdrop-blur-sm text-fg">
                    {look.category}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                <h4 className="font-display text-lg font-bold text-fg group-hover:text-accent-text transition">
                  {look.title}
                </h4>
                <div className="flex flex-wrap gap-1 text-[11px] text-fg-muted">
                  {look.pieces.map((p, i) => (
                    <span key={p}>
                      {p}
                      {i < look.pieces.length - 1 ? " · " : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Style Lanes Row (6 Real STYLE_CATEGORIES) */}
      <section className="py-20 sm:py-24 border-t border-border bg-bg-elevated/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 sm:mb-12">
            <div className="eyebrow text-accent-text mb-2">Aesthetic Spectrum</div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-fg">
              Six core style lanes.
            </h2>
            <p className="text-sm text-fg-muted mt-2 max-w-lg font-normal">
              FitMatch adapts to distinct silhouettes, balancing color palette, fit, and accessories.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {styleLaneData.map((item) => (
              <Link
                key={item.style}
                href={`/outfits?vibe=${item.style}`}
                className="group relative h-48 sm:h-56 overflow-hidden rounded-[2px] border border-border bg-bg-raised flex flex-col justify-end p-4 transition-all duration-300 hover:border-accent-ring"
              >
                <Image
                  src={item.image.src}
                  alt={item.image.alt}
                  fill
                  sizes="(max-width: 768px) 50vw, 16vw"
                  placeholder="blur"
                  blurDataURL={DARK_BLUR_DATA_URL}
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-110 opacity-40 group-hover:opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
                <div className="relative z-10">
                  <div className="eyebrow text-fg-subtle group-hover:text-accent-text transition mb-1 text-[10px]">
                    VIBE
                  </div>
                  <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-fg">
                    {item.label}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Alternating Lookbook Section (3 In-Depth Looks) */}
      <section className="py-20 sm:py-32 border-t border-border bg-bg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 sm:mb-24 text-center max-w-2xl mx-auto">
            <div className="eyebrow text-accent-text mb-2">Editorial Anatomy</div>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-fg leading-tight">
              Curated breakdowns.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-fg-muted font-normal">
              Every outfit generated includes color theory rationale, piece coordination, and confidence scoring.
            </p>
          </div>

          <div className="space-y-24 sm:space-y-32">
            {alternatingLooks.map((look, index) => {
              const isEven = index % 2 === 1;
              return (
                <motion.div
                  key={look.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className={`grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center ${
                    isEven ? "lg:grid-flow-dense" : ""
                  }`}
                >
                  {/* Image Column */}
                  <div
                    className={`relative aspect-[3/4] w-full overflow-hidden rounded-[2px] border border-border bg-bg-elevated ${
                      isEven ? "lg:col-span-6 lg:col-start-7" : "lg:col-span-6"
                    }`}
                  >
                    <Image
                      src={look.image.src}
                      alt={look.image.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      placeholder="blur"
                      blurDataURL={DARK_BLUR_DATA_URL}
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent opacity-60" />
                  </div>

                  {/* Text / Breakdown Column */}
                  <div
                    className={`space-y-6 ${
                      isEven ? "lg:col-span-6 lg:col-start-1" : "lg:col-span-6"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="eyebrow bg-accent-soft text-accent-text border border-accent-ring/30 px-2.5 py-1 rounded-[4px]">
                        {look.category}
                      </span>
                      <span className="font-mono text-xs text-fg-subtle tabular-nums">
                        CONFIDENCE: {look.confidence}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-fg">
                        {look.lookName}
                      </h3>
                      <p className="mt-1 text-xs font-mono uppercase tracking-wider text-fg-subtle">
                        Occasion: {look.occasion}
                      </p>
                    </div>

                    <p className="text-sm text-fg-muted leading-relaxed font-normal">
                      {look.description}
                    </p>

                    {/* Pieces Breakdown Box */}
                    <div className="border border-border rounded-[8px] bg-bg-elevated p-5 space-y-3">
                      <div className="eyebrow text-[10px] text-fg-subtle">Outfit Components</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {look.pieces.map((piece) => (
                          <div
                            key={piece.name}
                            className="flex items-center justify-between text-xs py-1 border-b border-border/50"
                          >
                            <span className="text-fg font-medium">{piece.name}</span>
                            <span className="text-fg-subtle font-mono text-[11px]">{piece.color}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Link
                        href="/outfits"
                        className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] font-bold text-accent-text hover:text-accent transition"
                      >
                        Generate looks like this <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Most-Saved Formulas Grid */}
      <section className="py-20 sm:py-28 border-t border-border bg-bg-elevated/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12">
            <div>
              <div className="eyebrow text-accent-text mb-2">Wardrobe Staples</div>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-fg">
                Most-saved formulas.
              </h2>
            </div>
            <p className="text-xs text-fg-subtle max-w-xs mt-2 sm:mt-0 font-normal">
              High-repeat combinations calculated from wardrobe analyses.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {savedFormulas.map((item) => (
              <div
                key={item.title}
                className={`relative rounded-[8px] border p-6 flex flex-col justify-between transition-colors duration-200 ${
                  item.isTop
                    ? "border-accent/50 bg-bg-elevated shadow-[0_0_24px_rgba(196,98,45,0.08)]"
                    : "border-border bg-bg-elevated/60 hover:border-border-strong"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="eyebrow text-[10px] text-fg-subtle">{item.vibe}</span>
                    {item.isTop ? (
                      <span className="eyebrow bg-accent text-[#0A0A0B] font-bold px-2 py-0.5 rounded-[2px]">
                        #1 TRENDING
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-fg-subtle tabular-nums">{item.score}</span>
                    )}
                  </div>
                  <h3 className="font-display text-xl font-bold text-fg mb-3">{item.title}</h3>
                  <p className="text-xs text-fg-muted leading-relaxed font-normal">{item.pieces}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs">
                  <span className="text-fg-subtle font-mono text-[11px]">Formula Score</span>
                  <span className="text-accent-text font-mono font-medium">{item.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. How it Works / Trust Section (Editorial Style) */}
      <section className="py-20 sm:py-28 border-t border-border bg-bg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-8">
              <div>
                <div className="eyebrow text-accent-text mb-3">Intelligence & Architecture</div>
                <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-fg leading-tight">
                  High fashion logic, powered by vision.
                </h2>
                <p className="mt-4 text-sm text-fg-muted leading-relaxed font-normal">
                  FitMatch doesn&apos;t just guess keywords. Our stylist engine processes garment texture, fit context, color theory contrast, and user preferences to build wearable outfits.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-[4px] border border-border bg-bg-raised flex items-center justify-center shrink-0 text-accent-text">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-fg">Multimodal Feature Extraction</h4>
                    <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                      AI clothing recognition with primary & secondary color, weave pattern, silhouette, and aesthetic classification.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-[4px] border border-border bg-bg-raised flex items-center justify-center shrink-0 text-accent-text">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-fg">Vibe & Lifestyle Tuning</h4>
                    <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                      Instant generation across casual, streetwear, minimal, formal, sporty, and vintage with single-click cycle.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-[4px] border border-border bg-bg-raised flex items-center justify-center shrink-0 text-accent-text">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-fg">Private Digital Wardrobe</h4>
                    <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                      Encrypted storage with signed image URLs, full search filters, and persistent outfit history.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2px] border border-border-strong bg-bg-elevated">
                <Image
                  src={IMAGES.stepAnalyze.src}
                  alt="High fashion garment craftsmanship and tailoring"
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  placeholder="blur"
                  blurDataURL={DARK_BLUR_DATA_URL}
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-bg/90 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 p-6 rounded-[8px] bg-bg-elevated/90 border border-border backdrop-blur-md">
                  <div className="eyebrow text-accent-text mb-1">Stylist Guarantee</div>
                  <p className="font-display text-xl font-bold text-fg">
                    &ldquo;Every outfit suggested is grounded in wearable garment pairings you can actually execute.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Testimonials Section */}
      <section className="py-20 sm:py-28 border-t border-border bg-bg-elevated/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <div className="eyebrow text-accent-text mb-2">Community Voices</div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-fg">
              Loved by designers & creatives.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.author}
                className="rounded-[8px] border border-border bg-bg-elevated p-8 flex flex-col justify-between"
              >
                <blockquote className="font-display text-lg sm:text-xl font-bold text-fg leading-snug">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                <div className="mt-8 flex items-center gap-3 pt-4 border-t border-border/60">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full border border-border">
                    <Image
                      src={t.avatar.src}
                      alt={t.author}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-fg">{t.author}</div>
                    <div className="text-[11px] text-fg-subtle">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Full-Width Terracotta Accent Band CTA */}
      <section className="bg-accent text-[#0A0A0B] py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center space-y-6">
          <div className="text-xs font-mono font-bold uppercase tracking-[0.24em] opacity-80">
            AI-POWERED PERSONAL CURATION
          </div>
          <h2 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[0.95] text-balance">
            Your closet already has the outfit.
          </h2>
          <p className="text-sm sm:text-base font-medium max-w-xl mx-auto opacity-90 leading-relaxed">
            Create an account or sign in with Microsoft to start analyzing your wardrobe, taking the style quiz, and generating outfits in seconds.
          </p>
          <div className="pt-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#0A0A0B] text-fg hover:bg-black px-8 py-4 text-sm font-bold uppercase tracking-wider transition duration-150 shadow-2xl"
            >
              Start Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 10. 6-Image Community Grid (Edge-to-Edge) */}
      <section className="border-t border-border bg-bg">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {communityImages.map((img, i) => (
            <div
              key={`comm-${i}`}
              className="group relative aspect-square overflow-hidden border-r border-b border-border/60 bg-bg-elevated"
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                placeholder="blur"
                blurDataURL={DARK_BLUR_DATA_URL}
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-bg/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="eyebrow text-fg text-[10px] bg-bg/80 px-2 py-1 rounded-[2px] backdrop-blur-sm">
                  FITMATCH LOOKS
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
