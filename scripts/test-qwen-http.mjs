/**
 * QINT-C garment analysis through the real routes + PostgreSQL + browser + the real worker.py.
 * The adapter is a CPU MOCK (scripts/fixtures/mock_qwen_adapter.py): this proves app/queue/worker
 * plumbing and human review, NOT Qwen quality, real GPU timing or native Windows behaviour.
 */
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { collectSourceCleanup } from "./source-cleanup.mjs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";
import { analysisResult } from "../src/lib/v2/qwen.ts";

const jpeg = (rgb) =>
  sharp({ create: { width: 400, height: 480, channels: 3, background: rgb } }).jpeg().toBuffer();

export async function testQwen({ base, fixture, request, jar, owner, itemId, v2, asSecond }) {
  const temp = await mkdtemp(join(tmpdir(), "fitmatch-qwen-"));
  // QREV-LOCK + QREV-BIND-02: the integrated worker is bound to a PC3D coordinator policy that pins the
  // canonical lock's file identity and the guard. Synthetic workspace in a temp dir, written with the PC3D
  // helper (the real PC paths/guard/policy hash are ACKed by PC3D separately).
  const gpuWs = join(temp, "Fitmatch-GPU"), coordination = join(gpuWs, "coordination");
  const lockPath = join(coordination, "gpu0.lock"), slotPath = join(coordination, "gpu0-slot.json");
  const guardPath = join(gpuWs, "fitmatch_AI", "workers", "windows", "gpu_guard.py");
  await mkdir(coordination, { recursive: true });
  await mkdir(dirname(guardPath), { recursive: true });
  await writeFile(lockPath, "0");
  await writeFile(guardPath, "# synthetic guard for the HTTP test\n");
  const guardSha = createHash("sha256").update(await readFile(guardPath)).digest("hex");
  const policy = JSON.parse((await promisify(execFile)("python3", [resolve("scripts/worker/gpu_coordinator_policy.py"), "write",
    "--workspace", gpuWs, "--expected-guard-sha256", guardSha])).stdout);
  const writeSlot = async (owner) => {
    const issued = Math.floor(Date.now() / 1000);
    await writeFile(slotPath, JSON.stringify({ version: 1, owner, issuedAtUtc: new Date(issued * 1000).toISOString(),
      issuedAtUnix: issued, admitUntilUnix: issued + 1800, policy: "http-test" }));
  };
  await writeSlot("pc-ai");
  const holdLock = async () => {
    const child = spawn("python3", ["-c",
      "import fcntl,sys,time;f=open(sys.argv[1],'r+');fcntl.flock(f.fileno(),fcntl.LOCK_EX);print('held',flush=True);time.sleep(120)", lockPath]);
    await new Promise((ok) => child.stdout.once("data", ok));
    return () => new Promise((ok) => { child.once("exit", ok); child.kill(); });
  };
  let backendRef = "isolated-test";
  const runWorker = async (token, mode) => {
    const config = join(temp, "config.json");
    await writeFile(config, JSON.stringify({
      appUrl: base, workDir: join(temp, "data"), pollSeconds: 1, gpuSlotOwner: "pc-ai",
      gpuCoordinator: { path: policy.policy, sha256: policy.sha256 },
      expectedBackend: { projectRef: backendRef, appOrigin: new URL(base).origin },
      engines: { "garment.analyze": { model: "mock/qwen-cpu", revision: "test-only",
        command: ["python3", resolve("scripts/fixtures/mock_qwen_adapter.py"), "{input}", "{output}"], timeoutSeconds: 60 } },
    }));
    return (await promisify(execFile)("python3", [resolve("scripts/worker/worker.py"), "--config", config, "--once"],
      { env: { ...process.env, FITMATCH_WORKER_TOKEN: token, FAKE_QWEN_MODE: mode }, timeout: 60000 })).stdout;
  };
  const browser = await chromium.launch({ headless: true });
  try {
    v2.sql(`update fm_v2_workers set enabled=false where user_id='${owner}';`);
    const listed = await (await request("/api/v2/analyses")).json();
    assert.equal(listed.enabled, true, "test server runs with QWEN_ANALYSIS_ENABLED=1");
    // Owned item with a photo (mock wardrobe API row + the PostgreSQL row the RPCs check).
    const path1 = `${owner}/tee-red.jpg`;
    v2.putObject(`fitmatch-wardrobe/${path1}`, await jpeg({ r: 200, g: 30, b: 30 }));
    assert.equal((await request(`/api/wardrobe/${itemId}`, { method: "PATCH", body: JSON.stringify({ imagePath: path1 }) })).status, 200);
    v2.sql(`update fm_wardrobe_items set image_path='${path1}', category='shirt', color='white' where id='${itemId}';`);
    const item = (await (await request("/api/wardrobe")).json()).items.find((i) => i.id === itemId);
    assert.equal(item.image_path, path1);
    // No worker granted yet: a 3D worker exists but never claims analysis.
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: base })));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/wardrobe");
    const panel = page.getByRole("group", { name: `AI analysis for ${item.name}` });
    // CL-UX-47: after the user's own action replaces the panel content, focus stays on the panel; state screenshots.
    const panelFocused = () => page.evaluate((name) => document.activeElement?.getAttribute("aria-label") === name, `AI analysis for ${item.name}`);
    const shot = async (state) => { await mkdir("test-results", { recursive: true }); await panel.screenshot({ path: `test-results/qint-state-${state}.png` }); };
    await shot("idle");
    await panel.getByRole("button", { name: "Analyze with AI" }).click();
    // No worker granted for analysis is online: say so instead of pretending it is about to run.
    await panel.getByText("Your PC is offline", { exact: false }).waitFor();
    assert.equal(await panelFocused(), true, "focus moves to the panel after Analyze replaces the button");
    await shot("offline");
    assert.equal((await (await request("/api/v2/analyses")).json()).workerOnline, false);
    const a = JSON.parse(v2.sql(`select row_to_json(t) from (select id,status,image_asset_id,image_sha256,source_path from fm_v2_analyses where user_id='${owner}' and item_id='${itemId}') t;`));
    assert.equal(a.status, "pending");
    assert.equal(a.source_path, path1);
    assert.ok(v2.hasObject(`${owner}/analysis/${a.image_asset_id}.jpg`), "immutable private snapshot stored");
    assert.equal(v2.sql(`select state||':'||kind||':'||attempt from fm_v2_jobs where analysis_id='${a.id}';`), "queued:garment.analyze:0");
    // Duplicate request: same analysis, no second job or snapshot.
    const dup = await request("/api/v2/analyses", { method: "POST", body: JSON.stringify({ itemId }) });
    assert.equal(dup.status, 200);
    assert.equal((await dup.json()).analysis.id, a.id);
    assert.equal(v2.sql(`select count(*) from fm_v2_jobs where analysis_id is not null and user_id='${owner}';`), "1");
    // Jobs list of the 3D pages does not show analysis jobs; 3D job actions refuse them.
    assert.ok(!(await (await request("/api/v2/jobs")).json()).jobs.some((j) => j.kind === "garment.analyze"));
    const jobId = v2.sql(`select id from fm_v2_jobs where analysis_id='${a.id}';`);
    assert.equal((await request(`/api/v2/jobs/${jobId}/retry`, { method: "POST", body: "{}" })).status, 409);

    // QREV-STATUS: the shared GPU lock is held by other work on the PC. The worker claims nothing, reports
    // "busy" in its heartbeat and the owner sees a truthful message; no attempt or deferral is consumed.
    const { token } = v2.worker(owner, ["garment.analyze"]);
    // ENV-CANON-01: a worker enrolled for the canonical project refuses an app bound to another backend
    // (here the isolated test server) before any claim, spawn or GPU work.
    backendRef = "gohczmqykjkrgdblgbog";
    const mismatch = await runWorker(token, "proposal").then(() => null, (error) => error);
    backendRef = "isolated-test";
    assert.equal(mismatch?.code, 5, String(mismatch?.stdout));
    assert.match(mismatch.stdout, /different backend than this worker is bound to/);
    assert.doesNotMatch(mismatch.stdout, /Claim reply|Completed|Reported failure|running adapter/);
    assert.equal(v2.sql(`select state||':'||attempt||':'||deferrals from fm_v2_jobs where id='${jobId}';`), "queued:0:0", "nothing claimed on backend mismatch");
    const release = await holdLock();
    let out;
    try {
      out = await runWorker(token, "proposal");
    } finally {
      await release();
    }
    assert.match(out, /GPU is busy/);
    assert.equal(v2.sql(`select state||':'||attempt||':'||deferrals from fm_v2_jobs where id='${jobId}';`), "queued:0:0", "nothing claimed while busy");
    let status = await (await request("/api/v2/analyses")).json();
    assert.deepEqual([status.workerOnline, status.gpuBusy], [true, true]);
    await panel.getByText("Your PC's GPU is busy with another task", { exact: false }).waitFor({ timeout: 15000 });
    await shot("queued-gpu-busy");
    await asSecond(async (req2) => {
      const other = await (await req2("/api/v2/analyses")).json();
      assert.deepEqual([other.workerOnline, other.gpuBusy], [false, false], "another owner never sees this PC's GPU state");
    });
    // QREV-LOCK end to end: the slot belongs to PC3D -> refused before any claim, also shown as busy.
    await writeSlot("pc-3d");
    out = await runWorker(token, "proposal");
    assert.match(out, /GPU admission refused, not claiming: GPU slot is assigned to another owner/);
    assert.equal(v2.sql(`select state||':'||attempt||':'||deferrals from fm_v2_jobs where id='${jobId}';`), "queued:0:0");
    assert.equal((await (await request("/api/v2/analyses")).json()).gpuBusy, true);
    await writeSlot("pc-ai");

    // Worker run with the slot granted: adapter reports GPU busy -> deferred, attempt not consumed, UI says so.
    out = await runWorker(token, "gpu_busy");
    assert.doesNotMatch(out, /Completed/);
    assert.equal(v2.sql(`select state||':'||attempt||':'||deferrals||':'||error_code from fm_v2_jobs where id='${jobId}';`), "queued:0:1:GPU_BUSY");
    await panel.getByText("Your PC's GPU is busy", { exact: false }).waitFor({ timeout: 15000 });
    // Lock released after the owned adapter tree drained.
    const probe = await promisify(execFile)("python3", ["-c",
      "import fcntl,sys;f=open(sys.argv[1],'a+');fcntl.flock(f.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB);print('free')", lockPath]);
    assert.equal(probe.stdout.trim(), "free");
    status = await (await request("/api/v2/analyses")).json();
    assert.deepEqual([status.workerOnline, status.gpuBusy], [true, false], "granted worker heartbeat seen; GPU no longer busy");
    // Memory admission refused before load: same bounded deferral, distinct message.
    v2.sql(`update fm_v2_jobs set not_before=now() where id='${jobId}';`);
    out = await runWorker(token, "memory");
    assert.equal(v2.sql(`select state||':'||attempt||':'||deferrals||':'||error_code from fm_v2_jobs where id='${jobId}';`), "queued:0:2:MEMORY_PRESSURE");
    await panel.getByText("Your PC has limited free memory", { exact: false }).waitFor({ timeout: 15000 });
    await shot("memory-pressure");
    // 2nd account: sees nothing of this owner's analyses and cannot act on them over HTTP.
    await asSecond(async (req2, owner2) => {
      assert.notEqual(owner2, owner);
      const list = await (await req2("/api/v2/analyses")).json();
      assert.deepEqual(list.analyses, [], "foreign analyses never listed");
      assert.equal(list.workerOnline, false, "another owner's worker does not count");
      for (const action of ["cancel", "retry"])
        assert.equal((await req2(`/api/v2/analyses/${a.id}/${action}`, { method: "POST", body: "{}" })).status, 404, action);
      const foreignConfirm = await req2(`/api/v2/analyses/${a.id}/confirm`, { method: "POST", body: JSON.stringify({
        confirmationId: "99999999-8888-4777-8666-555555555555", expectedResultSha256: "0".repeat(64), decision: "reject", fields: {} }) });
      assert.equal(foreignConfirm.status, 404);
      assert.equal((await req2(`/api/v2/jobs/${jobId}/retry`, { method: "POST", body: "{}" })).status, 409, "foreign job action refused");
    });
    assert.equal(v2.sql(`select state||':'||deferrals from fm_v2_jobs where id='${jobId}';`), "queued:2", "foreign calls changed nothing");
    // 3rd run after backoff: proposal stored for review, wardrobe untouched until the human confirms.
    v2.sql(`update fm_v2_jobs set not_before=now() where id='${jobId}';`);
    out = await runWorker(token, "proposal");
    assert.match(out, /Completed analysis job/);
    const stored = JSON.parse(v2.sql(`select row_to_json(t) from (select status,result_json,result_sha256,result_lease_token from fm_v2_analyses where id='${a.id}') t;`));
    assert.equal(stored.status, "review");
    assert.ok(analysisResult.safeParse(JSON.parse(stored.result_json)).success);
    assert.equal(v2.sql(`select attempt from fm_v2_jobs where id='${jobId}';`), "1", "one real inference attempt");
    assert.equal(v2.sql(`select category||':'||color from fm_wardrobe_items where id='${itemId}';`), "shirt:white", "AI never writes the wardrobe");
    // Lost reply: identical result replay is accepted without changing anything.
    const replay = await fetch(base + `/api/v2/worker/jobs/${jobId}/result`, {
      method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ leaseToken: stored.result_lease_token, sha256: stored.result_sha256, resultJson: stored.result_json }) });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).replay, true);

    await panel.getByText("AI suggestion", { exact: false }).waitFor({ timeout: 15000 });
    assert.equal(await panel.getByLabel("Category").inputValue(), "tshirt");
    assert.equal(await panel.getByLabel("Main color").inputValue(), "red");
    assert.equal(await panel.getByLabel("Secondary color").inputValue(), "white");
    assert.equal(await panel.getByLabel("Pattern", { exact: true }).inputValue(), "printed");
    assert.equal(await panel.getByLabel("Garment text / logo").inputValue(), "", "OCR candidate is not pre-approved");
    await panel.getByText("unconfirmed", { exact: false }).waitFor();
    await page.screenshot({ path: "test-results/qint-review.png" });
    await panel.getByText("Nothing changes in your wardrobe until you choose Save to wardrobe", { exact: false }).waitFor();
    await panel.getByRole("button", { name: "Use detected text “FITMATCH”", exact: true }).waitFor();
    assert.ok((await panel.getByRole("button", { name: "Save to wardrobe" }).boundingBox()).height >= 36, "touch target at least 36 px");
    await shot("review");
    const reviewViewport = page.viewportSize();
    for (const width of [320, 390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `review fits ${width}px`);
      const box = await panel.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `review panel inside the viewport at ${width}px`);
      for (const name of ["Save to wardrobe", "Dismiss"]) {
        const b = await panel.getByRole("button", { name, exact: true }).boundingBox();
        assert.ok(b.x >= box.x - 1 && b.x + b.width <= box.x + box.width + 1, `${name} not clipped by the panel at ${width}px`);
      }
      await panel.screenshot({ path: `test-results/qint-review-${width}.png` });
    }
    await page.setViewportSize(reviewViewport);
    await panel.getByLabel("Secondary color").selectOption("");
    await panel.getByRole("button", { name: "Save to wardrobe" }).click();
    await panel.getByText("Saved with your confirmation", { exact: false }).waitFor();
    assert.equal(await panelFocused(), true, "focus stays on the panel after saving");
    await shot("confirmed");
    assert.equal(v2.sql(`select category||':'||color||':'||pattern||':'||coalesce(secondary_color,'-') from fm_wardrobe_items where id='${itemId}';`), "t-shirt:red:graphic:-", "only reviewed values written; cleared secondary not invented");
    assert.equal(v2.sql(`select status||':'||(confirmed_fields ? 'logoText') from fm_v2_analyses where id='${a.id}';`), "confirmed:false");
    await page.reload();
    await panel.getByText("Saved with your confirmation", { exact: false }).waitFor();
    // Asking again for the same photo reuses the confirmed analysis: no GPU, no new job.
    const again = await request("/api/v2/analyses", { method: "POST", body: JSON.stringify({ itemId }) });
    assert.equal((await again.json()).analysis.state, "confirmed");
    assert.equal(v2.sql(`select count(*) from fm_v2_jobs where analysis_id is not null and user_id='${owner}';`), "1");

    // QREV-SNAPSHOT / QREV-QUOTA through the real route. Each new photo gets its own private copy.
    const snapshotState = () => JSON.parse(v2.sql(`select coalesce(json_agg(json_build_object('path',a.path,'state',a.state,
      'cleanup',(select string_agg(c.state,',') from fm_v2_source_cleanup c where c.asset_id=a.id))),'[]') from fm_v2_assets a
      where a.user_id='${owner}' and a.path like '${owner}/analysis/%' and a.id not in (select image_asset_id from fm_v2_analyses);`));
    const setItemPhoto = async (name, rgb) => {
      const p = `${owner}/${name}.jpg`;
      v2.putObject(`fitmatch-wardrobe/${p}`, await jpeg(rgb));
      await request(`/api/wardrobe/${itemId}`, { method: "PATCH", body: JSON.stringify({ imagePath: p }) });
      v2.sql(`update fm_wardrobe_items set image_path='${p}' where id='${itemId}';`);
      return p;
    };
    const analysesBefore = v2.sql(`select count(*) from fm_v2_analyses where user_id='${owner}';`);
    // (a) Storage fails while uploading the snapshot: 503, no analysis, the reservation is tombstoned and
    // its removal recorded (nothing orphaned, nothing pending).
    await setItemPhoto("tee-green", { r: 20, g: 180, b: 40 });
    v2.faults.serverUploadFail = 1;
    let failed = await request("/api/v2/analyses", { method: "POST", body: JSON.stringify({ itemId }) });
    assert.equal(failed.status, 503);
    let orphans = snapshotState();
    assert.equal(orphans.length, 1);
    assert.deepEqual([orphans[0].state, orphans[0].cleanup, v2.hasObject(orphans[0].path)], ["deleted", "completed", false]);
    // (b) The item is edited while the snapshot uploads: enqueue refuses, the stored copy is removed now.
    v2.faults.beforeRpc.fm_v2_analysis_enqueue = `update fm_wardrobe_items set image_path='${owner}/edited-meanwhile.jpg' where id='${itemId}';`;
    failed = await request("/api/v2/analyses", { method: "POST", body: JSON.stringify({ itemId }) });
    assert.equal(failed.status, 404);
    assert.equal((await failed.json()).error, "ITEM_NOT_FOUND");
    orphans = snapshotState();
    assert.equal(orphans.length, 2);
    for (const o of orphans) assert.deepEqual([o.state, o.cleanup, v2.hasObject(o.path)], ["deleted", "completed", false], o.path);
    // (c) Queue full (20 active jobs, shared with 3D): 429 before any upload; nothing written.
    await setItemPhoto("tee-yellow", { r: 220, g: 210, b: 30 });
    v2.sql(`with m as (insert into fm_v2_models(id,user_id,kind,name) select gen_random_uuid(),'${owner}','avatar','qrev-filler'
      from generate_series(1,20 - (select count(*) from fm_v2_jobs where user_id='${owner}' and state in ('queued','running')))
      returning id) insert into fm_v2_jobs(id,user_id,model_id,kind,idempotency_key,payload_hash)
      select gen_random_uuid(),'${owner}',id,'avatar.reconstruct',id::text,id::text from m;`);
    const objectsBefore = snapshotState().length;
    const full = await request("/api/v2/analyses", { method: "POST", body: JSON.stringify({ itemId }) });
    assert.equal(full.status, 429);
    assert.equal((await full.json()).error, "QUOTA_EXCEEDED");
    assert.equal(snapshotState().length, objectsBefore, "quota refusal reserves and uploads nothing");
    v2.sql(`delete from fm_v2_jobs where model_id in (select id from fm_v2_models where name='qrev-filler'); delete from fm_v2_models where name='qrev-filler';`);
    assert.equal(v2.sql(`select count(*) from fm_v2_analyses where user_id='${owner}';`), analysesBefore, "no analysis from refused requests");

    // QREV-CLEANUP-RACE through the real route and the real collector (claim -> remove -> report).
    // Other tests' intents are parked for the duration so the collector only sees this owner's
    // analysis reservations; they are restored unchanged afterwards.
    const admin = createClient(fixture, "synthetic-service", { auth: { persistSession: false } });
    v2.sql(`update fm_v2_source_cleanup set next_attempt_at=next_attempt_at+interval '100 years'
      where state='pending' and path not like '${owner}/analysis/%';`);
    const collectNow = async () => {
      v2.sql(`update fm_v2_source_cleanup set next_attempt_at=now()-interval '1 second' where state='pending' and path like '${owner}/analysis/%';`);
      return collectSourceCleanup(admin, { execute: true });
    };
    // (d) Reviewer's interleaving, collector wins: it runs after the upload and before enqueue. The
    // claim fences the reservation, removes the object, and enqueue is refused (no published analysis
    // without its snapshot).
    await setItemPhoto("tee-cyan", { r: 10, g: 200, b: 210 });
    let pass;
    v2.faults.beforeRpc.fm_v2_analysis_enqueue = async () => { pass = await collectNow(); };
    failed = await request("/api/v2/analyses", { method: "POST", body: JSON.stringify({ itemId }) });
    assert.equal(failed.status, 409);
    assert.equal((await failed.json()).error, "SNAPSHOT_EXPIRED");
    assert.deepEqual([pass.removed, pass.failed], [1, 0]);
    orphans = snapshotState();
    assert.equal(orphans.length, 3);
    for (const o of orphans) assert.deepEqual([o.state, o.cleanup, v2.hasObject(o.path)], ["deleted", "completed", false], o.path);
    // (e) Late upload: the collector claims, removes (nothing there yet) and completes while the upload
    // is in flight; the object lands afterwards. Enqueue refuses and abort reopens the removal, so the
    // late object is removed by the route.
    v2.faults.beforeUpload = async () => { pass = await collectNow(); };
    failed = await request("/api/v2/analyses", { method: "POST", body: JSON.stringify({ itemId }) });
    assert.equal(failed.status, 409);
    assert.equal(pass.removed, 1);
    orphans = snapshotState();
    assert.equal(orphans.length, 4);
    for (const o of orphans) assert.deepEqual([o.state, o.cleanup, v2.hasObject(o.path)], ["deleted", "completed", false], o.path);
    // (f) Enqueue wins: a successful request, then a collector pass. Published snapshots are never
    // claimed or removed; an immediate second pass finds nothing.
    const ok = await request("/api/v2/analyses", { method: "POST", body: JSON.stringify({ itemId }) });
    assert.equal(ok.status, 201, await ok.clone().text());
    const okId = (await ok.json()).analysis.id;
    pass = await collectNow();
    assert.equal(pass.due, 0, JSON.stringify(pass));
    const published = JSON.parse(v2.sql(`select coalesce(json_agg(a.path),'[]') from fm_v2_analyses x join fm_v2_assets a on a.id=x.image_asset_id where x.user_id='${owner}';`));
    assert.ok(published.length >= 2 && published.every((p) => v2.hasObject(p)), "every published analysis keeps its snapshot");
    assert.equal(v2.sql(`select count(*) from fm_v2_source_cleanup where claim_token is not null;`), "0", "no claim left behind");
    v2.sql(`update fm_v2_source_cleanup set next_attempt_at=next_attempt_at-interval '100 years' where state='pending' and next_attempt_at > now()+interval '50 years';`);
    // Keep the later FIFO worker steps deterministic: this extra probe job is canceled (not run).
    assert.equal((await request(`/api/v2/analyses/${okId}/cancel`, { method: "POST" })).status, 200);

    // New photo -> new analysis; invalid model output fails closed, retry, then an abstention.
    const path2 = `${owner}/tee-blue.jpg`;
    v2.putObject(`fitmatch-wardrobe/${path2}`, await jpeg({ r: 20, g: 40, b: 200 }));
    await request(`/api/wardrobe/${itemId}`, { method: "PATCH", body: JSON.stringify({ imagePath: path2 }) });
    v2.sql(`update fm_wardrobe_items set image_path='${path2}' where id='${itemId}';`);
    const second = await (await request("/api/v2/analyses", { method: "POST", body: JSON.stringify({ itemId }) })).json();
    assert.notEqual(second.analysis.id, a.id);
    out = await runWorker(token, "invalid");
    assert.doesNotMatch(out, /Completed/);
    assert.equal(v2.sql(`select state||':'||error_code from fm_v2_jobs where analysis_id='${second.analysis.id}';`), "failed:INVALID_OUTPUT");
    assert.equal(v2.sql(`select status||':'||(result_json is null) from fm_v2_analyses where id='${second.analysis.id}';`), "pending:true", "self-approved output never stored");
    await page.reload();
    await panel.getByText("AI returned an invalid result", { exact: false }).waitFor();
    await shot("failed");
    await panel.getByRole("button", { name: "Retry" }).click();
    await panel.getByText("Waiting for your PC to accept the job", { exact: false }).waitFor();
    assert.equal(await panelFocused(), true, "focus stays on the panel after Retry");
    await shot("queued");
    out = await runWorker(token, "abstain");
    assert.match(out, /Completed analysis job/);
    await panel.getByText("AI has no suggestion", { exact: false }).waitFor({ timeout: 15000 });
    await shot("abstained");
    await panel.getByRole("button", { name: "Close" }).click();
    await panel.getByText("AI suggestion dismissed", { exact: false }).waitFor();
    assert.equal(await panelFocused(), true, "focus stays on the panel after Close");
    await shot("rejected");
    assert.equal(v2.sql(`select category||':'||color||':'||pattern from fm_wardrobe_items where id='${itemId}';`), "t-shirt:red:graphic", "abstention changes nothing");
    // Flag off: the UI hides the feature (server-side refusal is covered by the route).
    await page.route("**/api/v2/analyses", (route) => route.fulfill({ json: { enabled: false, analyses: [] } }));
    await page.reload();
    await page.getByRole("heading", { name: item.name }).first().waitFor();
    assert.equal(await page.getByRole("group", { name: `AI analysis for ${item.name}` }).count(), 0);
    assert.deepEqual(errors, []);
    v2.sql(`update fm_v2_workers set enabled=false where user_id='${owner}' and allowed_capabilities @> '{garment.analyze}';`);
  } finally {
    await browser.close();
    await rm(temp, { recursive: true, force: true });
  }
  console.log("PASS QINT-C analysis (real routes + PostgreSQL + browser + real worker.py, CPU MOCK adapter): owned photo -> immutable private snapshot -> durable job; dedupe; 3D lists/actions exclude analysis jobs; GPU_BUSY deferral shown as waiting, attempt kept, lock free after drain; proposal stored for review only, result replay idempotent; browser review prefilled except OCR, human confirm writes only reviewed mapped values, persists after reload; same photo reuses confirmed result without a job; self-approving output fails closed, retry, abstention changes nothing; flag-off UI hidden; PC offline and MEMORY_PRESSURE shown distinctly; second account sees/acts on nothing over HTTP; QREV: shared lock held elsewhere -> no claim, heartbeat gpuBusy shown as 'PC busy with other work' to the owner only, slot of the other PC owner refused before claim, snapshot upload failure and item edit during upload leave no orphan (removal recorded), full queue refused before any upload; ENV-CANON-01 worker bound to another backend exits 5 before claim; QREV-BIND-02 coordinator-bound lock/slot/guard via the PC3D policy helper; QREV-CLEANUP-RACE with the real collector: collector between upload and enqueue -> 409 SNAPSHOT_EXPIRED and object removed, late upload after a completed collector pass removed by reopened abort, enqueue-wins snapshot never claimed. No Qwen quality or real GPU claim.");
}
