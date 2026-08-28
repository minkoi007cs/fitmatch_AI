import { NextResponse } from "next/server";
import { analyzeClothingImage } from "@/lib/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { WARDROBE_BUCKET } from "@/lib/utils";

export const dynamic = "force-dynamic";

function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Missing file upload" }, { status: 400 });
    }

    // B4 Server-side file validations: Max 10MB & Image MIME
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Only image files (JPEG, PNG, WEBP) are allowed." },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum allowed image size is 10MB." },
        { status: 400 }
      );
    }

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "-")}`;
    const storagePath = `${user.id}/${fileName}`;
    const admin = createAdminClient();

    const { error: uploadError } = await admin.storage.from(WARDROBE_BUCKET).upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

    if (uploadError) {
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
    }

    const buffer = await file.arrayBuffer();
    const analysis = await analyzeClothingImage(toBase64(buffer));

    const { data: inserted, error: insertError } = await supabase
      .from("uploaded_items")
      .insert({
        user_id: user.id,
        image_path: storagePath,
        detected_type: analysis.type,
        detected_color: analysis.primaryColor,
        detected_style: analysis.style,
        detected_pattern: analysis.pattern,
        metadata_json: analysis,
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    const { data: signed } = await admin.storage.from(WARDROBE_BUCKET).createSignedUrl(storagePath, 60 * 60);

    return NextResponse.json({
      success: true,
      storagePath,
      uploadedItemId: inserted.id,
      signedUrl: signed?.signedUrl ?? null,
      analysis,
    });
  } catch (error) {
    console.error("Error in upload-item route:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}
