import { NextRequest, NextResponse } from "next/server";
import { createServerClient, memoryStorage } from "@infra/sdk";
import { createClient } from "@/lib/supabase/server";
import { authConfig, hubEnabled } from "@/lib/auth/config";
import { GET as legacyCallback } from "@/lib/auth/legacy-callback";
import { bridgeSession, localIdentity } from "@/lib/auth/identity";
import { cookieOptions, decodeFlow, flowName, seal, SESSION_AGE, SESSION_COOKIE } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  if (!hubEnabled()) return legacyCallback(request);
  const params = request.nextUrl.searchParams;
  const name = flowName(params.get("state"));
  let client: ReturnType<typeof createServerClient> | undefined;
  let tokensIssued = false;
  try {
    const config = authConfig();
    const flow = decodeFlow(name ? request.cookies.get(name)?.value : undefined, config.secretKey);
    if (!flow || flow.state !== params.get("state")) throw new Error("state");
    if (params.has("error")) throw new Error("denied");
    const code = params.get("code");
    if (!code || code.length > 2048) throw new Error("state");
    const supabase = await createClient();
    if (flow.legacyUserId) {
      const old = await supabase.auth.getUser();
      if (old.error || old.data.user?.id !== flow.legacyUserId) throw new Error("link_expired");
    }
    client = createServerClient({ baseUrl: config.hubUrl, apiKey: config.secretKey, storage: memoryStorage() });
    const exchange = await client.exchangeCode({ code, codeVerifier: flow.codeVerifier, redirectUri: `${config.appUrl}/auth/callback` });
    if (exchange.error) throw new Error("exchange");
    tokensIssued = true;
    const me = await client.me();
    if (me.error || !me.data || me.data.appId !== config.appId) throw new Error("identity");
    const localUserId = await localIdentity(me.data, config.hubUrl, flow.legacyUserId);
    const tokenHash = await bridgeSession(localUserId);
    const bridged = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (bridged.error || bridged.data.user?.id !== localUserId) {
      await supabase.auth.signOut({ scope: "local" });
      throw new Error("bridge");
    }
    const response = NextResponse.redirect(new URL(flow.next, config.appUrl), 303);
    response.cookies.set(SESSION_COOKIE, seal({ pair: exchange.data, localUserId, subject: me.data.user.id,
      appId: config.appId, issuer: config.hubUrl }, config.secretKey, "session"), cookieOptions(config.appUrl, SESSION_AGE));
    if (name) response.cookies.delete(name);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    if (tokensIssued && client) await client.signOut().catch(() => undefined);
    const reason = error instanceof Error && ["state", "denied", "link_expired", "IDENTITY_ALREADY_LINKED"].includes(error.message) ? error.message : "unavailable";
    const url = new URL("/login", process.env.APP_URL?.trim() || request.url);
    url.searchParams.set("error", reason);
    const response = NextResponse.redirect(url, 303);
    if (name) response.cookies.delete(name);
    return response;
  }
}
