import {
  ClothingAnalysis,
  OutfitSuggestion,
  PersonalStyleRecommendation,
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
    throw new Error("Missing OPENAI_API_KEY environment variable. Please configure your OpenAI API key in .env.local.");
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
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
    const errorText = await response.text();
    console.error(`OpenAI API call failed [${response.status}] for ${schemaName}:`, errorText);
    throw new Error("The styling service is unavailable. Please try again later.");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI response did not contain valid structured JSON content.");
  }

  try {
    return JSON.parse(content) as T;
  } catch (parseError) {
    console.error(`Failed to parse structured JSON from OpenAI [${schemaName}]:`, content, parseError);
    throw new Error("Failed to parse OpenAI structured JSON output.");
  }
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

const recommendationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    flatteringFocus: { type: "array", items: { type: "string" } },
    avoidNotes: { type: "array", items: { type: "string" } },
    outfits: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          occasion: { type: "string" },
          whyItFitsYou: { type: "string" },
          pieces: { type: "array", items: { type: "string" } },
        },
        required: ["name", "occasion", "whyItFitsYou", "pieces"],
      },
    },
  },
  required: ["headline", "summary", "flatteringFocus", "avoidNotes", "outfits"],
} satisfies SchemaDefinition;

export function normalizeStyleCategory(style: string): StyleCategory {
  const value = style.toLowerCase().trim() as StyleCategory;
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
  } catch (err) {
    console.error("OpenAI Error in analyzeClothingImage:", err);
    throw err;
  }
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
  } catch (err) {
    console.error("OpenAI Error in generateOutfitSuggestions:", err);
    throw err;
  }
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
  } catch (err) {
    console.error("OpenAI Error in classifyStyleFromQuiz:", err);
    throw err;
  }
}

export async function generatePersonalStyleRecommendations(
  answers: QuizAnswers,
  profile: StyleProfile
): Promise<PersonalStyleRecommendation> {
  try {
    return await fetchStructuredObject<PersonalStyleRecommendation>({
      model: DEFAULT_TEXT_MODEL,
      schemaName: "personal_style_recommendations",
      schema: recommendationSchema,
      messages: [
        {
          role: "system",
          content:
            "You are a personal stylist. Based on quiz answers, explain what styling choices fit this person best and recommend 3 to 4 concrete outfit ideas tailored to them. Be supportive, practical, and personal.",
        },
        {
          role: "user",
          content: JSON.stringify({ answers, profile }),
        },
      ],
    });
  } catch (err) {
    console.error("OpenAI Error in generatePersonalStyleRecommendations:", err);
    throw err;
  }
}

export async function generateOutfitImage(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable. Please configure your OpenAI API key in .env.local.");
  }

  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size: "1024x1024",
      quality: "medium",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI image generation failed [${response.status}]:`, errorText);
    throw new Error("Image generation is unavailable. Please try again later.");
  }

  const data = await response.json();
  const base64 = data.data?.[0]?.b64_json;
  if (typeof base64 !== "string") {
    throw new Error("OpenAI image generation did not return valid base64 image data.");
  }

  return `data:image/png;base64,${base64}`;
}
