// ENV-CANON-01: check the backend identity once at server start. The server still starts so public pages
// work, but every server-side Supabase client refuses to be created while the identity is wrong (fail
// closed per request), so nothing is written to an unexpected project. Only the reason is logged.
import { resolveBackendIdentity, BackendIdentityError } from "@/lib/backend-identity.mjs";

export function register() {
  try {
    const identity = resolveBackendIdentity(process.env);
    console.log(`[backend] bound to ${identity.mode === "isolated-test" ? "isolated local test backend" : `project ${identity.projectRef}`}`);
  } catch (error) {
    const reason = error instanceof BackendIdentityError ? error.reason : "unexpected configuration error";
    console.error(`[backend] REFUSING Supabase access: ${reason}`);
  }
}
