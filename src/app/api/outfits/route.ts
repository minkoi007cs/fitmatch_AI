import { NextRequest, NextResponse } from "next/server";
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

  return NextResponse.json({ success: true, outfits: data });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  try {
    const body = await request.json();
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
