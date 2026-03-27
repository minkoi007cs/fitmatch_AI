import { NextResponse } from "next/server";
import { generateOutfitImage } from "@/lib/openai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      outfitName?: string;
      styleCategory?: string;
      occasion?: string;
      colorExplanation?: string;
      items?: Array<{ description: string; suggestedColor: string; category: string }>;
      accessories?: Array<{ description: string; suggestedColor: string; category: string }>;
    };

    if (!body.items?.length) {
      return NextResponse.json({ success: false, error: "Missing outfit items" }, { status: 400 });
    }

    const prompt = [
      "Create a polished editorial fashion lookbook image of a single outfit on a realistic model.",
      `Outfit name: ${body.outfitName ?? "Styled outfit"}.`,
      `Style: ${body.styleCategory ?? "casual"}.`,
      `Occasion: ${body.occasion ?? "everyday wear"}.`,
      `Main outfit pieces: ${body.items.map((item) => `${item.description} in ${item.suggestedColor}`).join("; ")}.`,
      body.accessories?.length
        ? `Accessories: ${body.accessories.map((item) => `${item.description} in ${item.suggestedColor}`).join("; ")}.`
        : "Accessories: keep minimal and cohesive.",
      body.colorExplanation ? `Color direction: ${body.colorExplanation}.` : "",
      "The image should be full-body, clean background, premium e-commerce/editorial style, realistic fabric textures, no text, no collage.",
    ]
      .filter(Boolean)
      .join(" ");

    const imageDataUrl = await generateOutfitImage(prompt);
    return NextResponse.json({ success: true, imageDataUrl });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Could not generate image" },
      { status: 500 }
    );
  }
}
