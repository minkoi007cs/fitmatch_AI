import { NextResponse } from "next/server";
import { generateOutfitImage } from "@/lib/openai";
import { authenticateRequest } from "@/lib/auth/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { WARDROBE_BUCKET } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Authenticate user (Cost & abuse protection - A2)
    const auth = await authenticateRequest(request);
    if (!auth.ok) return auth.response;
    const { user } = auth;


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

    // 2. Persist generated look to Supabase Storage (A4)
    let storagePath: string | null = null;
    let signedUrl: string | null = null;

    try {
      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `lookbook-${Date.now()}.png`;
      storagePath = `${user.id}/looks/${fileName}`;

      const admin = createAdminClient();
      const { error: uploadError } = await admin.storage
        .from(WARDROBE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (!uploadError) {
        const { data: signed } = await admin.storage
          .from(WARDROBE_BUCKET)
          .createSignedUrl(storagePath, 60 * 60 * 24); // 24-hour signed url
        signedUrl = signed?.signedUrl ?? null;
      }
    } catch (storageErr) {
      console.warn("Lookbook storage persistence notice:", storageErr);
    }

    return NextResponse.json({
      success: true,
      imageDataUrl,
      storagePath,
      signedUrl: signedUrl ?? imageDataUrl,
    });
  } catch (error) {
    console.error("Error in generate-outfit-image route:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Could not generate image" },
      { status: 500 }
    );
  }
}
