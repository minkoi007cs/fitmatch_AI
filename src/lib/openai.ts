import {
  ClothingAnalysis,
  OutfitSuggestion,
  QuizAnswers,
  StyleCategory,
  StyleProfile,
} from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini";
const DEFAULT_VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";

type SchemaDefinition = Record<string, unknown>;

async function fetchStructuredObject<T>({
  messages,
  schema,
  schemaName,
  model,
  temperature = 0.4,
}: {
  messages: Array<{ role: "system" | "user"; content: unknown }>;
  schema: SchemaDefinition;
  schemaName: string;
  model: string;
  temperature?: number;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI response did not contain structured JSON content");
  }

  return JSON.parse(content) as T;
}

const clothingAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { type: "string" },
    primaryColor: { type: "string" },
    secondaryColor: { type: ["string", "null"] },
    pattern: { type: "string" },
    style: { type: "string" },
    material: { type: ["string", "null"] },
    description: { type: "string" },
  },
  required: ["type", "primaryColor", "secondaryColor", "pattern", "style", "material", "description"],
} satisfies SchemaDefinition;

const outfitSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    outfits: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          styleCategory: { type: "string" },
          occasion: { type: ["string", "null"] },
          confidenceScore: { type: "number" },
          colorExplanation: { type: "string" },
          styleExplanation: { type: "string" },
          items: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                category: { type: "string" },
                description: { type: "string" },
                suggestedColor: { type: "string" },
                notes: { type: ["string", "null"] },
              },
              required: ["category", "description", "suggestedColor", "notes"],
            },
          },
          accessories: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                category: { type: "string" },
                description: { type: "string" },
                suggestedColor: { type: "string" },
                notes: { type: ["string", "null"] },
              },
              required: ["category", "description", "suggestedColor", "notes"],
            },
          },
        },
        required: [
          "id",
          "name",
          "styleCategory",
          "occasion",
          "confidenceScore",
          "colorExplanation",
          "styleExplanation",
          "items",
          "accessories",
        ],
      },
    },
  },
  required: ["outfits"],
} satisfies SchemaDefinition;

const styleProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    primaryStyle: { type: "string" },
    secondaryStyle: { type: ["string", "null"] },
    favoriteColors: { type: "array", items: { type: "string" } },
    fashionInspirations: { type: "array", items: { type: "string" } },
    ageRange: { type: ["string", "null"] },
    genderExpression: { type: ["string", "null"] },
    preferredOutfits: { type: "array", items: { type: "string" } },
  },
  required: [
    "primaryStyle",
    "secondaryStyle",
    "favoriteColors",
    "fashionInspirations",
    "ageRange",
    "genderExpression",
    "preferredOutfits",
  ],
} satisfies SchemaDefinition;

function normalizeStyleCategory(style: string): StyleCategory {
  const value = style.toLowerCase() as StyleCategory;
  if (
    value === "casual" ||
    value === "streetwear" ||
    value === "minimal" ||
    value === "formal" ||
    value === "sporty" ||
    value === "bohemian" ||
    value === "preppy" ||
    value === "vintage"
  ) {
    return value;
  }
  return "casual";
}

function fallbackAnalysis(): ClothingAnalysis {
  return {
    type: "other",
    primaryColor: "black",
    secondaryColor: "white",
    pattern: "plain",
    style: "casual",
    material: "unknown",
    description: "A versatile wardrobe piece suitable for casual styling.",
  };
}

