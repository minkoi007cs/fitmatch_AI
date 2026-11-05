import { reserveAi } from "@/lib/ai-quota";
import { readJson, requestError, generateSchema, profileSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/request";
import { generateOutfitSuggestions } from "@/lib/openai";
import { StyleProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return auth.response;
    const { supabase, user } = auth;
    const body = await readJson(request, generateSchema);
    if (!body.analysis) {
      return NextResponse.json({ success: false, error: "Missing analysis payload" }, { status: 400 });
    }

    let styleProfile = body.styleProfile as StyleProfile | undefined;
    if (user && !styleProfile) {
      const { data } = await supabase
        .from("fm_users")
        .select("style_profile")
        .eq("id", user.id)
        .single();

      styleProfile = profileSchema.safeParse(data?.style_profile).data;
    }

    const quota = await reserveAi(user.id, 1);
    if (quota) return quota;

    const outfits = await generateOutfitSuggestions(body.analysis, styleProfile, body.vibeOverride, body.count ?? 4);
    return NextResponse.json({ success: true, outfits });
  } catch (error) { return requestError(error); }
}
