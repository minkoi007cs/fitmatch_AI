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

export async function PATCH(request: NextRequest, context: RouteContext<"/api/wardrobe/[id]">) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const updatePayload: Record<string, unknown> = {
    name: body.name,
    category: body.category,
    color: body.color,
    secondary_color: body.secondaryColor ?? null,
    style: body.style,
    pattern: body.pattern ?? null,
    material: body.material ?? null,
    description: body.description ?? null,
    notes: body.notes ?? null,
    is_favorite: body.isFavorite ?? false,
    updated_at: new Date().toISOString(),
  };

  // A3 Fix: Save image_path when new photo is uploaded during edit
  if (body.imagePath !== undefined) {
    updatePayload.image_path = body.imagePath;
  }

  const { data, error } = await supabase
    .from("wardrobe_items")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const item = {
    ...(data as WardrobeItemRecord),
    imageUrl: await signImageUrl(supabase, data.image_path),
  };

  return NextResponse.json({ success: true, item });
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/wardrobe/[id]">) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { data: existing } = await supabase
    .from("wardrobe_items")
    .select("image_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase.from("wardrobe_items").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (existing?.image_path) {
    await supabase.storage.from("fitmatch-wardrobe").remove([existing.image_path]);
  }

  return NextResponse.json({ success: true });
}
