/**
 * C2 capture + retention through the real routes + PostgreSQL + browser:
 * private video upload (container check), avatar from video + face photo + measurements via the
 * capture drawer, roles/mediaType in the job envelope, draft "use for now", keep/delete source with
 * tombstone (objects removed, dependent jobs canceled, retry refused). Synthetic bytes only.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { chromium } from "playwright";
import { fullLookFixture } from "../tests/fixtures/full-look.mjs";
import { jobEnvelope } from "../src/lib/v2/schemas.ts";
import { createClient } from "@supabase/supabase-js";
import { collectSourceCleanup } from "./source-cleanup.mjs";

const fakeMp4 = () => {
  const b = Buffer.alloc(4096);
  b.writeUInt32BE(24, 0);
  b.write("ftypisom", 4, "latin1");
  return b;
};

export async function testCaptureRetention({ base, fixture, request, jar, owner, v2 }) {
  v2.sql(`update fm_v2_jobs set state='canceled' where user_id='${owner}' and state in ('queued','running');`);
  v2.sql(`update fm_v2_workers set enabled=false where user_id='${owner}';`);
  const { token } = v2.worker(owner, ["avatar.reconstruct"]);
  const worker = (path, body) =>
    fetch(base + "/api/v2/worker/" + path, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const post = (path, body, headers = {}) => request("/api/v2/" + path, { method: "POST", body: JSON.stringify(body), headers });
  assert.equal((await worker("heartbeat", { capabilities: { "avatar.reconstruct": { model: "synthetic-fixture", revision: "c2" } } })).status, 200);
  // Upload intent limits and container check.
  assert.equal((await post("assets/upload-intent", { kind: "video", bytes: 151 * 1024 * 1024, contentType: "video/mp4" })).status, 400);
  assert.equal((await post("assets/upload-intent", { kind: "video", bytes: 100, contentType: "video/x-msvideo" })).status, 400);
  assert.equal((await post("assets/upload-intent", { kind: "photo", bytes: 13 * 1024 * 1024 })).status, 400);
  const badIntent = await (await post("assets/upload-intent", { kind: "video", bytes: 4096, contentType: "video/mp4" })).json();
  await fetch(badIntent.uploadUrl, { method: "PUT", body: Buffer.alloc(4096, 7) });
  const bad = await post(`assets/${badIntent.assetId}/finalize`, {});
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, "INVALID_VIDEO");

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: base })));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/prepare");
    await page.getByRole("button", { name: "Thêm ảnh cơ thể" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tên avatar").fill("Avatar từ video (synthetic)");
    await dialog.getByLabel("Chiều cao (cm)").fill("168");
    const send = dialog.getByRole("button", { name: "Gửi ảnh và tạo 3D" });
    const face = await sharp({ create: { width: 700, height: 700, channels: 3, background: "#c9a98f" } }).png().toBuffer();
    await dialog.getByLabel("Video quanh người").setInputFiles({ name: "turn.mp4", mimeType: "video/mp4", buffer: fakeMp4() });
    assert.equal(await send.isDisabled(), true, "video needs a face photo");
    await dialog.getByLabel("Ảnh mặt (cận)", { exact: true }).setInputFiles({ name: "face.png", mimeType: "image/png", buffer: face });
    await dialog.getByLabel("Vòng eo (cm)").fill("76");
    await dialog.getByLabel("Vòng ngực (cm)").fill("92");
    await send.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent === "Gửi ảnh và tạo 3D" && !b.disabled));
    await page.screenshot({ path: "test-results/c2-capture-video-face.png" });
    await send.click();
    await dialog.getByRole("status").filter({ hasText: "Đã đưa vào hàng đợi" }).waitFor();
    await page.keyboard.press("Escape");

    const c = await worker("claim", {});
    assert.equal(c.status, 200, await c.clone().text());
    const job = await c.json();
    assert.ok(jobEnvelope.safeParse(job).success, JSON.stringify(jobEnvelope.safeParse(job).error?.issues));
    assert.deepEqual(job.input.assets.map((a) => a.role), ["face", "video"]);
    assert.deepEqual(job.input.assets.map((a) => a.mediaType), ["image/jpeg", "video/mp4"]);
    assert.deepEqual(job.input.params.measurements, { chestCm: 92, waistCm: 76 });
    assert.equal(job.input.params.heightCm, 168);
    const video = job.input.assets[1];
    const got = Buffer.from(await (await fetch(video.url)).arrayBuffer());
    assert.equal(got.length, 4096);
    assert.equal(createHash("sha256").update(got).digest("hex"), video.sha256);
    // Finish it with the fixture body.
    const glb = fullLookFixture().parts.body.bytes;
    const lease = { leaseToken: job.lease.token };
    const sha = createHash("sha256").update(glb).digest("hex");
    const intent = await (await worker(`jobs/${job.jobId}/output-intent`, { ...lease, bytes: glb.length, sha256: sha })).json();
    await fetch(intent.uploadUrl, { method: "PUT", body: glb });
    const done = { ...lease, assetId: intent.assetId };
    assert.equal((await worker(`jobs/${job.jobId}/finalize`, done)).status, 200);
    assert.equal((await worker(`jobs/${job.jobId}/complete`, done)).status, 200);
    const sources = JSON.parse(v2.sql(`select json_agg(json_build_array(id,path,source_path)) from fm_v2_assets where id = any((select input_assets from fm_v2_models where id='${job.modelId}')::uuid[]);`));
    assert.ok(sources.every(([, path]) => v2.hasObject(path)));

    // A second, queued avatar job reads the same face photo; deleting the source must cancel it.
    const faceId = job.input.assets[0].assetId;
    const second = await post("models", { kind: "avatar", name: "Tạo lại", heightCm: 168, inputAssetIds: [], faceAssetIds: [faceId], videoAssetId: video.assetId }, { "Idempotency-Key": "c2-recreate-0001" });
    assert.equal(second.status, 202, await second.clone().text());
    const secondJob = (await second.json()).jobId;

    await page.reload();
    const card = page.locator("article", { has: page.getByRole("heading", { name: "Avatar từ video (synthetic)" }) });
    await card.getByText("Bản nháp", { exact: false }).waitFor();
    await card.getByRole("button", { name: "Dùng tạm bản này" }).click();
    await card.getByText("Bạn đang dùng bản này.").waitFor();
    assert.notEqual(v2.sql(`select accepted_at is not null from fm_v2_models where id='${job.modelId}';`), "f");
    await card.getByRole("button", { name: "Giữ ảnh gốc" }).click();
    await card.getByText("Đang giữ.").waitFor();
    await card.getByText("Chỉnh mặt, dáng, tóc, da").click();
    await card.getByText("Chưa khả dụng", { exact: false }).waitFor();
    await card.getByRole("button", { name: "Xóa ảnh gốc" }).click();
    await card.getByRole("group", { name: "Xác nhận xóa ảnh gốc" }).waitFor();
    await page.screenshot({ path: "test-results/c2-retention-confirm.png" });
    // CL-PRIV-01 failure injection: storage refuses the first removal. The request is recorded,
    // the UI must not claim the files are gone, and the state survives a reload.
    v2.faults.removeFail = 1;
    const removeCallsBefore = v2.faults.removeCalls;
    await card.getByRole("button", { name: "Xác nhận xóa" }).click();
    await page.getByRole("status").filter({ hasText: "Đã ghi nhận yêu cầu xóa nhưng chưa xóa xong" }).waitFor();
    assert.equal(v2.faults.removeCalls, removeCallsBefore + 1);
    assert.equal(v2.sql(`select string_agg(distinct state, ',') from fm_v2_assets where id in (${sources.map(([id]) => `'${id}'`)});`), "deleted", "tombstoned even though storage failed");
    assert.ok(sources.every(([, path, source]) => v2.hasObject(path) && v2.hasObject(source)), "objects really still stored");
    assert.equal(v2.sql(`select source_cleanup from fm_v2_models where id='${job.modelId}';`), "pending");
    assert.equal(v2.sql(`select string_agg(distinct state||':'||attempts||':'||last_error, ',') from fm_v2_source_cleanup where requested_by_model='${job.modelId}';`), "pending:1:STORAGE_503");
    assert.equal(v2.sql(`select state||':'||error_code from fm_v2_jobs where id='${secondJob}';`), "canceled:SOURCE_DELETED");
    // Operator collector (service role, against the same fixture): dry run touches nothing; an
    // execute pass during a second outage records the failure and keeps the intent pending.
    const admin = createClient(fixture, "synthetic-service", { auth: { persistSession: false } });
    v2.sql(`update fm_v2_source_cleanup set next_attempt_at=now() where requested_by_model='${job.modelId}';`);
    const dry = await collectSourceCleanup(admin, { execute: false });
    assert.equal(dry.dryRun, true);
    assert.ok(dry.due >= 4, JSON.stringify(dry));
    assert.equal(v2.faults.removeCalls, removeCallsBefore + 1, "dry run does not call storage");
    v2.faults.removeFail = 1;
    const pass = await collectSourceCleanup(admin, { execute: true });
    assert.ok(pass.failed >= 4 && pass.removed === 0, JSON.stringify(pass));
    assert.equal(v2.sql(`select string_agg(distinct state||':'||attempts, ',') from fm_v2_source_cleanup where requested_by_model='${job.modelId}';`), "pending:2");
    assert.ok(sources.every(([, path]) => v2.hasObject(path)));
    await page.reload();
    const status = card.getByRole("status", { name: "Trạng thái xóa ảnh gốc" });
    await status.getByText("Đang xóa", { exact: false }).waitFor();
    assert.equal(await card.getByText("Đã xóa khỏi bộ nhớ lưu trữ", { exact: false }).count(), 0, "no false 'deleted' after reload");
    await page.screenshot({ path: "test-results/priv01-cleanup-pending.png" });
    await status.getByRole("button", { name: "Thử xóa lại" }).click();
    await page.getByRole("status").filter({ hasText: "Đã xóa ảnh/video gốc khỏi bộ nhớ lưu trữ" }).waitFor();
    await card.getByText("Đã xóa khỏi bộ nhớ lưu trữ", { exact: false }).waitFor();
    assert.equal(v2.sql(`select source_cleanup from fm_v2_models where id='${job.modelId}';`), "completed");
    assert.equal(v2.sql(`select string_agg(distinct state, ',') from fm_v2_source_cleanup where requested_by_model='${job.modelId}';`), "completed");
    // A further request is a no-op: nothing outstanding, no storage call.
    const callsAfter = v2.faults.removeCalls;
    const repeat = await (await post(`models/${job.modelId}/source`, { action: "delete" })).json();
    assert.equal(repeat.storageCleanupPending, false);
    assert.equal(repeat.removedObjects, 0);
    assert.equal(v2.faults.removeCalls, callsAfter, "no storage call when nothing is outstanding");
    assert.equal(v2.sql(`select string_agg(distinct state, ',') from fm_v2_assets where id in (${sources.map(([id]) => `'${id}'`)});`), "deleted");
    for (const [, path, source] of sources) {
      assert.equal(v2.hasObject(path), false, "verified object removed");
      assert.equal(v2.hasObject(source), false, "staging object removed");
    }
    assert.equal(v2.sql(`select state||':'||error_code from fm_v2_jobs where id='${secondJob}';`), "canceled:SOURCE_DELETED");
    assert.equal((await post(`jobs/${secondJob}/retry`, {})).status, 409, "retry cannot revive a deleted source");
    assert.equal(
      (await post("models", { kind: "avatar", name: "Lại", heightCm: 168, inputAssetIds: [], faceAssetIds: [faceId], videoAssetId: video.assetId }, { "Idempotency-Key": "c2-recreate-0002" })).status,
      409,
      "deleted assets cannot be enqueued again",
    );
    // The derived avatar stays usable.
    const model = await (await request(`/api/v2/models/${job.modelId}`)).json();
    assert.ok(model.asset?.url, "derived avatar GLB kept");
    assert.equal((await worker("claim", {})).status, 204);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  console.log(
    "PASS C2 capture + retention (real routes + PostgreSQL + browser): video intent limits and container check, avatar from video + face photo + measurements through the capture drawer, envelope roles/mediaType validated against schemas/v1-r2, draft use-for-now, keep then delete source with injected storage failure (pending survives reload, no false 'deleted', retry removes objects; dependent queued job canceled, retry and re-enqueue refused, derived avatar kept), editor shown as unavailable. Synthetic bytes only.",
  );
}
