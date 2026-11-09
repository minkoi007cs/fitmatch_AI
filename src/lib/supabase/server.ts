import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { resolveBackendIdentity } from "@/lib/backend-identity.mjs";

export async function createClient() {
  const identity = resolveBackendIdentity(process.env); // ENV-CANON-01: fail closed before any request
  const cookieStore = await cookies();

  return createServerClient(
    identity.url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...(process.env.FITMATCH_AUTH_PROVIDER === "app-system" ? { httpOnly: true } : {}),
              })
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
