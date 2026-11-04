import { NextRequest, NextResponse } from "next/server";
import { analyzeClothingImage } from "@/lib/openai";
import { authenticateRequest } from "@/lib/auth/request";
import { AnalyzeImageRequest } from "@/lib/types";
import { ownsImagePath } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return auth.response;
    const { supabase, user } = auth;


    const body = (await request.json()) as AnalyzeImageRequest;
    if (body.storagePath && !ownsImagePath(body.storagePath, user.id)) return NextResponse.json({ success: false, error: "Invalid image owner" }, { status: 400 });

    if (!body.imageBase64) {
      return NextResponse.json({ success: false, error: "Missing imageBase64" }, { status: 400 });
    }

    const analysis = await analyzeClothingImage(body.imageBase64);
    let uploadedItemId: string | null = null;

    if (body.persist && body.storagePath) {
      const { data, error } = await supabase
        .from("fm_uploaded_items")
        .insert({
          user_id: user.id,
          image_path: body.storagePath,
          detected_type: analysis.type,
          detected_color: analysis.primaryColor,
          detected_style: analysis.style,
          detected_pattern: analysis.pattern,
          metadata_json: analysis,
        })
        .select("id")
        .single();

      if (!error) {
        uploadedItemId = data.id;
      }
    }

    return NextResponse.json({ success: true, analysis, uploadedItemId });
  } catch (error) {
    console.error("Error in analyze-image route:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
