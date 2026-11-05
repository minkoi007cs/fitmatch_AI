import { reserveAi } from "@/lib/ai-quota";
import { randomUUID } from "node:crypto";
import { readJson, requestError, imagePromptSchema } from "@/lib/validation";
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


    const body = await readJson(request, imagePromptSchema);

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

    const quota = await reserveAi(user.id, 5);
    if (quota) return quota;

    const imageDataUrl = await generateOutfitImage(prompt);

    // 2. Persist generated look to Supabase Storage (A4)
    let storagePath: string | null = null;
    let signedUrl: string | null = null;

    try {
      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `lookbook-${randomUUID()}.png`;
      storagePath = `${user.id}/looks/${fileName}`;

      const admin = createAdminClient();
      const { error: uploadError } = await admin.storage
        .from(WARDROBE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) throw uploadError;
      if (!uploadError) {
        const { data: signed } = await admin.storage
          .from(WARDROBE_BUCKET)
          .createSignedUrl(storagePath, 60 * 60 * 24); // 24-hour signed url
        signedUrl = signed?.signedUrl ?? null;
      }
    } catch (storageErr) {
      console.error("Lookbook storage persistence failed:", storageErr);
      return NextResponse.json({ success: false, error: "The image could not be saved. Please retry later." }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      storagePath,
      signedUrl,
      urlPending: !signedUrl,
    });
  } catch (error) { return requestError(error); }
}
