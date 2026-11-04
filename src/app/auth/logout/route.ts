import { NextRequest, NextResponse } from "next/server";
import { createServerClient, memoryStorage } from "@infra/sdk";
import { createClient } from "@/lib/supabase/server";
import { authConfig, hubEnabled } from "@/lib/auth/config";
import { decodeSession, FLOW_PREFIX, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const config = hubEnabled() ? authConfig() : null;
  if (request.headers.get("origin") !== (config?.appUrl ?? request.nextUrl.origin)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  let revocationFailed = false;
  if (config) {
    const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value, config.secretKey);
    if (session) {
      try {
        const client = createServerClient({ baseUrl: config.hubUrl, apiKey: config.secretKey, storage: memoryStorage(session.pair) });
        const revoked = await client.signOut();
        revocationFailed = revoked.error !== null;
      } catch { revocationFailed = true; }
    }
  }
  const signedOut = await (await createClient()).auth.signOut({ scope: "local" });
  const response = NextResponse.json({ success: !signedOut.error, revocationPending: revocationFailed }, { status: signedOut.error ? 503 : 200 });
  response.cookies.delete(SESSION_COOKIE);
  for (const cookie of request.cookies.getAll()) if (cookie.name.startsWith(FLOW_PREFIX)) response.cookies.delete(cookie.name);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
