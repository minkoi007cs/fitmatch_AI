/** Trusted operator only. Keeps Supabase admin credentials on the server/operator, never PC. */
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes, createHash } from "node:crypto";
const [command, ownerId, workerId] = process.argv.slice(2);
if (
  !["create", "revoke"].includes(command) ||
  !/^[-a-f0-9]{36}$/.test(ownerId ?? "")
)
  throw new Error(
    "Usage: node --env-file=.env.local scripts/worker/manage.mjs create|revoke OWNER_UUID [WORKER_UUID]",
  );
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
if (command === "create") {
  const token = "fmw_" + randomBytes(32).toString("base64url");
  const id = randomUUID();
  const { error } = await db.from("fm_v2_workers").insert({
    id,
    user_id: ownerId,
    name: "Windows GPU",
    token_hash: createHash("sha256").update(token).digest("hex"),
  });
  if (error) throw new Error("Worker registration failed");
  console.log(
    JSON.stringify(
      {
        workerId: id,
        token,
        note: "ONE-TIME SECRET: put in PC environment, do not commit or paste into chat.",
      },
      null,
      2,
    ),
  );
} else {
  if (!/^[-a-f0-9]{36}$/.test(workerId ?? ""))
    throw new Error("Worker UUID required");
  const { error } = await db
    .from("fm_v2_workers")
    .update({ enabled: false })
    .eq("id", workerId)
    .eq("user_id", ownerId);
  if (error) throw new Error("Revoke failed");
  console.log("Worker revoked.");
}
