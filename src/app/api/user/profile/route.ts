import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyStyleFromQuiz, generatePersonalStyleRecommendations } from "@/lib/openai";
import { PersonalStyleRecommendation, QuizAnswers, StyleProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

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
    profile: data?.style_profile ?? null,
    quizAnswers: data?.quiz_answers ?? null,
    email: user.email,
  });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      quizAnswers?: QuizAnswers;
      styleProfile?: StyleProfile;
    };

    const styleProfile = body.styleProfile ?? (body.quizAnswers ? await classifyStyleFromQuiz(body.quizAnswers) : undefined);
    const recommendations: PersonalStyleRecommendation | null =
      body.quizAnswers && styleProfile ? await generatePersonalStyleRecommendations(body.quizAnswers, styleProfile) : null;

    const payload = {
      id: user.id,
      email: user.email,
      style_profile: styleProfile ?? null,
      quiz_answers: body.quizAnswers ?? null,
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
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
