import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WardrobeItemRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

async function signImageUrl(supabase: Awaited<ReturnType<typeof createClient>>, imagePath?: string | null) {
  if (!imagePath) return null;
  const { data } = await supabase.storage.from("fitmatch-wardrobe").createSignedUrl(imagePath, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const category = request.nextUrl.searchParams.get("category");
  const color = request.nextUrl.searchParams.get("color");
  const style = request.nextUrl.searchParams.get("style");

  let query = supabase
    .from("fm_wardrobe_items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);
  if (color) query = query.ilike("color", `%${color}%`);
  if (style) query = query.eq("style", style);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const items = await Promise.all(
    (data as WardrobeItemRecord[]).map(async (item) => ({
      ...item,
      imageUrl: item.image_path ? await signImageUrl(supabase, item.image_path) : item.image_url ?? null,
    }))
  );

  return NextResponse.json({ success: true, items });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = {
      user_id: user.id,
      name: body.name,
      category: body.category,
      color: body.color,
      secondary_color: body.secondaryColor ?? null,
      style: body.style,
      pattern: body.pattern ?? null,
      material: body.material ?? null,
      description: body.description ?? null,
      notes: body.notes ?? null,
      image_path: body.imagePath ?? null,
      image_url: null,
      is_favorite: body.isFavorite ?? false,
    };

    const { data, error } = await supabase.from("fm_wardrobe_items").insert(payload).select("*").single();
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const item = {
      ...(data as WardrobeItemRecord),
      imageUrl: data.image_path ? await signImageUrl(supabase, data.image_path) : null,
    };

    return NextResponse.json({ success: true, item });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
