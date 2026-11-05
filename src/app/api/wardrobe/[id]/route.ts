import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/request";
import type { createClient } from "@/lib/supabase/server";
import { WardrobeItemRecord } from "@/lib/types";
import { readJson, requestError, wardrobePatchSchema, wardrobeUpdate } from "@/lib/validation";
import { ownsImagePath } from "@/lib/auth/session";

export const dynamic = "force-dynamic";


async function signImageUrl(supabase: Awaited<ReturnType<typeof createClient>>, imagePath?: string | null) {
  if (!imagePath) return null;
  const { data } = await supabase.storage.from("fitmatch-wardrobe").createSignedUrl(imagePath, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/wardrobe/[id]">) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  try {
  const { id } = await context.params;
  const body = await readJson(request, wardrobePatchSchema);
  if (body.imagePath && !ownsImagePath(body.imagePath, user.id)) return NextResponse.json({ success: false, error: "Invalid image owner" }, { status: 400 });
  const updatePayload = { ...wardrobeUpdate(body), updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from("fm_wardrobe_items")
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
  } catch (error) { return requestError(error); }
}

export async function DELETE(request: NextRequest, context: RouteContext<"/api/wardrobe/[id]">) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const { id } = await context.params;
  const { error } = await supabase.from("fm_wardrobe_items").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // An owned object may be shared by other wardrobe or archived outfit records.
  // Retain the private asset until a reference-aware collector is deployed.
  return NextResponse.json({ success: true });
}

