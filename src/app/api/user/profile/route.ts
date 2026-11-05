import { reserveAi } from "@/lib/ai-quota";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/request";
import { classifyStyleFromQuiz, generatePersonalStyleRecommendations } from "@/lib/openai";
import { readJson, requestError, profileUpdateSchema, recommendationSchema, profileSchema, savedQuizAnswers } from "@/lib/validation";

export const dynamic = "force-dynamic";


export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("fm_users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    profile: profileSchema.safeParse(data?.style_profile).data ?? null,
    quizAnswers: savedQuizAnswers(data?.quiz_answers),
    recommendations: recommendationSchema.safeParse(data?.style_profile?.recommendations).data ?? null,
    email: user.email,
  });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  try {
    const body = await readJson(request, profileUpdateSchema);
    if (body.quizAnswers) {
      const quota = await reserveAi(user.id, body.styleProfile ? 1 : 2);
      if (quota) return quota;
    }
    const styleProfile = body.styleProfile ?? (body.quizAnswers ? await classifyStyleFromQuiz(body.quizAnswers) : undefined);
    const recommendations = body.quizAnswers && styleProfile ? await generatePersonalStyleRecommendations(body.quizAnswers, styleProfile) : null;
    // Store recommendations with the exact profile generation in the existing JSON column.
    const payload = {
      id: user.id,
      email: user.email,
      ...(styleProfile !== undefined ? { style_profile: { ...styleProfile, ...(body.quizAnswers ? { bodyShape: body.quizAnswers.bodyShape, heightRange: body.quizAnswers.heightRange, fitPriorities: body.quizAnswers.fitPriorities, lifestyle: body.quizAnswers.lifestyle, shoppingGoal: body.quizAnswers.shoppingGoal } : {}), recommendations } } : {}),
      ...(body.quizAnswers !== undefined ? { quiz_answers: body.quizAnswers } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("fm_users").upsert(payload).select("*").single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: data.style_profile,
      quizAnswers: data.quiz_answers,
      recommendations,
    });
  } catch (error) { return requestError(error); }
}
