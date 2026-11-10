/**
 * APP-CLOSE-30 / R-MIGTARGET-29 — fail-closed identity check for the cutover runner's DATABASE_URL.
 *
 * The runner must refuse a target BEFORE starting psql unless the URL names the expected project through an
 * endpoint that is itself bound to that project. A username suffix alone is not evidence of the host: an
 * arbitrary server can be reached with user "postgres.<ref>". Accepted hosted forms (all others refused):
 *
 *   direct  postgres(ql)://postgres[:pw]@db.<ref>.supabase.co[:5432]/postgres
 *   pooler  postgres(ql)://postgres.<ref>[:pw]@<host>[:5432]/postgres   where <host> is listed in the reviewed
 *           plan's trustedPoolerHosts AND has the Supabase shared-pooler form aws-<n>-<region>.pooler.supabase.com
 *           (session mode only; transaction mode 6543 is refused for DDL cutover).
 *
 * Query parameters that can redirect or re-identify the connection (host, hostaddr, port, user, dbname, service,
 * options, ...) are refused; only sslmode (require/verify-ca/verify-full), connect_timeout and application_name
 * are allowed. Isolated tests accept loopback hosts only. There is no override flag.
 */

export const RETIRED_REFS = ["wqbwwusrhertqktwsxsl"]; // smoke-supabase, retired for FitMatch
const REF_RE = /^[a-z0-9]{20}$/;
const POOLER_HOST_RE = /^aws-[0-9]+-[a-z]{2}-[a-z]+-[0-9]+\.pooler\.supabase\.com$/;
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const ALLOWED_PARAMS = new Set(["sslmode", "connect_timeout", "application_name"]);
const ALLOWED_SSLMODES = new Set(["require", "verify-ca", "verify-full"]);

/** libpq environment variables that can change which server/database/user psql connects to. */
export const TARGET_ENV_VARS = [
  "PGHOST", "PGHOSTADDR", "PGPORT", "PGDATABASE", "PGUSER", "PGSERVICE", "PGSERVICEFILE", "PGOPTIONS",
  "PGTARGETSESSIONATTRS", "PGLOADBALANCEHOSTS", "PGREQUIREAUTH", "PGCHANNELBINDING",
];

/** Copy of env without target-affecting libpq variables (credentials/TLS files are kept). */
export const sanitizedPsqlEnv = (env) => {
  const out = { ...env };
  for (const k of TARGET_ENV_VARS) delete out[k];
  return out;
};

const refuse = (reason) => ({ ok: false, reason });

/**
 * @param {string} url DATABASE_URL (never logged by callers)
 * @param {{ expectedRef: string, planRef?: string, isolated?: boolean, trustedPoolerHosts?: string[] }} opts
 * @returns {{ ok: true, kind: "isolated-loopback"|"direct"|"pooler" } | { ok: false, reason: string }}
 */
export function checkTarget(url, { expectedRef, planRef, isolated = false, trustedPoolerHosts = [] }) {
  if (typeof expectedRef !== "string" || !REF_RE.test(expectedRef)) return refuse("--expected-ref is not a project ref");
  if (RETIRED_REFS.includes(expectedRef)) return refuse("retired project (smoke-supabase)");
  if (typeof url !== "string" || url.length === 0) return refuse("DATABASE_URL is not set");
  if (/[\s\u0000-\u001f]/.test(url)) return refuse("DATABASE_URL contains whitespace/control characters");
  if (!/^postgres(ql)?:\/\//i.test(url)) return refuse("DATABASE_URL must be a postgres:// or postgresql:// URI (key=value strings are not accepted)");
  let u;
  try {
    u = new URL(url);
  } catch {
    return refuse("DATABASE_URL is not a URL");
  }
  if (!["postgres:", "postgresql:"].includes(u.protocol)) return refuse("unsupported scheme");
  if (u.hash) return refuse("DATABASE_URL must not contain a fragment");
  const raw = url.slice(url.indexOf("//") + 2).split(/[/?#]/)[0];
  const hostPart = raw.includes("@") ? raw.slice(raw.lastIndexOf("@") + 1) : raw;
  if (hostPart.includes(",")) return refuse("multi-host DATABASE_URL is not accepted");
  const host = u.hostname.toLowerCase();
  if (!host) return refuse("DATABASE_URL has no host (socket/default host not accepted)");
  if (/%/.test(host)) return refuse("percent-encoded host is not accepted");
  for (const [k, v] of u.searchParams) {
    if (!ALLOWED_PARAMS.has(k)) return refuse(`connection parameter "${k}" is not accepted in DATABASE_URL`);
    if (k === "sslmode" && !(isolated || ALLOWED_SSLMODES.has(v))) return refuse("sslmode must be require, verify-ca or verify-full");
  }
  let user;
  try {
    user = decodeURIComponent(u.username);
  } catch {
    return refuse("username is not valid percent-encoding");
  }
  let db;
  try {
    db = decodeURIComponent(u.pathname.replace(/^\//, ""));
  } catch {
    return refuse("database name is not valid percent-encoding");
  }

  if (isolated) {
    if (!LOOPBACK.has(host)) return refuse("--isolated-test accepts only a loopback database");
    return { ok: true, kind: "isolated-loopback" };
  }
  if (planRef !== undefined && expectedRef !== planRef) return refuse("expected ref differs from the plan's projectRef");
  if (LOOPBACK.has(host)) return refuse("loopback target is only accepted with --isolated-test");
  if (db !== "postgres") return refuse("database name must be postgres");
  const port = u.port === "" ? 5432 : Number(u.port);

  if (host === `db.${expectedRef}.supabase.co`) {
    if (port !== 5432) return refuse("direct endpoint must use port 5432");
    if (user !== "postgres") return refuse("direct endpoint username must be exactly postgres");
    return { ok: true, kind: "direct" };
  }
  if (host.endsWith(".pooler.supabase.com")) {
    const trusted = (trustedPoolerHosts ?? []).map((h) => String(h).toLowerCase());
    if (!trusted.includes(host)) return refuse("pooler host is not listed in the reviewed plan's trustedPoolerHosts");
    if (!POOLER_HOST_RE.test(host)) return refuse("trusted pooler host does not have the Supabase shared-pooler form");
    if (port !== 5432) return refuse("pooler must use session mode port 5432 (transaction mode refused for cutover)");
    if (user !== `postgres.${expectedRef}`) return refuse(`pooler username must be exactly postgres.<expected ref>`);
    return { ok: true, kind: "pooler" };
  }
  return refuse("DATABASE_URL host is not the expected project's direct endpoint or a reviewed pooler host");
}

/** Validates the plan's pooler allowlist itself (called once per run, before any target check). */
export function checkPlanPoolerHosts(hosts) {
  if (hosts === undefined) return { ok: true };
  if (!Array.isArray(hosts)) return refuse("plan.trustedPoolerHosts must be an array");
  for (const h of hosts) {
    if (typeof h !== "string" || !POOLER_HOST_RE.test(h.toLowerCase())) return refuse(`plan.trustedPoolerHosts entry "${h}" is not a Supabase shared-pooler host`);
  }
  return { ok: true };
}
