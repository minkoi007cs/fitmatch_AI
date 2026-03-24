// ============================================================
// OpenAI API Integration
// ============================================================

import {
  ClothingAnalysis,
  OutfitSuggestion,
  StyleProfile,
  StyleCategory,
} from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

async function callOpenAI(
  messages: Array<{ role: string; content: unknown }>,
  model: string = "gpt-4o"
) {
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenAI API error: ${res.status} - ${error}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

export async function analyzeClothingImage(
  imageBase64: string
): Promise<ClothingAnalysis> {
  const systemPrompt = `You are an expert fashion analyst AI. Analyze the clothing item in the provided image and return a JSON object with the following fields:

- type: One of: shirt, t-shirt, hoodie, jacket, sweater, blazer, pants, jeans, shorts, skirt, dress, shoes, sneakers, boots, hat, bag, watch, accessory, other
- primaryColor: The main color (use common color names like "navy blue", "charcoal gray", "cream white")
- secondaryColor: Optional secondary color if present
- pattern: One of: plain, striped, plaid, graphic, floral, polka-dot, abstract, camo, other
- style: One of: casual, streetwear, minimal, formal, sporty, bohemian, preppy, vintage
- material: Estimated material (e.g., "cotton", "denim", "leather", "polyester")
- description: A brief, natural description of the item (1-2 sentences)

Return ONLY valid JSON, no markdown or extra text.`;

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`,
            detail: "high",
          },
        },
        {
          type: "text",
          text: "Analyze this clothing item and return the structured JSON data.",
        },
      ],
    },
  ];

  const response = await callOpenAI(messages, "gpt-4o");

  try {
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as ClothingAnalysis;
  } catch {
    throw new Error("Failed to parse AI analysis response");
  }
}

export async function generateOutfitSuggestions(
  analysis: ClothingAnalysis,
  styleProfile?: StyleProfile,
  vibeOverride?: StyleCategory,
  count: number = 4
): Promise<OutfitSuggestion[]> {
  const profileContext = styleProfile
    ? `
User's Style Profile:
- Primary style: ${styleProfile.primaryStyle}
- Secondary style: ${styleProfile.secondaryStyle || "N/A"}
- Favorite colors: ${styleProfile.favoriteColors.join(", ")}
- Fashion inspirations: ${styleProfile.fashionInspirations?.join(", ") || "N/A"}
`
    : "";

  const vibeContext = vibeOverride
    ? `\nIMPORTANT: Generate outfits specifically in the "${vibeOverride}" style.\n`
    : "";

  const systemPrompt = `You are an expert personal stylist AI with deep knowledge of color theory, fashion trends, and outfit coordination. Generate ${count} complete outfit suggestions based on the provided clothing item.

Rules:
1. Apply color theory: use complementary colors, analogous colors, or neutral balancing
2. Each outfit should be from a DIFFERENT style category (casual, streetwear, minimal, formal)
3. Include accessories for each outfit
4. Provide clear explanations for WHY the colors and styles work together
5. Assign a confidence score (0-100) based on how well the outfit works
6. Be creative but practical

${profileContext}${vibeContext}

Return a JSON array of outfit objects, each with:
{
  "id": "unique-id-string",
  "name": "Creative outfit name",
  "styleCategory": "casual|streetwear|minimal|formal",
  "items": [
    {
      "category": "clothing category",
      "description": "Specific item description",
      "suggestedColor": "color name",
      "notes": "optional styling notes"
    }
  ],
  "accessories": [
    {
      "category": "accessory category",
      "description": "Specific accessory description",
      "suggestedColor": "color name"
    }
  ],
  "colorExplanation": "Why these colors work together (reference color theory)",
  "styleExplanation": "Why this outfit style works and when to wear it",
  "confidenceScore": 85,
  "occasion": "Best occasion for this outfit"
}

Return ONLY valid JSON array, no markdown or extra text.`;

  const userPrompt = `Generate ${count} complete outfit suggestions for this clothing item:
- Type: ${analysis.type}
- Primary Color: ${analysis.primaryColor}
- Secondary Color: ${analysis.secondaryColor || "none"}
- Pattern: ${analysis.pattern}
- Style: ${analysis.style}
- Material: ${analysis.material || "unknown"}
- Description: ${analysis.description}

Create diverse outfits across different styles (casual, streetwear, minimal, formal).`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const response = await callOpenAI(messages);

  try {
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as OutfitSuggestion[];
  } catch {
    throw new Error("Failed to parse AI outfit suggestions");
  }
}

export async function classifyStyleFromQuiz(
  answers: Record<string, unknown>
): Promise<StyleProfile> {
  const systemPrompt = `You are a fashion style analyst. Based on the user's quiz answers, classify their personal style profile.

Return a JSON object:
{
  "primaryStyle": "casual|streetwear|minimal|formal|sporty|bohemian|preppy|vintage",
  "secondaryStyle": "optional secondary style or null",
  "favoriteColors": ["array", "of", "colors"],
  "fashionInspirations": ["array", "of", "style", "inspirations"]
}

Return ONLY valid JSON, no markdown or extra text.`;

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Classify this user's fashion style based on their quiz answers:\n${JSON.stringify(answers, null, 2)}`,
    },
  ];

  const response = await callOpenAI(messages, "gpt-4o-mini");

  try {
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as StyleProfile;
  } catch {
    throw new Error("Failed to parse style classification");
  }
}
