import sharp from "sharp";
import { InputError, readBytes, requestError } from "@/lib/validation";
import { reserveAi } from "@/lib/ai-quota";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { analyzeClothingImage } from "@/lib/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth/request";
import { WARDROBE_BUCKET } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let pendingPath: string | null = null;
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return auth.response;
    const { supabase, user } = auth;


    const bytes = await readBytes(request, 4_300_000);
    const formData = await new Request(request.url, { method: "POST", headers: request.headers, body: new Uint8Array(bytes) }).formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Missing file upload" }, { status: 400 });
    }

    // B4 Server-side file validations: Max 10MB & Image MIME
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Only image files (JPEG, PNG, WEBP) are allowed." },
        { status: 400 }
      );
    }

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum compressed upload size is 4MB." },
        { status: 400 }
      );
    }

    let normalized: Buffer;
    try {
      const input = Buffer.from(await file.arrayBuffer());
      const image = sharp(input, { limitInputPixels: 24_000_000, failOn: "error" });
      const metadata = await image.metadata();
      const format = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[file.type];
      if (metadata.format !== format || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image");
      normalized = await image.rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    } catch { throw new InputError(400, "Invalid or oversized image. Please use a JPEG, PNG or WEBP photo."); }

    const quota = await reserveAi(user.id, 1);
    if (quota) return quota;

    const fileName = `${randomUUID()}.jpg`;
    const storagePath = `${user.id}/${fileName}`;
    const admin = createAdminClient();

    const { error: uploadError } = await admin.storage.from(WARDROBE_BUCKET).upload(storagePath, normalized, {
      cacheControl: "3600",
      upsert: false,
      contentType: "image/jpeg",
    });

    if (uploadError) {
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
    }

    pendingPath = storagePath;
    const analysis = await analyzeClothingImage(normalized.toString("base64"));

    const { data: inserted, error: insertError } = await supabase
      .from("fm_uploaded_items")
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

    if (insertError) throw new Error("Could not save uploaded item. Please retry.");
    pendingPath = null;

    const { data: signed } = await admin.storage.from(WARDROBE_BUCKET).createSignedUrl(storagePath, 60 * 60);

    return NextResponse.json({
      success: true,
      storagePath,
      uploadedItemId: inserted.id,
      signedUrl: signed?.signedUrl ?? null,
      analysis,
    });
  } catch (error) {
    if (pendingPath) {
      try { await createAdminClient().storage.from(WARDROBE_BUCKET).remove([pendingPath]); }
      catch (cleanupError) { console.error("Upload cleanup failed", cleanupError); }
    }
    return requestError(error);
  }
}
