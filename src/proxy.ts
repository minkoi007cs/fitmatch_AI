import { NextResponse, type NextRequest } from "next/server";
import { refreshHubToken } from "@/lib/auth/refresh";
import { updateSession } from "@/lib/supabase/middleware";
import { authConfig, hubEnabled } from "@/lib/auth/config";
import { AuthFailure, verifyHubValue } from "@/lib/auth/hub";
import { cookieOptions, decodeSession, seal, SESSION_AGE, SESSION_COOKIE, REFRESH_WINDOW } from "@/lib/auth/session";

const protectedPaths = ["/studio", "/wardrobe", "/outfits", "/profile", "/quiz", "/prepare", "/looks"];

function login(request: NextRequest) {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url, 303);
}

function unavailable() {
  return new NextResponse("Authentication is temporarily unavailable. Your session has been preserved. Please retry.", {
    status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" },
  });
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Machine API verifies its scoped bearer credential in the route, independently of browser sessions.
  if (path.startsWith("/api/v2/worker/")) return NextResponse.next();
  const protectedPage = protectedPaths.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  let sessionValue: string | undefined;
  try {
    if (hubEnabled() && (protectedPage || path.startsWith("/api/"))) {
      const c = authConfig();
      const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value, c.secretKey);
      if (session && session.appId === c.appId && session.issuer === c.hubUrl && session.pair.expiresAt - Date.now() < REFRESH_WINDOW) {
        const outcome = await refreshHubToken(session.pair.refreshToken);
        if (outcome.pair) {
          sessionValue = seal({ ...session, pair: outcome.pair }, c.secretKey, "session");
          request.cookies.set(SESSION_COOKIE, sessionValue);
        } else if (outcome.terminal) {
          request.cookies.delete(SESSION_COOKIE);
          sessionValue = "";
        } else if (session.pair.expiresAt <= Date.now()) return unavailable();
      }
    }
    // Public marketing pages do not depend on Supabase being configured locally.
    const result = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? await updateSession(request) : { response: NextResponse.next(), user: null, error: null };
    const response = result.response;
    if (hubEnabled() && sessionValue !== undefined) {
      if (sessionValue === "") response.cookies.delete(SESSION_COOKIE);
      else response.cookies.set(SESSION_COOKIE, sessionValue, cookieOptions(authConfig().appUrl, SESSION_AGE));
    }
    if (!protectedPage) return response;
    // Verify actual provider identity; a cookie's mere presence never grants access.
    if (result.error && ![400, 401, 403].includes(result.error.status ?? 0)) return unavailable();
    if (hubEnabled()) {
      const hub = await verifyHubValue(request.cookies.get(SESSION_COOKIE)?.value);
      if (hub.session.localUserId !== result.user?.id) throw new AuthFailure(401, "SESSION_MISMATCH");
    }
    if (!result.user) {
      const failure = login(request);
      for (const cookie of response.cookies.getAll()) failure.cookies.set(cookie);
      return failure;
    }
    return response;
  } catch (error) {
    if (error instanceof AuthFailure && error.status === 403) return new NextResponse("This account does not have access to FitMatch.", { status: 403, headers: { "Cache-Control": "no-store" } });
    if (error instanceof AuthFailure && error.status === 401) {
      const response = login(request);
      if (sessionValue === "") response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    return unavailable();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