export async function analyzeClothingImage(imageBase64: string): Promise<ClothingAnalysis> {
  try {
    const analysis = await fetchStructuredObject<ClothingAnalysis>({
      model: DEFAULT_VISION_MODEL,
      schemaName: "clothing_analysis",
      schema: clothingAnalysisSchema,
      messages: [
        {
          role: "system",
          content:
            "You are a fashion analyst. Identify the clothing item, visible colors, pattern, likely style, likely material, and a concise natural-language description. Stay grounded in what is visible.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this single clothing item for an AI wardrobe app. Return a structured result.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    return {
      ...analysis,
      secondaryColor: analysis.secondaryColor || undefined,
      material: analysis.material || undefined,
      style: normalizeStyleCategory(analysis.style),
    };
  } catch {
    return fallbackAnalysis();
  }
}

function fallbackOutfits(
  analysis: ClothingAnalysis,
  styleProfile?: StyleProfile,
  count = 4
): OutfitSuggestion[] {
  const styles: StyleCategory[] = ["casual", "streetwear", "minimal", "formal"];

  return styles.slice(0, count).map((style, index) => ({
    id: `${style}-${index + 1}`,
    name: `${styleProfile?.primaryStyle ?? style} look ${index + 1}`,
    styleCategory: style,
    occasion:
      style === "formal" ? "Dinner date or office event" : style === "streetwear" ? "Weekend city day" : "Everyday wear",
    confidenceScore: 82 - index * 3,
    items: [
      {
        category: analysis.type,
        description: analysis.description,
        suggestedColor: analysis.primaryColor,
        notes: "Use the uploaded piece as the anchor item.",
      },
      {
        category: style === "formal" ? "pants" : "jeans",
        description: style === "formal" ? "Tailored trousers" : "Relaxed straight-leg bottoms",
        suggestedColor: style === "streetwear" ? "washed charcoal" : "soft stone",
        notes: "Balance the anchor item with a neutral base.",
      },
      {
        category: "shoes",
        description: style === "formal" ? "Leather loafers" : "Clean minimalist sneakers",
        suggestedColor: style === "streetwear" ? "black" : "white",
        notes: "Keep the silhouette clean and grounded.",
      },
    ],
    accessories: [
      {
        category: "watch",
        description: "Simple metal watch",
        suggestedColor: "silver",
        notes: "Adds polish without competing with the outfit.",
      },
      {
        category: "bag",
        description: style === "streetwear" ? "Crossbody utility bag" : "Structured tote",
        suggestedColor: "black",
        notes: "Supports the outfit's overall vibe.",
      },
    ],
    colorExplanation:
      "The outfit pairs the anchor piece with neutral balancing colors so the palette feels intentional and easy to wear.",
    styleExplanation:
      "The look keeps a consistent silhouette and accessory language so the outfit feels coherent instead of mixed at random.",
  }));
}

export async function generateOutfitSuggestions(
  analysis: ClothingAnalysis,
  styleProfile?: StyleProfile,
  vibeOverride?: StyleCategory,
  count = 4
): Promise<OutfitSuggestion[]> {
  try {
    const styleInstruction = vibeOverride
      ? `Lean the overall direction toward ${vibeOverride}, while still keeping the results diverse and practical.`
      : "Cover casual, streetwear, minimal, and formal directions with clearly distinct results.";

    const result = await fetchStructuredObject<{ outfits: OutfitSuggestion[] }>({
      model: DEFAULT_TEXT_MODEL,
      schemaName: "outfit_suggestions",
      schema: outfitSchema,
      messages: [
        {
          role: "system",
          content:
            "You are an expert personal stylist. Generate production-quality outfit suggestions that obey color theory, use neutral balance or complementary relationships, and explain why the styling works. Every result must feel wearable, coherent, and distinct.",
        },
        {
          role: "user",
          content: [
            `Anchor clothing item: ${analysis.description}`,
            `Type: ${analysis.type}`,
            `Primary color: ${analysis.primaryColor}`,
            `Secondary color: ${analysis.secondaryColor ?? "none"}`,
            `Pattern: ${analysis.pattern}`,
            `Detected style: ${analysis.style}`,
            `Material: ${analysis.material ?? "unknown"}`,
            styleProfile
              ? `User profile: primary=${styleProfile.primaryStyle}, secondary=${styleProfile.secondaryStyle ?? "none"}, favorite colors=${styleProfile.favoriteColors.join(
                  ", "
                )}, inspirations=${styleProfile.fashionInspirations?.join(", ") ?? "none"}`
              : "No style profile available.",
            styleInstruction,
            `Generate ${Math.min(Math.max(count, 3), 5)} complete outfits.`,
          ].join("\n"),
        },
      ],
    });

    return result.outfits.map((outfit) => ({
      ...outfit,
      styleCategory: normalizeStyleCategory(outfit.styleCategory),
      confidenceScore: Math.max(1, Math.min(100, Math.round(outfit.confidenceScore))),
    }));
  } catch {
    return fallbackOutfits(analysis, styleProfile, count);
  }
}

function scoreStyle(answers: QuizAnswers): StyleCategory {
  const joined = [
    answers.ageRange,
    answers.genderExpression ?? "",
    ...answers.favoriteColors,
    ...answers.preferredOutfits,
    ...answers.fashionInspirations,
  ]
    .join(" ")
    .toLowerCase();

  if (joined.includes("street")) return "streetwear";
  if (joined.includes("tailored") || joined.includes("classic")) return "formal";
  if (joined.includes("neutral") || joined.includes("clean")) return "minimal";
  if (joined.includes("sport") || joined.includes("comfort")) return "sporty";
  return "casual";
}

export async function classifyStyleFromQuiz(answers: QuizAnswers): Promise<StyleProfile> {
  try {
    const profile = await fetchStructuredObject<StyleProfile>({
      model: DEFAULT_TEXT_MODEL,
      schemaName: "style_profile",
      schema: styleProfileSchema,
      messages: [
        {
          role: "system",
          content:
            "You are a fashion stylist. Classify a user's core style identity using the quiz answers. Keep favoriteColors and inspirations grounded in the answers and return an actionable profile.",
        },
        {
          role: "user",
          content: JSON.stringify(answers),
        },
      ],
    });

    return {
      ...profile,
      primaryStyle: normalizeStyleCategory(profile.primaryStyle),
      secondaryStyle: profile.secondaryStyle ? normalizeStyleCategory(profile.secondaryStyle) : null,
      ageRange: profile.ageRange ?? answers.ageRange,
      genderExpression: profile.genderExpression ?? answers.genderExpression,
      preferredOutfits: profile.preferredOutfits?.length ? profile.preferredOutfits : answers.preferredOutfits,
    };
  } catch {
    return {
      primaryStyle: scoreStyle(answers),
      secondaryStyle: "minimal",
      favoriteColors: answers.favoriteColors,
      fashionInspirations: answers.fashionInspirations,
      ageRange: answers.ageRange,
      genderExpression: answers.genderExpression,
      preferredOutfits: answers.preferredOutfits,
    };
  }
}
