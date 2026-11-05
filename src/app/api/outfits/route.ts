import { NextRequest, NextResponse } from "next/server";
import type { OutfitSuggestion } from "@/lib/types";
import { ownsImagePath } from "@/lib/auth/session";
import { authenticateRequest } from "@/lib/auth/request";

export const dynamic = "force-dynamic";


export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("fm_outfits")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const outfits = await Promise.all((data ?? []).map(async entry => ({ ...entry, data_json: await Promise.all((Array.isArray(entry.data_json) ? entry.data_json : []).map(async (outfit: OutfitSuggestion) => {
    if (!outfit || typeof outfit !== "object") return null;
    const saved = { ...outfit };
    delete saved.imageUrl;
    if (!ownsImagePath(saved.imagePath, user.id)) return saved;
    const signed = await supabase.storage.from("fitmatch-wardrobe").createSignedUrl(saved.imagePath, 3600);
    return { ...saved, imageUrl: signed.data?.signedUrl ?? null };
  })).then(items => items.filter(Boolean)) })));
  return NextResponse.json({ success: true, outfits });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  try {
    const body = await request.json();
    if (!Array.isArray(body.data) || body.data.length < 1 || body.data.length > 5 || body.data.some((o: Record<string, unknown>) => !o || typeof o.name !== "string" || !Array.isArray(o.items) || !Array.isArray(o.accessories) || (o.imagePath && !ownsImagePath(o.imagePath, user.id)))) return NextResponse.json({ success: false, error: "Invalid outfit data" }, { status: 400 });
    if (body.sourceItemId) {
      const source = await supabase.from("fm_wardrobe_items").select("id").eq("id", body.sourceItemId).eq("user_id", user.id).maybeSingle();
      if (source.error || !source.data) return NextResponse.json({ success: false, error: "Source item not found" }, { status: 404 });
    }
    const { data, error } = await supabase
      .from("fm_outfits")
      .insert({
        user_id: user.id,
        source_item_id: body.sourceItemId ?? null,
        data_json: body.data.map((outfit: OutfitSuggestion) => { const saved = { ...outfit }; delete saved.imageUrl; return saved; }),
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, outfit: data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
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
