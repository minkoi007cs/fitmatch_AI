// ============================================================
// FitMatch AI — Central Image Registry
// All photo URLs and photographer credits across the application
// ============================================================

const U = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

// Flat dark-grey 8x8 base64 PNG blur placeholder to prevent white flash on near-black canvas
export const DARK_BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAQAAABuBnYAAAAAEElEQVR42mNk+M+ABzAxYAAAe1EB+4Kx9bAAAAAASUVORK5CYII=";

export interface ImageEntry {
  src: string;
  alt: string;
  credit: string;
}

export const IMAGES = {
  // Hero & Auth
  heroLanding: {
    src: U("1509631179647-0177331693ae", 2400),
    alt: "High-fashion editorial model in dark structured coat",
    credit: "Maxime / Unsplash",
  },
  heroLogin: {
    src: U("1469334031218-e382a71b716b", 1600),
    alt: "Editorial fashion portrait in moody natural lighting",
    credit: "Tamara Bellis / Unsplash",
  },

  // Editorial Steps (3 Columns on Landing)
  stepCapture: {
    src: U("1489987707025-afc232f7ea0f", 1200),
    alt: "Minimalist wardrobe rack with curated garments",
    credit: "Ksenia Chernaya / Unsplash",
  },
  stepAnalyze: {
    src: U("1558769132-cb1aea458c5e", 1200),
    alt: "Clothing textures, tailoring lines, and fabric swatches",
    credit: "Sarah Brown / Unsplash",
  },
  stepStyle: {
    src: U("1490481651871-ab68de25d43d", 1200),
    alt: "Styled lookbook model in contemporary silhouette",
    credit: "Laura Chouette / Unsplash",
  },

  // Looks Generated Today (Horizontal Scroll Strip)
  look1: {
    src: U("1534528741775-53994a69daeb", 1200),
    alt: "Effortless casual layered knitwear and trousers",
    credit: "Aiony Haust / Unsplash",
  },
  look2: {
    src: U("1507679799987-c73779587ccf", 1200),
    alt: "Tailored charcoal monochrome blazer and pleated pants",
    credit: "Hunters Race / Unsplash",
  },
  look3: {
    src: U("1529139574466-a303027c1d8b", 1200),
    alt: "Architectural minimal trench coat with dark neutrals",
    credit: "Dom Hill / Unsplash",
  },
  look4: {
    src: U("1552374196-1ab2a1c593e8", 1200),
    alt: "Modern streetwear silhouette with relaxed wool coat",
    credit: "Clem Onojeghuo / Unsplash",
  },
  look5: {
    src: U("1515886657613-9f3515b0c78f", 1200),
    alt: "Contemporary silhouette in bold monochromatic tones",
    credit: "Apostolos Vamvouras / Unsplash",
  },

  // Style Lanes (6 Interactive Tiles)
  styleCasual: {
    src: U("1516762689617-e1cffcef479d", 800),
    alt: "Relaxed denim and premium knit textures",
    credit: "NordWood Themes / Unsplash",
  },
  styleStreetwear: {
    src: U("1509967419530-da38b4704bc6", 800),
    alt: "Dark urban streetwear with technical accents",
    credit: "Mick Haupt / Unsplash",
  },
  styleMinimal: {
    src: U("1485230895905-ec40ba36b9bc", 800),
    alt: "Clean lines and understated monochrome textures",
    credit: "Christian Vierig / Unsplash",
  },
  styleFormal: {
    src: U("1594938298603-c8148c4dae35", 800),
    alt: "Sharp tailored suiting and fine wool texture",
    credit: "David Lezcano / Unsplash",
  },
  styleSporty: {
    src: U("1517838277536-f5f99be501cd", 800),
    alt: "High-performance athletic apparel in motion",
    credit: "Scott Webb / Unsplash",
  },
  styleVintage: {
    src: U("1551232864-3f0890e580d9", 800),
    alt: "Heritage leather and vintage textured outerwear",
    credit: "Clarisse Meyer / Unsplash",
  },

  // Alternating Lookbook Section (3 Looks)
  altLook1: {
    src: U("1487222477894-8943e31ef7b2", 1200),
    alt: "Oversized wool trench with raw denim and leather boots",
    credit: "Cleo Vermij / Unsplash",
  },
  altLook2: {
    src: U("1539571696357-5a69c17a67c6", 1200),
    alt: "Modern tonal layering with tactile knitwear",
    credit: "Seven Shooter / Unsplash",
  },
  altLook3: {
    src: U("1509631179647-0177331693ae", 1200),
    alt: "Sculptural outerwear paired with sleek tailoring",
    credit: "Maxime / Unsplash",
  },

  // Community / Editorial Grid (6 Photos)
  comm1: {
    src: U("1524504388940-b1c1722653e1", 800),
    alt: "Editorial city street style portrait",
    credit: "Christopher Campbell / Unsplash",
  },
  comm2: {
    src: U("1517841905240-472988babdf9", 800),
    alt: "Natural light portrait with textured layering",
    credit: "Valerie Elash / Unsplash",
  },
  comm3: {
    src: U("1506794778202-cad84cf45f1d", 800),
    alt: "Studio portrait in monochrome minimalist suiting",
    credit: "Albert Dera / Unsplash",
  },
  comm4: {
    src: U("1496747611176-843222e1e57c", 800),
    alt: "Outdoor fashion portrait with flowing linen",
    credit: "Yoann Boyer / Unsplash",
  },
  comm5: {
    src: U("1500917293891-ef795e70e1f6", 800),
    alt: "Casual elevated styling in city backdrop",
    credit: "Averie Woodard / Unsplash",
  },
  comm6: {
    src: U("1501196354995-cbb51c65aaea", 800),
    alt: "Contemporary everyday outfit in warm twilight",
    credit: "Brooke Cagle / Unsplash",
  },

  // Quiz Backgrounds (3 Steps)
  quizStep1: {
    src: U("1558769132-cb1aea458c5e", 1400),
    alt: "Tailoring precision and measuring fabric",
    credit: "Sarah Brown / Unsplash",
  },
  quizStep2: {
    src: U("1469334031218-e382a71b716b", 1400),
    alt: "Urban lifestyle and morning routine",
    credit: "Tamara Bellis / Unsplash",
  },
  quizStep3: {
    src: U("1509631179647-0177331693ae", 1400),
    alt: "Personal aesthetic and moodboard curation",
    credit: "Maxime / Unsplash",
  },

  // Quiz 6 Outfit Tiles
  quizDenim: {
    src: U("1516762689617-e1cffcef479d", 800),
    alt: "Relaxed denim + tee styling",
    credit: "NordWood Themes / Unsplash",
  },
  quizTailored: {
    src: U("1594938298603-c8148c4dae35", 800),
    alt: "Tailored monochrome styling",
    credit: "David Lezcano / Unsplash",
  },
  quizStreetwear: {
    src: U("1509967419530-da38b4704bc6", 800),
    alt: "Oversized streetwear layers styling",
    credit: "Mick Haupt / Unsplash",
  },
  quizSporty: {
    src: U("1517838277536-f5f99be501cd", 800),
    alt: "Sporty athleisure styling",
    credit: "Scott Webb / Unsplash",
  },
  quizMinimal: {
    src: U("1485230895905-ec40ba36b9bc", 800),
    alt: "Soft minimalist neutrals styling",
    credit: "Christian Vierig / Unsplash",
  },
  quizSmartCasual: {
    src: U("1507679799987-c73779587ccf", 800),
    alt: "Classic smart casual styling",
    credit: "Hunters Race / Unsplash",
  },

  // Empty States & Placeholders
  emptyWardrobe: {
    src: U("1489987707025-afc232f7ea0f", 1000),
    alt: "Empty clothing rail ready for curation",
    credit: "Ksenia Chernaya / Unsplash",
  },
  emptyOutfits: {
    src: U("1490481651871-ab68de25d43d", 1000),
    alt: "Editorial lookbook silhouette placeholder",
    credit: "Laura Chouette / Unsplash",
  },

  // Testimonial Avatars
  avatar1: {
    src: U("1534528741775-53994a69daeb", 400),
    alt: "Elena R.",
    credit: "Aiony Haust / Unsplash",
  },
  avatar2: {
    src: U("1507003211169-0a1dd7228f2d", 400),
    alt: "Marcus K.",
    credit: "Joseph Gonzalez / Unsplash",
  },
  avatar3: {
    src: U("1517841905240-472988babdf9", 400),
    alt: "Sofia T.",
    credit: "Valerie Elash / Unsplash",
  },
} as const;

export type ImageKey = keyof typeof IMAGES;
