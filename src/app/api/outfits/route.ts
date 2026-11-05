import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJson, requestError, saveOutfitSchema, outfitSchema } from "@/lib/validation";
import { ownsImagePath } from "@/lib/auth/session";
import { authenticateRequest } from "@/lib/auth/request";

export const dynamic = "force-dynamic";


export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  let cursor: { createdAt: string; id: string } | null = null;
  const encoded = new URL(request.url).searchParams.get("cursor");
  if (encoded) {
    try {
      cursor = z.object({ createdAt: z.iso.datetime({ offset: true }), id: z.string().uuid() }).parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    } catch { return NextResponse.json({ success: false, error: "Invalid archive cursor" }, { status: 400 }); }
  }
  let query = supabase
    .from("fm_outfits")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(21);
  if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const page = (data ?? []).slice(0, 20);
  let invalidCount = 0;
  const outfits = await Promise.all(page.map(async entry => {
    const valid = [];
    for (const value of Array.isArray(entry.data_json) ? entry.data_json : []) {
      const parsed = outfitSchema.safeParse(value);
      if (!parsed.success) { invalidCount++; continue; }
      const outfit = parsed.data;
      const { imagePath, ...rest } = outfit;
      if (!ownsImagePath(imagePath, user.id)) { valid.push(rest); continue; }
      const signed = await supabase.storage.from("fitmatch-wardrobe").createSignedUrl(imagePath, 3600);
      valid.push({ ...rest, imagePath, imageUrl: signed.data?.signedUrl ?? null });
    }
    return { ...entry, data_json: valid };
  }));
  const last = page.at(-1);
  const nextCursor = (data ?? []).length > 20 && last
    ? Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id })).toString("base64url") : null;
  return NextResponse.json({ success: true, outfits: outfits.filter(entry => entry.data_json.length > 0), nextCursor, invalidCount });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  try {
    const body = await readJson(request, saveOutfitSchema);
    if (body.data.some(outfit => outfit.imagePath && !ownsImagePath(outfit.imagePath, user.id))) return NextResponse.json({ success: false, error: "Invalid image owner" }, { status: 400 });
    if (body.sourceItemId) {
      const source = await supabase.from("fm_wardrobe_items").select("id").eq("id", body.sourceItemId).eq("user_id", user.id).maybeSingle();
      if (source.error || !source.data) return NextResponse.json({ success: false, error: "Source item not found" }, { status: 404 });
    }
    const { data, error } = await supabase
      .from("fm_outfits")
      .insert({
        user_id: user.id,
        source_item_id: body.sourceItemId ?? null,
        data_json: body.data,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, outfit: data });
  } catch (error) { return requestError(error); }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing outfit id parameter" }, { status: 400 });
    }

    const { error } = await supabase
      .from("fm_outfits")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete outfit" },
      { status: 500 }
    );
  }
}
