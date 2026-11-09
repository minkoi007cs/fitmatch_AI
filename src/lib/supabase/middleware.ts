import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveBackendIdentity } from "@/lib/backend-identity.mjs";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const identity = resolveBackendIdentity(process.env); // ENV-CANON-01
  const supabase = createServerClient(
    identity.url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...(process.env.FITMATCH_AUTH_PROVIDER === "app-system" ? { httpOnly: true } : {}),
            })
          );
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // The proxy owns redirects; this helper only persists refreshed Supabase cookies.
  return { response: supabaseResponse, user, error };
}
