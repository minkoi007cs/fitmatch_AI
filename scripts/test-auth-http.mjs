/** Isolated HTTP contract test. Synthetic hub/Supabase only; no production credentials. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import sharp from "sharp";
import { createServerClient } from "@supabase/ssr";
import { seal, unseal } from "../src/lib/auth/session.ts";

const base = "http://localhost:3220";
const fixture = "http://127.0.0.1:3221";
const users = new Map();
const mappings = [];
const savedOutfits = [];
const refreshRecords = new Map();
const profiles = new Map();
let profileWrites = 0, wardrobePatch = null, quotaAllowed = true, quotaUnavailable = false, quotaCalls = 0, storageDeletes = 0;
const itemId = "22222222-2222-4222-a222-222222222222";
const completeProfile = { primaryStyle: "minimal", favoriteColors: ["Black"] };
const initialWardrobe = id => ({ id: itemId, user_id: id, name: "Existing wardrobe", category: "shirt", color: "white", style: "minimal", notes: "Keep notes", material: "cotton", description: "Keep description", is_favorite: true });
let wardrobeRows = new Map();
let subject = "hub-a", unavailable = false, exchanges = 0, refreshes = 0;
const localId = "11111111-1111-4111-a111-111111111111";
const user = (id, email = `${id}@fixture.invalid`, metadata = {}) => ({ id, email, aud: "authenticated", role: "authenticated", app_metadata: metadata, user_metadata: {}, created_at: new Date().toISOString() });
users.set(localId, user(localId));
const jwt = id => {
  const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ sub: id, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return `${head}.${body}.${createHmac("sha256", "synthetic-key").update(`${head}.${body}`).digest("base64url")}`;
};
const bearerId = req => { try { return JSON.parse(Buffer.from(req.headers.authorization.split(".")[1], "base64url")).sub; } catch { return null; } };
const mock = createServer(async (req, res) => {
  let raw = ""; for await (const part of req) raw += part;
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url, fixture);
  const send = (data, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  if (url.pathname === "/api/v1/auth/token") { exchanges++; return send({ data: { accessToken: "synthetic-hub-access", refreshToken: "synthetic-hub-refresh", expiresIn: 600 } }); }
  if (url.pathname === "/api/v1/auth/revoke") return send({ data: null });
  if (url.pathname === "/api/v1/auth/refresh") { refreshes++; return send({ data: { accessToken: "synthetic-new-access", refreshToken: "synthetic-new-refresh", expiresIn: 600 } }); }
  if (url.pathname === "/api/v1/me") {
    if (unavailable) return send({ error: { code: "INTERNAL", message: "synthetic outage" } }, 503);
    return send({ data: { user: { id: subject, email: "owner@fixture.invalid", name: "Fixture" }, appId: "test-fitmatch", expiresAt: new Date(Date.now()+600000).toISOString(), roles: ["member"], sessionId: "test-session", workspaceId: null } });
  }
  if (url.pathname.startsWith("/auth/v1/admin/users/")) { const found = users.get(url.pathname.split("/").at(-1)); return found ? send(found) : send({ code: "user_not_found", message: "not found" }, 404); }
  if (url.pathname === "/auth/v1/admin/users") { const created = user(body.id, body.email, body.app_metadata); users.set(created.id, created); return send(created); }
  if (url.pathname === "/auth/v1/admin/generate_link") { const found = [...users.values()].find(u => u.email === body.email); return send({ ...found, hashed_token: found.id, action_link: "https://fixture.invalid", verification_type: "magiclink", email_otp: "000000", redirect_to: base }); }
  if (url.pathname === "/auth/v1/verify") { const found = users.get(body.token_hash); return send({ access_token: jwt(found.id), refresh_token: "synthetic-supabase-refresh", expires_in: 3600, token_type: "bearer", user: found }); }
  if (url.pathname === "/auth/v1/user") { const found = users.get(bearerId(req)); return found ? send(found) : send({ message: "Unauthorized" }, 401); }
  if (url.pathname === "/auth/v1/logout") return send({});
  if (url.pathname === "/rest/v1/fm_auth_identities") {
    if (req.method === "POST") {
      if (mappings.some(m => m.user_id === body.user_id)) return send({ code: "23505", message: "duplicate" }, 409);
      mappings.push(body); return send(null, 201);
    }
    const records = mappings.filter(m => Object.keys(m).every(key => !url.searchParams.has(key) || url.searchParams.get(key) === `eq.${m[key]}`));
    return send(records);
  }
  if (url.pathname === "/rest/v1/fm_users") {
    const id = body.id ?? bearerId(req);
    const existing = profiles.get(id) ?? { id, style_profile: completeProfile, quiz_answers: { ageRange: "45+" } };
    if (req.method === "POST") {
      profileWrites++;
      const updated = req.headers.prefer?.includes("ignore-duplicates") ? existing : { ...existing, ...body };
      profiles.set(id, updated); return send(updated, 201);
    }
    return send(existing);
  }
  if (url.pathname === "/rest/v1/rpc/fm_consume_ai_units") {
    quotaCalls++;
    if (quotaUnavailable) return send({ message: "Synthetic quota outage" }, 503);
    return send(quotaAllowed);
  }
  if (url.pathname === "/rest/v1/rpc/fm_begin_auth_refresh") {
    if (!refreshRecords.has(body.p_hash)) refreshRecords.set(body.p_hash, { owner: body.p_owner, sealed_result: null });
    const record = refreshRecords.get(body.p_hash);
    return send([{ is_owner: record.owner === body.p_owner, sealed_result: record.sealed_result }]);
  }
  if (url.pathname === "/rest/v1/rpc/fm_finish_auth_refresh") {
    const record = refreshRecords.get(body.p_hash);
    if (record?.owner !== body.p_owner || record.sealed_result !== null) return send(false);
    record.sealed_result = body.p_result; return send(true);
  }
  if (url.pathname === "/rest/v1/fm_auth_refreshes") {
    return send(refreshRecords.get(url.searchParams.get("refresh_hash").slice(3)));
  }
  if (url.pathname === "/rest/v1/fm_wardrobe_items") {
    const id = bearerId(req);
    if (req.method === "POST") { assert.equal(body.user_id, id); return send({ ...body, id: itemId, created_at: new Date().toISOString() }); }
    assert.equal(url.searchParams.get("user_id"), `eq.${id}`);
    const existing = wardrobeRows.get(id) ?? initialWardrobe(id);
    if (req.method === "PATCH") { wardrobePatch = body; wardrobeRows.set(id, { ...existing, ...body }); return send(wardrobeRows.get(id)); }
    if (req.method === "DELETE") { wardrobeRows.delete(id); return send(null); }
    return send(req.headers.accept?.includes("vnd.pgrst.object+json") ? existing : [existing]);
  }
  if (url.pathname === "/rest/v1/fm_outfits") {
    if (req.method === "POST") {
      const record = { id: "33333333-3333-4333-a333-333333333333", created_at: new Date().toISOString(), ...body };
      savedOutfits.push(record); return send(record, 201);
    }
    if (req.method === "DELETE") {
      const index = savedOutfits.findIndex(row => row.user_id === bearerId(req) && `eq.${row.id}` === url.searchParams.get("id"));
      if (index !== -1) savedOutfits.splice(index, 1);
      return send(null);
    }
    let records = savedOutfits.filter(record => record.user_id === bearerId(req));
    const cursor = url.searchParams.get("or");
    if (cursor) {
      const matched = cursor.match(/^\(created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([a-f0-9-]+)\)\)$/);
      assert.ok(matched, "cursor must be constrained to timestamp/uuid");
      records = records.filter(row => row.created_at < matched[1] || (row.created_at === matched[2] && row.id < matched[3]));
    }
    records.sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    return send(records.slice(0, Number(url.searchParams.get("limit") ?? 20)));
  }
  if (url.pathname === "/storage/v1/object/fitmatch-wardrobe" && req.method === "DELETE") { storageDeletes++; return send([]); }
  if (url.pathname.startsWith("/storage/v1/object/sign/fitmatch-wardrobe/")) return send({ signedURL: "/object/sign/fitmatch-wardrobe/test.png?token=synthetic" });
  return send({ error: `Unexpected synthetic endpoint ${url.pathname}` }, 404);
});
await new Promise(resolve => mock.listen(3221, "127.0.0.1", resolve));
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3220"], { env: { ...process.env,
  OPENAI_API_KEY: "", FITMATCH_AUTH_PROVIDER: "app-system", APP_URL: base, NEXT_PUBLIC_INFRA_URL: fixture,
  INFRA_APP_ID: "test-fitmatch", NEXT_PUBLIC_INFRA_PUBLISHABLE_KEY: "pk_synthetic", INFRA_SECRET_KEY: "sk_synthetic",
  NEXT_PUBLIC_SUPABASE_URL: fixture, NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
}, stdio: ["ignore", "pipe", "pipe"] });
let output = ""; app.stdout.on("data", part => output += part); app.stderr.on("data", part => output += part);
const jar = new Map();
function takeCookies(headers, store = jar) { for (const line of headers.getSetCookie()) { const cookie = line.split(";")[0]; const equals = cookie.indexOf("="); const name = cookie.slice(0, equals), value = cookie.slice(equals+1); if (value) store.set(name, value); else store.delete(name); } }
async function request(path, options = {}, store = jar) {
  const requestHeaders = { Cookie: [...store].map(([k,v])=>`${k}=${v}`).join("; "), ...(options.method && options.method !== "GET" ? { Origin: base, ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }) } : {}), ...options.headers };
  for (const key of Object.keys(requestHeaders)) if (requestHeaders[key] === undefined) delete requestHeaders[key];
  const response = await fetch(base + path, { redirect: "manual", ...options, headers: requestHeaders });
  takeCookies(response.headers, store); return response;
}
async function begin(store = jar, link = false) {
  const response = await request(`/auth/${link ? "link" : "login"}?next=${encodeURIComponent("/outfits?vibe=formal")}`, link ? { method: "POST" } : {}, store);
  assert.equal(response.status, 303); const target = new URL(response.headers.get("location"), base);
  assert.equal(target.origin, fixture); assert.equal(target.searchParams.get("code_challenge_method"), "S256");
  const cookie = response.headers.getSetCookie().find(value => value.startsWith("fm_hub_flow_"));
  assert.ok(cookie.includes("HttpOnly") && cookie.includes("SameSite=lax"));
  return target.searchParams.get("state");
}
async function complete(state, store = jar) { return request(`/auth/callback?code=synthetic-code&state=${state}`, {}, store); }
try {
  for (let i = 0; i < 100; i++) { try { const r = await fetch(base); if (r.ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  for (const path of ["/api/wardrobe", "/api/outfits", "/api/user/profile"]) assert.equal((await request(path)).status, 401);
  assert.equal((await request("/api/generate-outfit", { method: "POST", body: JSON.stringify({ analysis: {}, styleProfile: { primaryStyle: "minimal" } }) })).status, 401);
  assert.equal((await request("/api/generate-outfit", { method: "POST", headers: { Origin: "https://evil.invalid" }, body: "{}" })).status, 403);
  console.log("PASS: guest APIs blocked before parsing/AI; cross-origin mutation rejected");
  assert.equal((await request("/studio")).status, 303, "guest Studio is protected");
  const gate = await request("/outfits?vibe=formal"); assert.equal(gate.status, 303); assert.equal(new URL(gate.headers.get("location"), base).searchParams.get("next"), "/outfits?vibe=formal");
  const bad = await request("/auth/callback?code=synthetic-code&state=untrusted"); assert.equal(bad.status, 303); assert.equal(bad.headers.get("cache-control"), "no-store"); assert.equal(bad.headers.get("referrer-policy"), "no-referrer"); assert.equal(exchanges, 0);
  const state = await begin(); const wrong = await complete("z".repeat(32)); assert.equal(wrong.status, 303); assert.equal(exchanges, 0);
  const callback = await complete(state); assert.equal(callback.status, 303); assert.equal(new URL(callback.headers.get("location"), base).pathname, "/outfits"); assert.equal(new URL(callback.headers.get("location"), base).search, "?vibe=formal");
  assert.ok(jar.has("fm_hub_session")); assert.equal(mappings.length, 1);
  const signedIn = await request("/api/auth/session"); assert.equal(signedIn.status, 200); const session = await signedIn.json(); assert.equal(session.user.email, "owner@fixture.invalid");
  console.log("PASS: PKCE/state verified; callback bridges user-scoped Supabase session and preserves next/vibe");
  assert.equal((await request("/studio")).status, 200);
  if (process.argv.includes("--studio")) {
    const { testStudio } = await import("./test-studio-browser.mjs");
    await testStudio(base, jar);
  }
  const wardrobe = await request("/api/wardrobe"); assert.equal(wardrobe.status, 200); assert.equal((await wardrobe.json()).items.length, 1);
  assert.equal((await request("/wardrobe")).status, 200, "verified dual session may render a protected page");
  const save = await request("/api/wardrobe", { method: "POST", body: JSON.stringify({ name: "Test shirt", category: "shirt", color: "white", style: "minimal", user_id: "victim" }) }); assert.equal(save.status, 200);
  assert.equal((await request("/api/wardrobe", { method: "POST", body: JSON.stringify({ imagePath: "victim/photo.png" }) })).status, 400);
  subject = "other-hub-user"; assert.equal((await request("/api/wardrobe")).status, 401); subject = "hub-a";
  unavailable = true; const outage = await request("/api/wardrobe"); assert.equal(outage.status, 503); assert.ok(jar.has("fm_hub_session")); unavailable = false;
  console.log("PASS: owner-scoped data, forged owner/image rejection, mismatched identity denied, outage preserves session");
  const imageOwner = session.user.id;
  const look = { id: "look-1", name: "Minimal look", styleCategory: "minimal", confidenceScore: 90, colorExplanation: "Balanced colors", styleExplanation: "Clean styling", items: [{ category: "shirt", description: "Cotton shirt", suggestedColor: "White" }, { category: "pants", description: "Straight trousers", suggestedColor: "Black" }], accessories: [], imagePath: `${imageOwner}/looks/test.png`, imageUrl: "https://untrusted.invalid/image" };
  assert.equal((await request("/api/outfits", { method: "POST", body: JSON.stringify({ data: [look] }) })).status, 200);
  assert.equal(savedOutfits[0].data_json[0].imageUrl, undefined, "never persist a caller-supplied signed URL");
  const restored = await (await request("/api/outfits")).json();
  assert.equal(restored.outfits[0].data_json[0].imagePath, look.imagePath);
  assert.ok(restored.outfits[0].data_json[0].imageUrl.includes("synthetic"), "reload signs the stored owned image path");
  assert.equal((await request("/api/outfits", { method: "POST", body: JSON.stringify({ data: [{ ...look, imagePath: "victim/looks/test.png" }] }) })).status, 400);
  assert.equal((await request("/api/outfits", { method: "POST", body: JSON.stringify({ data: [null] }) })).status, 400);
  const profileContract = await (await request("/api/user/profile")).json();
  assert.equal(profileContract.quizAnswers.ageRange, "45+");
  console.log("PASS: outfit image survives save/reload with new signed URL; foreign image path and invalid archive rejected; quiz contract correct");

  const patch = await request(`/api/wardrobe/${itemId}`, { method: "PATCH", body: JSON.stringify({ name: "Rename only" }) });
  assert.equal(patch.status, 200); const patched = (await patch.json()).item;
  assert.equal(patched.notes, "Keep notes"); assert.equal(patched.material, "cotton"); assert.equal(patched.is_favorite, true);
  assert.deepEqual(Object.keys(wardrobePatch).sort(), ["name", "updated_at"]);
  const beforeWrites = profileWrites;
  assert.equal((await request("/api/user/profile", { method: "POST", body: "{}" })).status, 400);
  assert.equal(profileWrites, beforeWrites);
  assert.equal((await request("/api/user/profile", { method: "POST", body: JSON.stringify({ styleProfile: completeProfile }) })).status, 200);
  assert.equal((await (await request("/api/user/profile")).json()).quizAnswers.ageRange, "45+");
  for (const path of [`/api/wardrobe/${itemId}`, "/api/outfits", "/api/user/profile", "/api/generate-outfit", "/api/analyze-image", "/api/generate-outfit-image"]) {
    assert.equal((await request(path, { method: path.includes(itemId) ? "PATCH" : "POST", body: "{broken" })).status, 400);
  }
  assert.equal((await request("/api/outfits", { method: "POST", body: JSON.stringify({ data: [{ ...look, items: [null] }] }) })).status, 400);
  const validAnalysis = { type: "shirt", primaryColor: "white", pattern: "plain", style: "minimal", description: "Cotton shirt" };
  quotaAllowed = false;
  for (const [path, payload] of [["/api/generate-outfit", { analysis: validAnalysis }], ["/api/analyze-image", { imageBase64: "aGVsbG8=" }], ["/api/generate-outfit-image", { items: look.items }], ["/api/user/profile", { quizAnswers: { ageRange: "25-34", favoriteColors: ["Black"], preferredOutfits: ["Minimal"], fashionInspirations: ["Classic"] } }]]) {
    const denied = await request(path, { method: "POST", body: JSON.stringify(payload) });
    assert.equal(denied.status, 429, path); assert.ok(Number(denied.headers.get("retry-after")) > 0);
  }
  quotaAllowed = true; quotaUnavailable = true;
  assert.equal((await request("/api/generate-outfit", { method: "POST", body: JSON.stringify({ analysis: validAnalysis }) })).status, 503);
  quotaUnavailable = false;
  const recommendation = { headline:"Your style",summary:"A saved result",flatteringFocus:["Balanced layers"],avoidNotes:[],outfits:[{name:"Office look",occasion:"Office",whyItFitsYou:"Comfort",pieces:["Shirt","Trousers"]}] };
  profiles.set(imageOwner,{...profiles.get(imageOwner),style_profile:{...completeProfile,recommendations:recommendation}});
  const beforeReadQuota=quotaCalls;
  for(let i=0;i<2;i++) assert.deepEqual((await(await request("/api/user/profile")).json()).recommendations,recommendation);
  assert.equal(quotaCalls,beforeReadQuota,"reloading saved recommendations cannot call AI/quota");
  const beforeUploadQuota = quotaCalls;
  const badUpload = new FormData(); badUpload.append("file", new File(["not an image"],"photo.jpg",{type:"image/jpeg"}));
  assert.equal((await request("/api/upload-item", { method:"POST", headers:{"Content-Type":undefined}, body:badUpload })).status,400);
  assert.equal(quotaCalls,beforeUploadQuota,"bad image bytes cannot consume quota");
  const validUpload = new FormData();
  const tinyImage = await sharp({create:{width:8,height:8,channels:3,background:"white"}}).jpeg().toBuffer();
  validUpload.append("file",new File([tinyImage],"photo.jpg",{type:"image/jpeg"}));
  quotaAllowed=false;
  assert.equal((await request("/api/upload-item",{method:"POST",headers:{"Content-Type":undefined},body:validUpload})).status,429);
  quotaAllowed=true;
  const beforeQuota = quotaCalls;
  assert.equal((await request("/api/generate-outfit", { method: "POST", body: JSON.stringify({ analysis: {}, styleProfile: { favoriteColors: "red" } }) })).status, 400);
  assert.equal(quotaCalls, beforeQuota, "invalid inputs must not consume quota");
  savedOutfits.push({ id: "44444444-4444-4444-a444-444444444444", user_id: imageOwner, created_at: new Date().toISOString(), data_json: [{ ...look, items: [null] }] });
  const legacy = await (await request("/api/outfits")).json(); assert.equal(legacy.invalidCount, 1); assert.ok(legacy.outfits.every(row => row.data_json[0].items[0] !== null));
  savedOutfits.length = 0;
  for (let i=0;i<45;i++) savedOutfits.push({ id: `55555555-5555-4555-a555-${String(i).padStart(12,"0")}`, user_id: imageOwner, created_at: "2026-11-04T12:00:00.000Z", data_json: [look] });
  const ids = []; let cursor = null;
  do { const page = await (await request(`/api/outfits${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`)).json(); ids.push(...page.outfits.map(row => row.id)); cursor = page.nextCursor; } while(cursor);
  assert.equal(ids.length,45); assert.equal(new Set(ids).size,45);
  assert.equal((await request("/api/outfits?cursor=invalid")).status,400);
  const secondJar=new Map(); subject="hub-second-owner";
  assert.equal((await complete(await begin(secondJar),secondJar)).status,303);
  assert.equal((await(await request("/api/outfits",{},secondJar)).json()).outfits.length,0);
  const beforeDelete=savedOutfits.length;
  assert.equal((await request(`/api/outfits?id=${savedOutfits[0].id}`,{method:"DELETE"},secondJar)).status,200);
  assert.equal(savedOutfits.length,beforeDelete,"another user's archive cannot be deleted");
  subject="hub-a";
  const ownId=savedOutfits[0].id;
  assert.equal((await request(`/api/outfits?id=${ownId}`,{method:"DELETE"})).status,200);
  assert.equal(savedOutfits.length,beforeDelete-1);

  assert.equal((await request(`/api/wardrobe/${itemId}`, { method: "DELETE" })).status,200);
  assert.equal(storageDeletes,0,"deleting one reference must not remove a shared private object");
  assert.equal((await request(`/api/outfit-image?path=${encodeURIComponent(`${imageOwner}/looks/test.png`)}`)).status,200);
  assert.equal((await request("/api/outfit-image?path=victim/photo.png")).status,400);
  console.log("PASS: non-destructive PATCH/profile, nested validation, quota 429/outage, legacy archive safety, 45-row pagination, shared asset retention and preview ownership");

  const expiring = unseal(decodeURIComponent(jar.get("fm_hub_session")), "sk_synthetic", "session");
  expiring.pair.expiresAt = Date.now() + 50_000;
  const oldJar = new Map(jar); oldJar.set("fm_hub_session", seal(expiring, "sk_synthetic", "session"));
  const refreshed = await Promise.all(Array.from({length:10},()=>request("/api/auth/session", {}, new Map(oldJar))));
  refreshed.forEach(response => assert.equal(response.status, 200)); assert.equal(refreshes, 1);
  assert.equal((await request("/api/auth/session", {}, new Map(oldJar))).status, 200); assert.equal(refreshes, 1);
  assert.ok(![...refreshRecords.values()][0].sealed_result.includes("synthetic-new-refresh"));
  console.log("PASS: 10 parallel HTTP requests rotate once; late cookie reuses encrypted successor");
  const legacyJar = new Map();
  const legacyClient = createServerClient(fixture, "synthetic-anon", { cookies: { getAll: () => [...legacyJar].map(([name,value])=>({name,value})), setAll: list => list.forEach(c=>legacyJar.set(c.name,c.value)) } });
  assert.equal((await legacyClient.auth.verifyOtp({ type: "magiclink", token_hash: localId })).error, null);
  subject = "hub-existing"; const linked = await complete(await begin(legacyJar, true), legacyJar); assert.equal(linked.status, 303); assert.equal(new URL(linked.headers.get("location"), base).pathname, "/outfits");
  const linkedSession = await (await request("/api/auth/session", {}, legacyJar)).json(); assert.equal(linkedSession.user.id, localId);
  console.log("PASS: explicit dual-session linking preserves the original wardrobe user ID");
  const logout = await request("/auth/logout", { method: "POST" }, legacyJar); assert.equal(logout.status, 200); assert.equal((await request("/api/wardrobe", {}, legacyJar)).status, 401); assert.ok(!legacyJar.has("fm_hub_session"));
  assert.equal(refreshes, 1, "normal requests must not rotate fresh tokens");
  console.log("PASS: logout clears both sessions; no unnecessary token refresh");
} catch (error) {
  console.error(output.slice(-3500)); throw error;
} finally { app.kill("SIGTERM"); await new Promise(resolve => mock.close(resolve)); }
