/** Register only this app's auth client. Does not provision a DB, deploy, or print keys. */
import { readFile, writeFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

const hubRepo = process.argv[2];
if (!hubRepo) throw new Error("Usage: node scripts/register-app-system.mjs /path/to/unified-app-infra");
const root = resolve(hubRepo);
const env = parseEnv(await readFile(resolve(root, ".env.local"), "utf8"));
for (const [key, value] of Object.entries(env)) if (process.env[key] === undefined) process.env[key] = value;
const hubUrl = new URL(process.argv[3] ?? "https://system.minkoi.org").origin;
const d = await import(pathToFileURL(resolve(root, "packages/db/dist/index.js")).href);
const db = d.masterDb();
const owner = await d.findUserByEmail(db, "minkoi007.cs@gmail.com");
if (!owner) throw new Error("Sign in to App System with the app owner's account first");
const existing = await d.getAppBySlug(db, "fitmatch-ai");
if (existing) {
  console.log("FitMatch AI is already registered. Reuse its existing config; no keys were issued.");
  process.exit(0);
}
const registered = await db.transaction(async tx => {
  const app = await d.createApp(tx, { slug: "fitmatch-ai", name: "FitMatch AI", description: "Central sign-in for FitMatch AI", ownerUserId: owner.id });
  await d.addMember(tx, app.id, owner.id, "owner");
  await d.seedSystemRoles(tx, app.id);
  await d.updateAllowedOrigins(tx, app.id, ["https://fitmatch.minkoi.org", "http://localhost:3220"]);
  const pk = await d.issueApiKey(tx, { appId: app.id, name: "FitMatch hosted sign-in", createdBy: owner.id, kind: "publishable", scopes: ["auth:read"] });
  const sk = await d.issueApiKey(tx, { appId: app.id, name: "FitMatch auth server", createdBy: owner.id, kind: "secret", scopes: ["auth:read"] });
  await d.recordAudit(tx, { appId: app.id, actorType: "admin", actorId: owner.id, action: "app.created", targetType: "app", targetId: app.id, meta: { via: "fitmatch-auth-integration", authOnly: true } });
  return { id: app.id, pk: pk.rawKey, sk: sk.rawKey };
});
const destination = resolve(".env.app-system.local");
await writeFile(destination, ["FITMATCH_AUTH_PROVIDER=app-system", `NEXT_PUBLIC_INFRA_URL=${hubUrl}`,
  `NEXT_PUBLIC_INFRA_PUBLISHABLE_KEY=${registered.pk}`, `INFRA_SECRET_KEY=${registered.sk}`,
  `INFRA_APP_ID=${registered.id}`, "APP_URL=http://localhost:3220", ""].join("\n"), { mode: 0o600, flag: "wx" });
await chmod(destination, 0o600);
console.log(JSON.stringify({ appId: registered.id, authOnly: true, configFile: destination, keysPrinted: false }));
process.exit(0);
