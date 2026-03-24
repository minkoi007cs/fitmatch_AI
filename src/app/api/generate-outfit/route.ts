import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOutfitSuggestions } from "@/lib/openai";
import { GenerateOutfitRequest, StyleProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateOutfitRequest;
    if (!body.analysis) {
      return NextResponse.json({ success: false, error: "Missing analysis payload" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let styleProfile = body.styleProfile as StyleProfile | undefined;
    if (user && !styleProfile) {
      const { data } = await supabase
        .from("users")
        .select("style_profile")
        .eq("id", user.id)
        .single();

      styleProfile = (data?.style_profile as StyleProfile | undefined) ?? undefined;
    }

    const outfits = await generateOutfitSuggestions(body.analysis, styleProfile, body.vibeOverride, body.count ?? 4);
    return NextResponse.json({ success: true, outfits });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
