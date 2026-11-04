import "server-only";
import { createAuthorizeRequest } from "@infra/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authConfig, hubEnabled } from "./config";
import { cookieOptions, seal, flowName, FLOW_PREFIX, FLOW_AGE, safeNext } from "./session";

export async function startLogin(request: NextRequest, linkExisting = false) {
  if (!hubEnabled()) return NextResponse.redirect(new URL("/login", request.url), 303);
  try {
    const config = authConfig();
    let legacyUserId: string | undefined;
    if (linkExisting) {
      if (request.headers.get("origin") !== config.appUrl) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
      const { data: { user } } = await (await createClient()).auth.getUser();
      if (!user) return NextResponse.redirect(new URL("/login?legacy=1", config.appUrl), 303);
      legacyUserId = user.id;
    }
    const params = request.nextUrl.searchParams;
    const authorize = await createAuthorizeRequest({ baseUrl: config.hubUrl, clientId: config.publishableKey, redirectUri: `${config.appUrl}/auth/callback` });
    const response = NextResponse.redirect(authorize.url, 303);
    const flows = request.cookies.getAll().filter(cookie => cookie.name.startsWith(FLOW_PREFIX));
    for (const cookie of flows.slice(0, Math.max(0, flows.length - 4))) response.cookies.delete(cookie.name);
    response.cookies.set(flowName(authorize.state)!, seal({ state: authorize.state, codeVerifier: authorize.codeVerifier,
      next: safeNext(params.get("next")), issuedAt: Date.now(), legacyUserId }, config.secretKey, "flow"), cookieOptions(config.appUrl, FLOW_AGE));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return NextResponse.json({ error: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
