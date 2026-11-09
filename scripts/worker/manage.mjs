/** Trusted operator only. Keeps Supabase admin credentials on the server/operator, never PC.
 *
 * create  OWNER_UUID [kind ...]            new worker + one-time token; optional initial grants
 * grant   OWNER_UUID WORKER_UUID kind ...  allow these kinds (R1 default is deny)
 * ungrant OWNER_UUID WORKER_UUID kind ...  remove these kinds; running leases finish, no new claims
 * rotate  OWNER_UUID WORKER_UUID           new token for the same worker (old token stops at once)
 * revoke  OWNER_UUID WORKER_UUID           disable the worker; its leases can no longer mutate jobs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { resolveBackendIdentity, BackendIdentityError } from "../../src/lib/backend-identity.mjs";
// Must match fm_v2_workers_allowed_capabilities_check. garment.analyze = Qwen (QINT-C): grant it only on a
// test server after contract + drain review; the app also needs QWEN_ANALYSIS_ENABLED=1.
const KINDS = ["avatar.reconstruct", "garment.reconstruct", "garment.drape", "bottom.reconstruct", "bottom.drape", "garment.analyze"];
const usage =
  "Usage: node --env-file=.env.local scripts/worker/manage.mjs create OWNER [kind...] | grant|ungrant OWNER WORKER kind... | rotate|revoke OWNER WORKER";
const [command, ownerId, ...rest] = process.argv.slice(2);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
if (!["create", "grant", "ungrant", "rotate", "revoke"].includes(command) || !uuid.test(ownerId ?? ""))
  throw new Error(usage);
// ENV-CANON-01: enrollment/grants only against the approved project (BACKEND-024); never smoke or a
// mismatched URL/key pair. Prints only the project ref (public), never key material.
let identity;
try {
  identity = resolveBackendIdentity(process.env, { requireServiceKey: true });
} catch (error) {
  console.error(error instanceof BackendIdentityError ? `BACKEND_IDENTITY_MISMATCH: ${error.reason}` : "Backend configuration error");
  process.exit(5);
}
console.error(`Operator target: ${identity.mode === "isolated-test" ? "isolated local test backend" : `project ${identity.projectRef}`}`);
const db = createClient(
  identity.url,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const kindsFrom = (list) => {
  if (list.some((k) => !KINDS.includes(k)))
    throw new Error("Unknown capability. Allowed: " + KINDS.join(", "));
  return [...new Set(list)];
};
const newToken = () => {
  const token = "fmw_" + randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
};
const secretNote =
  "ONE-TIME SECRET: put in PC environment, do not commit or paste into chat.";
if (command === "create") {
  const allowed = kindsFrom(rest);
  const { token, hash } = newToken();
  const id = randomUUID();
  const { error } = await db.from("fm_v2_workers").insert({
    id,
    user_id: ownerId,
    name: "Windows GPU",
    token_hash: hash,
    allowed_capabilities: allowed,
  });
  if (error) throw new Error("Worker registration failed");
  console.log(JSON.stringify({ workerId: id, token, allowedCapabilities: allowed, note: secretNote }, null, 2));
} else {
  const [workerId, ...kinds] = rest;
  if (!uuid.test(workerId ?? "")) throw new Error("Worker UUID required. " + usage);
  const row = await db
    .from("fm_v2_workers")
    .select("allowed_capabilities")
    .eq("id", workerId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (row.error || !row.data) throw new Error("Worker not found for this owner");
  const update = async (values) => {
    const { error } = await db.from("fm_v2_workers").update(values).eq("id", workerId).eq("user_id", ownerId);
    if (error) throw new Error(command + " failed");
  };
  if (command === "grant" || command === "ungrant") {
    const change = kindsFrom(kinds);
    if (!change.length) throw new Error("Name at least one capability. " + usage);
    const current = new Set(row.data.allowed_capabilities ?? []);
    for (const k of change) {
      if (command === "grant") current.add(k);
      else current.delete(k);
    }
    await update({ allowed_capabilities: [...current] });
    console.log("Allowed capabilities:", [...current].join(", ") || "(none)");
  } else if (command === "rotate") {
    const { token, hash } = newToken();
    await update({ token_hash: hash });
    console.log(JSON.stringify({ workerId, token, note: secretNote }, null, 2));
  } else {
    await update({ enabled: false });
    console.log("Worker revoked.");
  }
}
