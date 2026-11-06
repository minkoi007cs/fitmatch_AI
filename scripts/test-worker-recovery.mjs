/** R1 recovery: real Next route handlers + real SQL + the real Python worker, with a fault-injecting
 * proxy between worker and app. Synthetic triangle GLB and a counting adapter; no inference quality claim. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { mesh } from "../tests/fixtures/mesh.mjs";

const KIND = "avatar.reconstruct";
const ENGINE = { model: "synthetic-fixture", revision: "r1-test" };

function faultProxy(base) {
  const rules = [];
  const seen = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const path = new URL(req.url, "http://x").pathname;
    const action = path.replace(/^\/api\/v2\/worker\//, "").replace(/^jobs\/[^/]+\//, "");
    seen.push(action);
    const rule = rules.find((r) => r.match.test(path) && r.times > 0);
    if (rule) rule.times--;
    if (rule?.action === "fail-before") {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "INJECTED_OUTAGE" }));
      return;
    }
    const upstream = await fetch(base + req.url, {
      method: req.method,
      headers: {
        authorization: req.headers.authorization ?? "",
        "content-type": req.headers["content-type"] ?? "application/json",
      },
      body: req.method === "GET" ? undefined : body,
    });
    let out = Buffer.from(await upstream.arrayBuffer());
    if (rule?.action === "drop-after") {
      if (rule.onlyWithBody && upstream.status !== 200) rule.times++;
      else {
        req.socket.destroy(); // the server committed; the worker never sees the reply
        return;
      }
    }
    if (rule?.action === "mutate" && upstream.status === 200)
      out = Buffer.from(JSON.stringify(rule.mutate(JSON.parse(out))));
    res.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") ?? "application/json" });
    res.end(out);
  });
  return {
    rules,
    seen,
    async listen() {
      await new Promise((r) => server.listen(0, "127.0.0.1", r));
      return `http://127.0.0.1:${server.address().port}`;
    },
    close: () => new Promise((r) => server.close(r)),
  };
}

function runWorker(config, token, extraEnv = {}, { background = false, script = "scripts/worker/worker.py" } = {}) {
  const child = spawn("python3", ["-I", resolve(script), "--config", config, "--once"], {
    env: { ...process.env, FITMATCH_WORKER_TOKEN: token, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  child.stdout.on("data", (d) => (stdout += d));
  child.stderr.on("data", (d) => (stdout += d));
  const done = new Promise((res, rej) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rej(new Error("worker timed out:\n" + stdout));
    }, 90_000);
    child.on("exit", (code, sig) => {
      clearTimeout(timer);
      res({ code, sig, stdout });
    });
  });
  return background ? { child, done, out: () => stdout } : done;
}

export async function testWorkerRecovery({ base, request, owner, v2 }) {
  const temp = await mkdtemp(join(tmpdir(), "fitmatch-r1-"));
  const proxy = faultProxy(base);
  const proxyUrl = await proxy.listen();
  const post = (path, body, headers = {}) =>
    request("/api/v2/" + path, { method: "POST", body: JSON.stringify(body), headers });
  const q = (s) => v2.sql(s);
  try {
    // Three verified source photos shared by every synthetic avatar job.
    const photo = await sharp({ create: { width: 640, height: 640, channels: 3, background: "#998877" } }).png().toBuffer();
    const assets = [];
    for (let i = 0; i < 3; i++) {
      const intent = await (await post("assets/upload-intent", { kind: "photo", bytes: photo.length })).json();
      assert.equal((await fetch(intent.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: photo })).status, 200);
      assert.equal((await post(`assets/${intent.assetId}/finalize`, {})).status, 200);
      assets.push(intent.assetId);
    }
    let seq = 0;
    const newJob = async () => {
      const r = await post("models", { kind: "avatar", name: "R1 synthetic " + ++seq, heightCm: 170, inputAssetIds: assets },
        { "Idempotency-Key": "r1-recovery-" + String(seq).padStart(4, "0") });
      assert.equal(r.status, 202, await r.clone().text());
      return (await r.json()).jobId;
    };
    const job = (id) => {
      const [state, attempt, error] = q(`select state,attempt,coalesce(error_code,'') from fm_v2_jobs where id='${id}';`).split("|");
      return { state, attempt: Number(attempt), error };
    };
    const glbCount = (id) => Number(q(`select count(*) from fm_v2_assets where job_id='${id}' and kind='glb' and state<>'rejected';`));
    const receipts = (id) => Number(q(`select count(*) from fm_v2_job_receipts where job_id='${id}';`));

    // Counting adapter: proves inference invocations, and that no secret reaches the adapter environment.
    const adapter = join(temp, "adapter.mjs");
    await writeFile(
      adapter,
      `import{readFileSync,writeFileSync,appendFileSync}from'node:fs';
const [input,output,counter,mode]=process.argv.slice(2);
appendFileSync(counter,'x');
const secret=Object.keys(process.env).filter(k=>/TOKEN|SECRET|API_?KEY|PASSW|SERVICE_?ROLE/i.test(k)||String(process.env[k]).includes('fmw_'));
if(secret.length&&mode!=='legacy'){console.error('secret leaked',secret);process.exit(9);}
JSON.parse(readFileSync(input,'utf8'));
const fail=(code,exit)=>{process.stderr.write(JSON.stringify({success:false,code,reason:'synthetic'})+String.fromCharCode(10));process.exit(exit);};
if(mode==='disabled')fail('MODEL_UNAVAILABLE',78);
if(mode==='invalid')fail('INVALID_INPUT',2);
if(mode==='usage'){process.stderr.write('usage: adapter --input INPUT --output OUTPUT'+String.fromCharCode(10));process.exit(2);}
if(mode==='oom')fail('OOM',3);
if(mode==='sleep'){await new Promise(r=>setTimeout(r,30000));}
if(mode==='slow'){await new Promise(r=>setTimeout(r,4000));}
writeFileSync(output,Buffer.from('${mesh([0.2, 0.6, 0.4, 1]).toString("base64")}','base64'));`,
    );
    let n = 0;
    const setup = async ({ mode = "ok", retry = { attempts: 3, baseSeconds: 0.05, maxSeconds: 0.2 }, timeoutSeconds = 60, allowed, workDir, exitCodes } = {}) => {
      const w = v2.worker(owner, allowed);
      const dir = workDir ?? join(temp, "work-" + ++n);
      const counter = join(temp, "count-" + n);
      const config = join(temp, "config-" + n + ".json");
      await writeFile(config, JSON.stringify({
        appUrl: proxyUrl, workDir: dir, heartbeatSeconds: 1, pollSeconds: 0.2, requestTimeoutSeconds: 10, retry,
        engines: { [KIND]: { ...ENGINE, timeoutSeconds, ...(exitCodes ? { exitCodes } : {}), command: [process.execPath, adapter, "{input}", "{output}", counter, mode] } },
      }));
      const count = async () => (existsSync(counter) ? (await readFile(counter, "utf8")).length : 0);
      return { ...w, dir, config, count, env: { MY_API_KEY: "should-not-leak", OTHER_VALUE: w.token } };
    };
    const reset = () => {
      proxy.rules.length = 0;
      proxy.seen.length = 0;
    };
    const fails = () => proxy.seen.filter((s) => s === "fail").length;

    // S1 complete committed, reply lost -> idempotent replay, one inference, one receipt, no fail.
    reset();
    let w = await setup();
    let id = await newJob();
    proxy.rules.push({ match: /\/complete$/, times: 1, action: "drop-after" });
    let r = await runWorker(w.config, w.token, w.env);
    assert.match(r.stdout, /Completed job/, r.stdout);
    assert.deepEqual(job(id), { state: "succeeded", attempt: 1, error: "" });
    assert.equal(await w.count(), 1, "S1 inference count");
    assert.equal(receipts(id), 1);
    assert.ok(proxy.seen.filter((s) => s === "complete").length >= 2);
    assert.equal(fails(), 0, "no fail after a finalized output");

    // S2 complete never reaches the server (outage) -> retried, never failed.
    reset();
    w = await setup();
    id = await newJob();
    proxy.rules.push({ match: /\/complete$/, times: 2, action: "fail-before" });
    r = await runWorker(w.config, w.token, w.env);
    assert.deepEqual(job(id), { state: "succeeded", attempt: 1, error: "" }, r.stdout);
    assert.equal(await w.count(), 1);
    assert.equal(fails(), 0);

    // S3 finalize committed, reply lost -> finalize replay returns ready, then complete.
    reset();
    w = await setup();
    id = await newJob();
    proxy.rules.push({ match: /\/finalize$/, times: 1, action: "drop-after" });
    r = await runWorker(w.config, w.token, w.env);
    assert.deepEqual(job(id), { state: "succeeded", attempt: 1, error: "" }, r.stdout);
    assert.equal(glbCount(id), 1, "one logical output");
    assert.equal(fails(), 0);

    // S4 upload stored but reply lost, then an expired upload URL -> same logical asset, verified once.
    reset();
    w = await setup();
    id = await newJob();
    v2.faults.uploadDropAfterStore = 1;
    v2.faults.uploadExpire = 0;
    r = await runWorker(w.config, w.token, w.env);
    assert.deepEqual(job(id), { state: "succeeded", attempt: 1, error: "" }, r.stdout);
    assert.equal(glbCount(id), 1);
    reset();
    w = await setup();
    id = await newJob();
    v2.faults.uploadExpire = 1;
    r = await runWorker(w.config, w.token, w.env);
    assert.deepEqual(job(id), { state: "succeeded", attempt: 1, error: "" }, r.stdout);
    assert.equal(glbCount(id), 1, "fresh URL for the same asset, not a new artifact");
    assert.equal(proxy.seen.filter((s) => s === "output-intent").length, 2);

    // S5 claim reply lost -> same instance gets the same assignment back, attempt unchanged.
    reset();
    w = await setup();
    id = await newJob();
    proxy.rules.push({ match: /\/worker\/claim$/, times: 1, action: "drop-after", onlyWithBody: true });
    r = await runWorker(w.config, w.token, w.env);
    assert.match(r.stdout, /same assignment again/, r.stdout);
    assert.deepEqual(job(id), { state: "succeeded", attempt: 1, error: "" });
    assert.equal(await w.count(), 1);

    // S6 worker restart while the lease is still valid -> resume with the original lease, no new inference.
    reset();
    w = await setup({ retry: { attempts: 2, baseSeconds: 0.05, maxSeconds: 0.1 } });
    id = await newJob();
    proxy.rules.push({ match: /\/complete$/, times: 100, action: "fail-before" });
    r = await runWorker(w.config, w.token, w.env);
    assert.match(r.stdout, /checkpoint kept/, r.stdout);
    assert.deepEqual(job(id), { state: "running", attempt: 1, error: "" });
    assert.equal(fails(), 0, "exhausted retries do not fail a finalized output");
    reset();
    r = await runWorker(w.config, w.token, w.env); // new process, new instance, same workDir
    assert.match(r.stdout, /reconciled|Resuming publish/, r.stdout);
    assert.deepEqual(job(id), { state: "succeeded", attempt: 1, error: "" });
    assert.equal(await w.count(), 1, "S6 no second inference");

    // S7 restart after the lease was lost -> reclaimed as attempt 2, verified output reused, stale token refused.
    reset();
    w = await setup({ retry: { attempts: 2, baseSeconds: 0.05, maxSeconds: 0.1 } });
    id = await newJob();
    proxy.rules.push({ match: /\/complete$/, times: 100, action: "fail-before" });
    await runWorker(w.config, w.token, w.env);
    const oldToken = q(`select lease_token from fm_v2_jobs where id='${id}';`);
    const oldAsset = q(`select id from fm_v2_assets where job_id='${id}' and kind='glb' and state='ready';`);
    q(`update fm_v2_jobs set lease_until=now()-interval '1 second' where id='${id}';`);
    reset();
    r = await runWorker(w.config, w.token, w.env);
    assert.match(r.stdout, /Reusing verified output/, r.stdout);
    assert.deepEqual(job(id), { state: "succeeded", attempt: 2, error: "" });
    assert.equal(await w.count(), 1, "S7 inference count stays 1 across lease loss + restart");
    assert.equal(glbCount(id), 1);
    const stale = await fetch(base + `/api/v2/worker/jobs/${id}/complete`, {
      method: "POST", headers: { Authorization: "Bearer " + w.token, "Content-Type": "application/json" },
      body: JSON.stringify({ leaseToken: oldToken, assetId: oldAsset }),
    });
    assert.equal(stale.status, 409, "stale lease cannot publish");

    // S8 engine revision mismatch -> MODEL_UNAVAILABLE immediately, no inference, job not left running.
    reset();
    w = await setup();
    id = await newJob();
    proxy.rules.push({ match: /\/worker\/claim$/, times: 1, action: "mutate", mutate: (j) => ({ ...j, modelRevision: { ...j.modelRevision, revision: "other" } }) });
    r = await runWorker(w.config, w.token, w.env);
    assert.deepEqual(job(id), { state: "failed", attempt: 1, error: "MODEL_UNAVAILABLE" }, r.stdout);
    assert.equal(await w.count(), 0);

    // S9 adapter exit classification against the PC adapter contract (draft PR1): exit 78 + JSON
    // MODEL_UNAVAILABLE, exit 2 + JSON INVALID_INPUT, argparse usage -> INFERENCE_FAILED, unconfigured
    // exit 3 -> INFERENCE_FAILED, operator-configured exit 3 -> OOM, parent time limit -> TIMEOUT.
    for (const [mode, expected, extra] of [
      ["disabled", "MODEL_UNAVAILABLE"],
      ["invalid", "INVALID_INPUT"],
      ["usage", "INFERENCE_FAILED"],
      ["oom", "INFERENCE_FAILED"],
      ["oom", "OOM", { exitCodes: { 3: "OOM" } }],
      ["sleep", "TIMEOUT", { timeoutSeconds: 1 }],
    ]) {
      reset();
      w = await setup({ mode, ...(extra ?? {}) });
      id = await newJob();
      r = await runWorker(w.config, w.token, w.env);
      assert.deepEqual(job(id), { state: "failed", attempt: 1, error: expected }, mode + ": " + r.stdout);
      assert.equal(glbCount(id), 0, "no output published on failure");
    }

    // S10 grants: declared but not granted is neither advertised nor claimable.
    reset();
    w = await setup({ allowed: [] });
    id = await newJob();
    const hb = await fetch(base + "/api/v2/worker/heartbeat", {
      method: "POST", headers: { Authorization: "Bearer " + w.token, "Content-Type": "application/json" },
      body: JSON.stringify({ capabilities: { [KIND]: ENGINE } }),
    });
    assert.deepEqual((await hb.json()).grantedCapabilities, []);
    const status = await (await request("/api/v2/compute/status")).json();
    const mine = status.workers.filter((e) => e.online && Object.keys(e.capabilities).length === 0);
    assert.ok(mine.length >= 1, "ungranted worker reports no capability");
    const claim = await fetch(base + "/api/v2/worker/claim", {
      method: "POST", headers: { Authorization: "Bearer " + w.token, "Content-Type": "application/json" }, body: "{}",
    });
    assert.equal(claim.status, 204);
    q(`update fm_v2_workers set allowed_capabilities='{${KIND}}' where id='${w.workerId}';`);
    r = await runWorker(w.config, w.token, w.env);
    assert.deepEqual(job(id), { state: "succeeded", attempt: 1, error: "" }, r.stdout);

    // S11 crash during inference: orphaned adapter keeps the workDir lock, so no second inference starts;
    // the interrupted output is never trusted and the job runs again only after the lease is gone.
    reset();
    w = await setup({ mode: "slow" });
    id = await newJob();
    const a = runWorker(w.config, w.token, w.env, { background: true });
    for (let i = 0; i < 100 && (await w.count()) === 0; i++) await new Promise((res) => setTimeout(res, 100));
    assert.equal(await w.count(), 1);
    a.child.kill("SIGKILL"); // worker dies, adapter (own session) survives
    await a.done;
    const blocked = await runWorker(w.config, w.token, w.env);
    assert.equal(blocked.code, 2, blocked.stdout);
    assert.match(blocked.stdout, /orphaned adapter still holds/);
    await new Promise((res) => setTimeout(res, 4500)); // orphan finishes and releases the lock
    q(`update fm_v2_jobs set lease_until=now()-interval '1 second' where id='${id}';`);
    r = await runWorker(w.config, w.token, w.env);
    assert.deepEqual(job(id), { state: "succeeded", attempt: 2, error: "" }, r.stdout);
    assert.equal(await w.count(), 2, "no trusted output existed, so the model ran once more");

    // Optional: a pre-R1 worker.py (path in R1_LEGACY_WORKER) still completes a job against this server.
    if (process.env.R1_LEGACY_WORKER) {
      reset();
      w = await setup({ mode: "legacy" });
      id = await newJob();
      r = await runWorker(w.config, w.token, {}, { script: process.env.R1_LEGACY_WORKER });
      assert.match(r.stdout, /Completed job/, r.stdout);
      assert.deepEqual(job(id), { state: "succeeded", attempt: 1, error: "" });
      console.log("PASS R1 compatibility: legacy worker.py completes a job (legacy output-intent, granted capability).");
    }

    // S12 operator CLI: create with grants, ungrant/grant, rotate (old token stops), revoke.
    const manage = (...args) =>
      new Promise((res, rej) => {
        const c = spawn(process.execPath, [resolve("scripts/worker/manage.mjs"), ...args], {
          env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3221", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service" },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let out = "";
        c.stdout.on("data", (d) => (out += d));
        c.stderr.on("data", (d) => (out += d));
        c.on("exit", (code) => (code === 0 ? res(out) : rej(new Error("manage failed: " + out))));
      });
    const created = JSON.parse(await manage("create", owner, KIND));
    assert.deepEqual(created.allowedCapabilities, [KIND]);
    const hbWith = async (token) =>
      fetch(base + "/api/v2/worker/heartbeat", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ capabilities: { [KIND]: ENGINE } }),
      });
    assert.deepEqual((await (await hbWith(created.token)).json()).grantedCapabilities, [KIND]);
    await manage("ungrant", owner, created.workerId, KIND);
    assert.deepEqual((await (await hbWith(created.token)).json()).grantedCapabilities, []);
    await manage("grant", owner, created.workerId, KIND);
    await assert.rejects(manage("grant", owner, created.workerId, "evil.kind"));
    const rotated = JSON.parse(await manage("rotate", owner, created.workerId));
    assert.equal((await hbWith(created.token)).status, 401, "old token stops after rotate");
    assert.equal((await hbWith(rotated.token)).status, 200);
    await manage("revoke", owner, created.workerId);
    assert.equal((await hbWith(rotated.token)).status, 401);

    console.log(
      "PASS R1 worker recovery (real routes + SQL + Python worker): complete/finalize reply loss and outage, upload outcome unknown and expired URL, claim reply loss redelivered, restart within lease, restart after lease loss reusing output (stale token 409), MODEL_UNAVAILABLE, adapter contract exit78/exit2+JSON/usage/configured OOM/TIMEOUT, default-deny grants, operator create/grant/ungrant/rotate/revoke, crash during inference guarded by workDir lock, no secrets in adapter env. Synthetic geometry only.",
    );
  } finally {
    await proxy.close();
    await rm(temp, { recursive: true, force: true });
  }
}
