import { createClient } from "@supabase/supabase-js";
import { resolveBackendIdentity } from "@/lib/backend-identity.mjs";

/** Service-role client. ENV-CANON-01: refuses (BackendIdentityError, 503) unless the configuration is
 * bound to the approved project, so a wrong/retired project can never receive writes, worker enrollment
 * or job claims. */
export function createAdminClient() {
  const identity = resolveBackendIdentity(process.env, { requireServiceKey: true });
  return createClient(identity.url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
