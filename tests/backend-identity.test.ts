import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APPROVED_PROJECT_REFS,
  BackendIdentityError,
  CANONICAL_PROJECT_REF,
  resolveBackendIdentity,
} from "../src/lib/backend-identity.mjs";

// ENV-CANON-01 / BACKEND-024. Synthetic unsigned JWT-shaped keys only (never real keys).
const jwt = (claims: Record<string, unknown>) =>
  ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");
const REF = CANONICAL_PROJECT_REF;
const SMOKE = "wqbwwusrhertqktwsxsl";
const OTHER = "abcdefghijabcdefghij";
const good = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ ref: REF, role: "anon" }),
  SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: REF, role: "service_role" }),
  FITMATCH_EXPECTED_SUPABASE_REF: REF,
};
const refused = (env: Record<string, string | undefined>, reason: RegExp, options = {}) => {
  assert.throws(() => resolveBackendIdentity(env, options), (error: unknown) => {
    assert.ok(error instanceof BackendIdentityError);
    assert.equal(error.message, "BACKEND_IDENTITY_MISMATCH");
    assert.match(error.reason, reason);
    for (const value of Object.values(env)) if (value && value.length > 40) assert.ok(!error.reason.includes(value), "no key material in reason");
    return true;
  });
};

test("backend identity: canonical project only, consistent URL and keys", () => {
  assert.deepEqual(APPROVED_PROJECT_REFS, ["gohczmqykjkrgdblgbog"]);
  assert.deepEqual(resolveBackendIdentity(good, { requireServiceKey: true }), {
    mode: "canonical", projectRef: REF, url: `https://${REF}.supabase.co`,
  });
  assert.equal(resolveBackendIdentity({ ...good, NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co/` }).projectRef, REF);
  // New-format keys carry no claims: URL + expected ref still decide; a foreign key is rejected by the project itself.
  assert.equal(resolveBackendIdentity({ ...good, NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_x", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x" }).projectRef, REF);
});

test("backend identity: wrong, retired or unbound configurations are refused before any client exists", () => {
  refused({ ...good, FITMATCH_EXPECTED_SUPABASE_REF: undefined }, /not set/);
  refused({ ...good, NEXT_PUBLIC_SUPABASE_URL: undefined }, /URL is not set/);
  refused({ ...good, NEXT_PUBLIC_SUPABASE_URL: `https://${OTHER}.supabase.co` }, /not the expected project/);
  refused({ ...good, NEXT_PUBLIC_SUPABASE_URL: `http://${REF}.supabase.co` }, /not the expected project/);
  refused({ ...good, NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co.evil.example` }, /not the expected project/);
  refused({ ...good, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }, /not the expected project/, {});
  refused({ ...good, FITMATCH_EXPECTED_SUPABASE_REF: OTHER, NEXT_PUBLIC_SUPABASE_URL: `https://${OTHER}.supabase.co` }, /approved/);
  refused({ ...good, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ ref: OTHER, role: "anon" }) }, /public key/);
  refused({ ...good, SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: OTHER, role: "service_role" }) }, /server key/);
  refused({ ...good, SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: REF, role: "anon" }) }, /server key/);
  refused({ ...good, SUPABASE_SERVICE_ROLE_KEY: undefined }, /server key is not set/, { requireServiceKey: true });
  refused({ ...good, FITMATCH_BACKEND_MODE: "staging" }, /unknown/);
  // smoke-supabase is refused in every position and mode, even when the configuration is self-consistent.
  const smoke = { NEXT_PUBLIC_SUPABASE_URL: `https://${SMOKE}.supabase.co`, FITMATCH_EXPECTED_SUPABASE_REF: SMOKE,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ ref: SMOKE, role: "anon" }) };
  refused(smoke, /retired/);
  refused({ ...good, SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: SMOKE, role: "service_role" }) }, /retired/);
  refused({ ...smoke, FITMATCH_BACKEND_MODE: "isolated-test" }, /retired/);
});

test("backend identity: isolated-test mode is loopback only and never a cloud project", () => {
  const local = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", FITMATCH_BACKEND_MODE: "isolated-test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service" };
  assert.deepEqual(resolveBackendIdentity(local), { mode: "isolated-test", projectRef: "isolated-test", url: "http://127.0.0.1:54321" });
  assert.equal(resolveBackendIdentity({ ...local, NEXT_PUBLIC_SUPABASE_URL: "http://localhost:9" }).mode, "isolated-test");
  refused({ ...local, NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co` }, /loopback/);
  refused({ ...local, NEXT_PUBLIC_SUPABASE_URL: "https://staging.example" }, /loopback/);
});

test("backend identity: admin client and the worker route refuse writes, enrollment and claims on a wrong project", async () => {
  const saved = { ...process.env };
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => { calls.push(String(input)); throw new Error("network must not be used"); }) as typeof fetch;
  try {
    Object.assign(process.env, good, { NEXT_PUBLIC_SUPABASE_URL: `https://${OTHER}.supabase.co` });
    const { createAdminClient } = await import("../src/lib/supabase/admin");
    assert.throws(() => createAdminClient(), BackendIdentityError);
    // The route is server-only: run it in a child with the react-server condition, fetch counted there.
    const { spawnSync } = await import("node:child_process");
    const probe = `
      const calls = [];
      globalThis.fetch = async (u) => { calls.push(String(u)); throw new Error("no network"); };
      const route = await import("./src/app/api/v2/[...path]/route.ts");
      const out = [];
      for (const path of [["worker", "heartbeat"], ["worker", "claim"]]) {
        const res = await route.POST(new Request("https://fitmatch.example/api/v2/" + path.join("/"), {
          method: "POST", headers: { authorization: "Bearer fmw_" + "a".repeat(43), "content-type": "application/json" }, body: "{}" }),
          { params: Promise.resolve({ path }) });
        out.push([res.status, (await res.json()).error]);
      }
      console.log(JSON.stringify({ out, calls }));`;
    const child = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "--input-type=module", "-e", probe], {
      env: { ...process.env }, encoding: "utf8",
    });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout.trim().split("\n").pop()!);
    assert.deepEqual(result.out, [[503, "BACKEND_IDENTITY_MISMATCH"], [503, "BACKEND_IDENTITY_MISMATCH"]]);
    assert.deepEqual(result.calls, [], "worker auth never queried the wrong project");
    // Operator enrollment script uses the same rule before any write.
    const r = spawnSync(process.execPath, ["scripts/worker/manage.mjs", "create", "00000000-0000-4000-a000-000000000001", "garment.analyze"], {
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `https://${SMOKE}.supabase.co` }, encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /BACKEND_IDENTITY_MISMATCH|retired/);
    assert.doesNotMatch(r.stdout, /fmw_/, "no worker token minted");
    for (const script of ["scripts/source-cleanup.mjs", "scripts/gc-dry-run.mjs"]) {
      const op = spawnSync(process.execPath, [script, "--execute"], {
        env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `https://${SMOKE}.supabase.co`, SUPABASE_URL: undefined }, encoding: "utf8",
      });
      assert.equal(op.status, 5, script + op.stderr);
      assert.match(op.stderr, /BACKEND_IDENTITY_MISMATCH: retired/);
    }
    assert.deepEqual(calls, [], "no request left the process");
  } finally {
    globalThis.fetch = realFetch;
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
