// ENV-CANON-01 / BACKEND-024: the server only talks to the approved Supabase project.
// Plain ESM so the Next app, operator scripts (scripts/worker/manage.mjs) and tests share one rule set.
// Project refs and API URLs are public configuration, never credentials. Nothing here logs key values.

/** fitmatch-ai — the only approved main/pilot backend (docs/infrastructure/backend-environments.json). */
export const CANONICAL_PROJECT_REF = "gohczmqykjkrgdblgbog";
/** Projects a canonical-mode server may be bound to. Adding one (e.g. a separately provisioned staging
 * project) is a reviewed code change, never an environment-only switch. */
export const APPROVED_PROJECT_REFS = Object.freeze([CANONICAL_PROJECT_REF]);
/** smoke-supabase — retired for FitMatch: never accepted, whatever the environment says. */
export const RETIRED_PROJECT_REFS = Object.freeze(["wqbwwusrhertqktwsxsl"]);
/** Reported by an isolated local test server instead of a project ref. */
export const ISOLATED_TEST_REF = "isolated-test";

export class BackendIdentityError extends Error {
  /** @param {string} reason short, secret-free reason */
  constructor(reason) {
    super("BACKEND_IDENTITY_MISMATCH");
    this.reason = reason;
    this.status = 503;
  }
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** @param {string | undefined} key */
function jwtClaims(key) {
  if (!key) return null;
  const parts = key.split(".");
  if (parts.length !== 3) return null; // new-format keys (sb_publishable_/sb_secret_) carry no claims
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json);
    return claims && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

/**
 * Resolve and validate the backend this process is configured for. Throws BackendIdentityError (never
 * echoes key material) when the configuration could reach anything but the expected project.
 *
 * canonical (default): FITMATCH_EXPECTED_SUPABASE_REF must be set, not retired, and the URL must be
 *   exactly https://<ref>.supabase.co; JWT-format keys must carry the same ref and the right role.
 * isolated-test (FITMATCH_BACKEND_MODE=isolated-test): only a loopback URL is accepted (local
 *   fixture / disposable Docker); any *.supabase.co URL is refused so tests can never touch a cloud
 *   project.
 * @param {Record<string, string | undefined>} env
 * @param {{ requireServiceKey?: boolean }} [options]
 * @returns {{ mode: "canonical" | "isolated-test", projectRef: string, url: string }}
 */
export function resolveBackendIdentity(env = process.env, options = {}) {
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) throw new BackendIdentityError("NEXT_PUBLIC_SUPABASE_URL is not set");
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BackendIdentityError("NEXT_PUBLIC_SUPABASE_URL is not a URL");
  }
  const mode = env.FITMATCH_BACKEND_MODE || "canonical";
  const anon = jwtClaims(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const service = jwtClaims(env.SUPABASE_SERVICE_ROLE_KEY);
  if (options.requireServiceKey && !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new BackendIdentityError("server key is not set");
  const refFromHost = url.hostname.endsWith(".supabase.co") ? url.hostname.slice(0, -".supabase.co".length) : null;
  for (const ref of [refFromHost, anon?.ref, service?.ref, env.FITMATCH_EXPECTED_SUPABASE_REF])
    if (ref && RETIRED_PROJECT_REFS.includes(String(ref)))
      throw new BackendIdentityError("retired project (smoke-supabase) is not a FitMatch backend");

  if (mode === "isolated-test") {
    if (refFromHost || !LOOPBACK.has(url.hostname) || !["http:", "https:"].includes(url.protocol))
      throw new BackendIdentityError("isolated-test mode accepts only a loopback URL");
    return { mode, projectRef: ISOLATED_TEST_REF, url: url.origin };
  }
  if (mode !== "canonical") throw new BackendIdentityError("unknown FITMATCH_BACKEND_MODE");

  const expected = env.FITMATCH_EXPECTED_SUPABASE_REF;
  if (!expected || !/^[a-z0-9]{20}$/.test(expected))
    throw new BackendIdentityError("FITMATCH_EXPECTED_SUPABASE_REF is not set to a project ref");
  if (!APPROVED_PROJECT_REFS.includes(expected))
    throw new BackendIdentityError("FITMATCH_EXPECTED_SUPABASE_REF is not an approved FitMatch project");
  if (url.protocol !== "https:" || url.hostname !== `${expected}.supabase.co` || url.port || url.username ||
      (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash)
    throw new BackendIdentityError("NEXT_PUBLIC_SUPABASE_URL is not the expected project");
  if (anon && (anon.ref !== expected || anon.role !== "anon"))
    throw new BackendIdentityError("public key belongs to another project or role");
  if (service && (service.ref !== expected || service.role !== "service_role"))
    throw new BackendIdentityError("server key belongs to another project or role");
  return { mode, projectRef: expected, url: url.origin };
}
