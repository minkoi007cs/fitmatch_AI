import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Daily cost units, not a dollar budget. Failed/ambiguous provider calls remain charged. */
export async function reserveAi(userId: string, units: number): Promise<Response | null> {
  const raw = process.env.FITMATCH_AI_DAILY_UNITS ?? "50";
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100_000) return Response.json({ success: false, error: "AI quota configuration unavailable" }, { status: 503 });
  try {
    const result = await createAdminClient().rpc("fm_consume_ai_units", { p_user_id: userId, p_units: units, p_limit: limit });
    if (result.error || typeof result.data !== "boolean") throw new Error("QUOTA_STORE_UNAVAILABLE");
    if (result.data) return null;
    const now = new Date();
    const retry = Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000);
    return Response.json({ success: false, error: "Daily AI limit reached. Please try again tomorrow." }, { status: 429, headers: { "Retry-After": String(retry), "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("AI quota unavailable", error);
    return Response.json({ success: false, error: "AI is temporarily unavailable. Please retry later." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
