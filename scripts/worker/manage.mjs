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
const KINDS = ["avatar.reconstruct", "garment.reconstruct", "garment.drape"];
const usage =
  "Usage: node --env-file=.env.local scripts/worker/manage.mjs create OWNER [kind...] | grant|ungrant OWNER WORKER kind... | rotate|revoke OWNER WORKER";
const [command, ownerId, ...rest] = process.argv.slice(2);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
if (!["create", "grant", "ungrant", "rotate", "revoke"].includes(command) || !uuid.test(ownerId ?? ""))
  throw new Error(usage);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
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
