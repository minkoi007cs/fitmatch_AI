import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hubEnabled, authConfig } from "./config";
import { AuthFailure, verifiedHubSession } from "./hub";

/** Both providers use user-scoped Supabase clients: row-level security stays enabled. */
export async function authenticateRequest(request?: Request) {
  try {
    if (request && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const expected = hubEnabled() ? authConfig().appUrl : new URL(request.url).origin;
      if (request.headers.get("origin") !== expected) throw new AuthFailure(403, "INVALID_ORIGIN");
    }
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error && ![400, 401, 403].includes(error.status ?? 0)) throw new AuthFailure(503, "AUTH_UNAVAILABLE");
    if (!user) throw new AuthFailure(401, "SIGN_IN_REQUIRED");
    if (hubEnabled()) {
      const hub = await verifiedHubSession();
      if (hub.session.localUserId !== user.id) throw new AuthFailure(401, "SESSION_MISMATCH");
      return { ok: true as const, supabase, user: { ...user, email: hub.identity.user.email ?? undefined } };
    }
    return { ok: true as const, supabase, user };
  } catch (error) {
    const status = error instanceof AuthFailure ? error.status : 503;
    const code = error instanceof AuthFailure ? error.code : "AUTH_UNAVAILABLE";
    return { ok: false as const, response: NextResponse.json({ success: false, error: code }, { status, headers: { "Cache-Control": "no-store" } }) };
  }
}
