/**
 * QINT-C garment analysis through the real routes + PostgreSQL + browser + the real worker.py.
 * The adapter is a CPU MOCK (scripts/fixtures/mock_qwen_adapter.py): this proves app/queue/worker
 * plumbing and human review, NOT Qwen quality, real GPU timing or native Windows behaviour.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";
import { analysisResult } from "../src/lib/v2/qwen.ts";

const jpeg = (rgb) =>
  sharp({ create: { width: 400, height: 480, channels: 3, background: rgb } }).jpeg().toBuffer();

export async function testQwen({ base, request, jar, owner, itemId, v2, asSecond }) {
  const temp = await mkdtemp(join(tmpdir(), "fitmatch-qwen-"));
  const lockPath = join(temp, "gpu-0.lock");
  const runWorker = async (token, mode) => {
    const config = join(temp, "config.json");
    await writeFile(config, JSON.stringify({
      appUrl: base, workDir: join(temp, "data"), gpuLock: lockPath, pollSeconds: 1,
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
    const panel = page.getByRole("group", { name: `Phân tích AI cho ${item.name}` });
    await panel.getByRole("button", { name: "Phân tích với AI" }).click();
    // No worker granted for analysis is online: say so instead of pretending it is about to run.
    await panel.getByText("PC đang offline", { exact: false }).waitFor();
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

    // Worker 1st run: GPU busy -> deferred, attempt not consumed, UI says so.
    const { token } = v2.worker(owner, ["garment.analyze"]);
    let out = await runWorker(token, "gpu_busy");
    assert.doesNotMatch(out, /Completed/);
    assert.equal(v2.sql(`select state||':'||attempt||':'||deferrals||':'||error_code from fm_v2_jobs where id='${jobId}';`), "queued:0:1:GPU_BUSY");
    await panel.getByText("PC đang bận GPU", { exact: false }).waitFor({ timeout: 15000 });
    // Lock released after the owned adapter tree drained.
    const probe = await promisify(execFile)("python3", ["-c",
      "import fcntl,sys;f=open(sys.argv[1],'a+');fcntl.flock(f.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB);print('free')", lockPath]);
    assert.equal(probe.stdout.trim(), "free");
    assert.equal((await (await request("/api/v2/analyses")).json()).workerOnline, true, "granted worker heartbeat seen");
    // Memory admission refused before load: same bounded deferral, distinct message.
    v2.sql(`update fm_v2_jobs set not_before=now() where id='${jobId}';`);
    out = await runWorker(token, "memory");
    assert.equal(v2.sql(`select state||':'||attempt||':'||deferrals||':'||error_code from fm_v2_jobs where id='${jobId}';`), "queued:0:2:MEMORY_PRESSURE");
    await panel.getByText("PC đang thiếu bộ nhớ trống", { exact: false }).waitFor({ timeout: 15000 });
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

    await panel.getByText("Đề xuất của AI", { exact: false }).waitFor({ timeout: 15000 });
    assert.equal(await panel.getByLabel("Loại").inputValue(), "tshirt");
    assert.equal(await panel.getByLabel("Màu chính").inputValue(), "red");
    assert.equal(await panel.getByLabel("Màu phụ").inputValue(), "white");
    assert.equal(await panel.getByLabel("Họa tiết").inputValue(), "printed");
    assert.equal(await panel.getByLabel("Chữ/logo trên đồ").inputValue(), "", "OCR candidate is not pre-approved");
    await panel.getByText("chưa xác nhận", { exact: false }).waitFor();
    await page.screenshot({ path: "test-results/qint-review.png" });
    await panel.getByLabel("Màu phụ").selectOption("");
    await panel.getByRole("button", { name: "Lưu vào tủ đồ" }).click();
    await panel.getByText("Đã lưu theo xác nhận của bạn", { exact: false }).waitFor();
    assert.equal(v2.sql(`select category||':'||color||':'||pattern||':'||coalesce(secondary_color,'-') from fm_wardrobe_items where id='${itemId}';`), "t-shirt:red:graphic:-", "only reviewed values written; cleared secondary not invented");
    assert.equal(v2.sql(`select status||':'||(confirmed_fields ? 'logoText') from fm_v2_analyses where id='${a.id}';`), "confirmed:false");
    await page.reload();
    await panel.getByText("Đã lưu theo xác nhận của bạn", { exact: false }).waitFor();
    // Asking again for the same photo reuses the confirmed analysis: no GPU, no new job.
    const again = await request("/api/v2/analyses", { method: "POST", body: JSON.stringify({ itemId }) });
    assert.equal((await again.json()).analysis.state, "confirmed");
    assert.equal(v2.sql(`select count(*) from fm_v2_jobs where analysis_id is not null and user_id='${owner}';`), "1");

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
    await panel.getByText("AI trả kết quả không hợp lệ", { exact: false }).waitFor();
    await panel.getByRole("button", { name: "Thử lại" }).click();
    await panel.getByText("Đang chờ PC nhận việc", { exact: false }).waitFor();
    out = await runWorker(token, "abstain");
    assert.match(out, /Completed analysis job/);
    await panel.getByText("AI không đưa ra đề xuất", { exact: false }).waitFor({ timeout: 15000 });
    await panel.getByRole("button", { name: "Đóng" }).click();
    await panel.getByText("Đã bỏ qua đề xuất AI", { exact: false }).waitFor();
    assert.equal(v2.sql(`select category||':'||color||':'||pattern from fm_wardrobe_items where id='${itemId}';`), "t-shirt:red:graphic", "abstention changes nothing");
    // Flag off: the UI hides the feature (server-side refusal is covered by the route).
    await page.route("**/api/v2/analyses", (route) => route.fulfill({ json: { enabled: false, analyses: [] } }));
    await page.reload();
    await page.getByRole("heading", { name: item.name }).first().waitFor();
    assert.equal(await page.getByRole("group", { name: `Phân tích AI cho ${item.name}` }).count(), 0);
    assert.deepEqual(errors, []);
    v2.sql(`update fm_v2_workers set enabled=false where user_id='${owner}' and allowed_capabilities @> '{garment.analyze}';`);
  } finally {
    await browser.close();
    await rm(temp, { recursive: true, force: true });
  }
  console.log("PASS QINT-C analysis (real routes + PostgreSQL + browser + real worker.py, CPU MOCK adapter): owned photo -> immutable private snapshot -> durable job; dedupe; 3D lists/actions exclude analysis jobs; GPU_BUSY deferral shown as waiting, attempt kept, lock free after drain; proposal stored for review only, result replay idempotent; browser review prefilled except OCR, human confirm writes only reviewed mapped values, persists after reload; same photo reuses confirmed result without a job; self-approving output fails closed, retry, abstention changes nothing; flag-off UI hidden; PC offline and MEMORY_PRESSURE shown distinctly; second account sees/acts on nothing over HTTP. No Qwen quality or real GPU claim.");
}
