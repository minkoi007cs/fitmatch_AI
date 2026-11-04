import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/request";
import { hubEnabled } from "@/lib/auth/config";

export async function GET() {
  const auth = await authenticateRequest();
  if (!auth.ok) {
    if (auth.response.status === 401) return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
    return auth.response;
  }
  return NextResponse.json({ user: { id: auth.user.id, email: auth.user.email }, provider: hubEnabled() ? "app-system" : "supabase" }, { headers: { "Cache-Control": "no-store" } });
}
