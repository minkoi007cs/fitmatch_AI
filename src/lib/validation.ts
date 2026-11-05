import { z } from "zod";
import { CLOTHING_CATEGORIES, PATTERN_TYPES, STYLE_CATEGORIES } from "./types";

const shortText = z.string().trim().min(1).max(160);
const text = z.string().max(4000);
const choices = z.array(shortText).min(1).max(30);
const optionalText = text.nullish().transform(value => value ?? undefined);

export const wardrobeSchema = z.object({
  name: shortText, category: z.enum(CLOTHING_CATEGORIES), color: shortText,
  secondaryColor: text.nullable().optional(), style: z.enum(STYLE_CATEGORIES),
  pattern: z.enum(PATTERN_TYPES).nullable().optional(), material: text.nullable().optional(),
  description: text.nullable().optional(), notes: text.nullable().optional(),
  imagePath: z.string().max(1024).nullable().optional(), isFavorite: z.boolean().optional(),
});
export const wardrobePatchSchema = wardrobeSchema.partial().refine(value => Object.keys(value).length > 0, "No fields to update");

export const analysisSchema = z.object({
  type: z.enum(CLOTHING_CATEGORIES), primaryColor: shortText, secondaryColor: optionalText,
  pattern: z.enum(PATTERN_TYPES), style: z.enum(STYLE_CATEGORIES), material: optionalText,
  description: text.min(1),
});
export const profileSchema = z.object({
  primaryStyle: z.enum(STYLE_CATEGORIES), secondaryStyle: z.enum(STYLE_CATEGORIES).nullable().optional(),
  favoriteColors: choices, fashionInspirations: z.array(shortText).max(30).optional(),
  ageRange: shortText.optional(), genderExpression: shortText.optional(),
  preferredOutfits: z.array(shortText).max(30).optional(),
  bodyShape: shortText.optional(), heightRange: shortText.optional(), lifestyle: shortText.optional(), shoppingGoal: shortText.optional(), fitPriorities: z.array(shortText).max(30).optional(),
});
export const quizSchema = z.object({
  ageRange: shortText, genderExpression: shortText.optional(), bodyShape: shortText.optional(),
  heightRange: shortText.optional(), fitPriorities: choices.optional(), lifestyle: shortText.optional(),
  shoppingGoal: shortText.optional(), favoriteColors: choices, preferredOutfits: choices,
  fashionInspirations: choices,
});
export const profileUpdateSchema = z.object({ quizAnswers: quizSchema.optional(), styleProfile: profileSchema.optional() })
  .refine(value => value.quizAnswers !== undefined || value.styleProfile !== undefined, "Missing profile data");

/** Older partial quizzes may have missing or invalid fields; keep only usable answers. */
export function savedQuizAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const entries = Object.entries(quizSchema.shape).flatMap(([key, schema]) => {
    const parsed = schema.safeParse(source[key]);
    return parsed.success && parsed.data !== undefined ? [[key, parsed.data]] : [];
  });
  return entries.length ? Object.fromEntries(entries) : null;
}

const partSchema = z.object({ category: shortText, description: text.min(1), suggestedColor: shortText, notes: optionalText });
export const outfitSchema = z.object({
  id: shortText, name: shortText, styleCategory: z.enum(STYLE_CATEGORIES),
  items: z.array(partSchema).min(2).max(20), accessories: z.array(partSchema).max(15),
  colorExplanation: text, styleExplanation: text, confidenceScore: z.number().finite().min(0).max(100),
  occasion: optionalText, imagePath: z.string().min(1).max(1024).optional(),
});
export const saveOutfitSchema = z.object({ sourceItemId: z.string().uuid().nullable().optional(), data: z.array(outfitSchema).min(1).max(5) });
export const generateSchema = z.object({ analysis: analysisSchema, styleProfile: profileSchema.optional(), vibeOverride: z.enum(STYLE_CATEGORIES).optional(), count: z.number().int().min(3).max(5).optional() });
export const imagePromptSchema = z.object({ outfitName: shortText.optional(), styleCategory: z.enum(STYLE_CATEGORIES).optional(), occasion: optionalText, colorExplanation: text.optional(), items: z.array(partSchema).min(2).max(20), accessories: z.array(partSchema).max(15).optional() });
export const analyzeSchema = z.object({ imageBase64: z.string().min(4).max(4_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/), persist: z.boolean().optional(), storagePath: z.string().min(1).max(1024).optional() });
export const recommendationSchema = z.object({
  headline: shortText, summary: text, flatteringFocus: choices, avoidNotes: z.array(shortText).max(30),
  outfits: z.array(z.object({ name: shortText, occasion: shortText, whyItFitsYou: text, pieces: choices })).min(1).max(5),
});

/** Only supplied fields enter PATCH: omitted and explicit null have distinct meanings. */
export function wardrobeUpdate(body: z.infer<typeof wardrobePatchSchema>) {
  const names = { name: "name", category: "category", color: "color", secondaryColor: "secondary_color", style: "style", pattern: "pattern", material: "material", description: "description", notes: "notes", imagePath: "image_path", isFavorite: "is_favorite" } as const;
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined).map(([key, value]) => [names[key as keyof typeof names], value]));
}

export class InputError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function readBytes(request: Request, limit: number): Promise<Buffer> {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); throw new InputError(413, "Request body too large"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  return Buffer.concat(chunks);
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>, limit = 100_000): Promise<T> {
  const bytes = await readBytes(request, limit);
  let body: unknown;
  try { body = JSON.parse(bytes.toString("utf8")); }
  catch { throw new InputError(400, "Invalid JSON body"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new InputError(400, "Invalid request data");
  return parsed.data;
}

export function requestError(error: unknown): Response {
  if (error instanceof InputError) return Response.json({ success: false, error: error.message }, { status: error.status });
  console.error("Request failed", error);
  return Response.json({ success: false, error: "The request could not be completed. Please retry." }, { status: 500 });
}
