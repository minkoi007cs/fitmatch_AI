/**
 * C1 full look through the real routes + PostgreSQL + browser Studio:
 * jeans upload→job→bottom.* worker kinds, per-slot fittings, two independent slots, A→B→A with a late
 * result, pending auto-apply only while still selected, save whole outfit + camera, reopen without
 * inference. Geometry is the synthetic shared-frame fixture (boxes), never an avatar/garment claim.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { chromium } from "playwright";
import { fullLookFixture } from "../tests/fixtures/full-look.mjs";
import { jobEnvelope } from "../src/lib/v2/schemas.ts";

const KINDS = ["avatar.reconstruct", "garment.reconstruct", "garment.drape", "bottom.reconstruct", "bottom.drape"];
const ENGINE = { model: "synthetic-fixture", revision: "c1-test" };

export async function testFullLook({ base, request, jar, owner, v2 }) {
  await mkdir("test-results", { recursive: true });
  // Earlier suites may leave queued jobs for this owner; they are not part of this flow.
  v2.sql(`update fm_v2_jobs set state='canceled' where user_id='${owner}' and state in ('queued','running');`);
  v2.sql(`update fm_v2_workers set enabled=false where user_id='${owner}';`);
  const { token } = v2.worker(owner, KINDS);
  const caps = Object.fromEntries(KINDS.map((k) => [k, ENGINE]));
  const worker = (path, body) =>
    fetch(base + "/api/v2/worker/" + path, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const post = (path, body, headers = {}) =>
    request("/api/v2/" + path, { method: "POST", body: JSON.stringify(body), headers });
  const hb = await worker("heartbeat", { capabilities: caps });
  assert.equal(hb.status, 200, await hb.clone().text());
  const granted = (await (await worker("heartbeat", { capabilities: caps })).json()).grantedCapabilities;
  assert.deepEqual([...granted].sort(), [...KINDS].sort());

  const A = fullLookFixture();
  const B = fullLookFixture({ topColor: [0.85, 0.2, 0.15, 1], bottomColor: [0.08, 0.1, 0.16, 1] });
  const photo = await sharp({ create: { width: 640, height: 640, channels: 3, background: "#7a8fb0" } }).png().toBuffer();
  const upload = async () => {
    const intent = await (await post("assets/upload-intent", { kind: "photo", bytes: photo.length })).json();
    assert.equal((await fetch(intent.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: photo })).status, 200);
    assert.equal((await post(`assets/${intent.assetId}/finalize`, {})).status, 200);
    return intent.assetId;
  };
  const photos = [await upload(), await upload(), await upload()];
  const items = { teeA: randomUUID(), teeB: randomUUID(), jeansA: randomUUID(), jeansB: randomUUID() };
  v2.seed(owner, items.teeA, "t-shirt");
  v2.seed(owner, items.teeB, "t-shirt");
  v2.seed(owner, items.jeansA, "jeans");
  v2.seed(owner, items.jeansB, "jeans");

  const enqueue = async (body, key) => {
    const r = await post("models", body, { "Idempotency-Key": key });
    assert.equal(r.status, 202, await r.clone().text());
    return r.json();
  };
  /** Worker side: claim, check the envelope against the published schema, upload the given GLB. */
  const finishNext = async (expectKind, glb) => {
    const c = await worker("claim", {});
    assert.equal(c.status, 200, await c.clone().text());
    const job = await c.json();
    const parsed = jobEnvelope.safeParse(job);
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
    assert.equal(job.kind, expectKind);
    const lease = { leaseToken: job.lease.token };
    const sha = (await import("node:crypto")).createHash("sha256").update(glb).digest("hex");
    const intent = await (await worker(`jobs/${job.jobId}/output-intent`, { ...lease, bytes: glb.length, sha256: sha })).json();
    assert.equal((await fetch(intent.uploadUrl, { method: "PUT", headers: { "Content-Type": "model/gltf-binary" }, body: glb })).status, 200);
    const done = { ...lease, assetId: intent.assetId };
    assert.equal((await worker(`jobs/${job.jobId}/finalize`, done)).status, 200);
    assert.equal((await worker(`jobs/${job.jobId}/complete`, done)).status, 200);
    return job;
  };

  const avatar = await enqueue({ kind: "avatar", name: "Body fixture (synthetic)", heightCm: 175, inputAssetIds: photos }, "c1-avatar-http-01");
  await finishNext("avatar.reconstruct", A.parts.body.bytes);
  const garment = async (name, item, key) =>
    enqueue({ kind: "garment", name, inputAssetIds: photos.slice(0, 2), wardrobeItemId: item }, key);
  const teeA = await garment("Tee trắng (fixture)", items.teeA, "c1-tee-a-001");
  const jeansA = await garment("Jeans xanh (fixture)", items.jeansA, "c1-jeans-a-01");
  const teeB = await garment("Tee đỏ (fixture)", items.teeB, "c1-tee-b-001");
  const jeansB = await garment("Jeans đen (fixture)", items.jeansB, "c1-jeans-b-01");
  const tj = await finishNext("garment.reconstruct", A.parts.top.bytes);
  assert.equal(tj.input.slot, "top");
  assert.equal(tj.input.category, "t-shirt");
  assert.equal(tj.outputContract.content, "top-canonical");
  const jj = await finishNext("bottom.reconstruct", A.parts.bottom.bytes);
  assert.equal(jj.input.slot, "bottom");
  assert.equal(jj.input.category, "jeans");
  assert.equal(jj.outputContract.content, "bottom-canonical");
  assert.deepEqual(
    { ...jj.outputContract.sharedFrame, note: undefined },
    { units: "meters", up: "+Y", front: "+Z", origin: "floor-between-feet", pose: "a-pose-v1", note: undefined },
  );
  await finishNext("garment.reconstruct", B.parts.top.bytes);
  await finishNext("bottom.reconstruct", B.parts.bottom.bytes);
  // Prepared fittings for A only; B items are prepared from the Studio on click.
  const fit = (g, key) => enqueue({ kind: "fitting", name: "fit", avatarId: avatar.modelId, garmentId: g.modelId }, key);
  const fitTeeA = await fit(teeA, "c1-fit-tee-a");
  const fitJeansA = await fit(jeansA, "c1-fit-jeans-a");
  assert.equal(fitTeeA.slot, "top");
  assert.equal(fitJeansA.slot, "bottom");
  const ft = await finishNext("garment.drape", A.parts.top.bytes);
  assert.equal(ft.outputContract.content, "top-only-aligned-to-avatar");
  assert.ok(ft.input.assets.some((a) => a.role === "body") && ft.input.assets.some((a) => a.role === "garment"));
  const fb = await finishNext("bottom.drape", A.parts.bottom.bytes);
  assert.equal(fb.outputContract.content, "bottom-only-aligned-to-avatar");
  assert.equal(fb.input.slot, "bottom");
  // API refuses a look with the slots swapped.
  assert.equal(
    (await post("looks", { name: "Sai", avatarId: avatar.modelId, topFittingId: fitJeansA.modelId })).status,
    409,
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: base })));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const shown = async () => {
      const text = await page.getByLabel("Bộ đang mặc").innerText();
      return {
        top: /Áo\s*\n?\s*(.+)/.exec(text)?.[1].trim(),
        bottom: /Quần\s*\n?\s*(.+)/.exec(text)?.[1].trim(),
      };
    };
    const waitShown = async (want, timeout = 20000) => {
      const deadline = Date.now() + timeout;
      let last;
      while (Date.now() < deadline) {
        last = await shown();
        if (last.top === want.top && last.bottom === want.bottom) return;
        await page.waitForTimeout(250);
      }
      assert.deepEqual(last, want);
    };
    const ready = () =>
      page.waitForFunction(() => ![...document.querySelectorAll("button")].find((b) => b.textContent === "Trước")?.disabled);
    await page.goto(`${base}/studio?avatar=${avatar.modelId}&top=${teeA.modelId}&bottom=${jeansA.modelId}`);
    await ready();
    await waitShown({ top: "Tee trắng (fixture)", bottom: "Jeans xanh (fixture)" });
    await page.getByLabel("Avatar 3D; kéo để xoay, cuộn để phóng to").waitFor();
    await page.screenshot({ path: "test-results/c1-full-look-front.png" });
    const item = (name) => page.getByRole("button", { name: new RegExp(name.replace(/[()]/g, "\\$&")) });
    assert.equal(await item("Tee trắng (fixture)").getAttribute("aria-pressed"), "true");
    assert.equal(await item("Jeans xanh (fixture)").getAttribute("aria-pressed"), "true");

    // A→B→A on the bottom slot: B is prepared on click, the user returns to A before B is ready.
    const jobsBefore = v2.sql(`select count(*) from fm_v2_jobs where user_id='${owner}';`);
    await item("Jeans đen (fixture)").click();
    await page.getByRole("status").filter({ hasText: "Đang chuẩn bị quần" }).waitFor();
    await waitShown({ top: "Tee trắng (fixture)", bottom: "Jeans xanh (fixture)" });
    await item("Jeans xanh (fixture)").click();
    await waitShown({ top: "Tee trắng (fixture)", bottom: "Jeans xanh (fixture)" });
    assert.equal(Number(v2.sql(`select count(*) from fm_v2_jobs where user_id='${owner}';`)), Number(jobsBefore) + 1, "exactly one fitting job for jeans B, none per outfit combination");
    await finishNext("bottom.drape", B.parts.bottom.bytes); // late result for B
    await page.waitForTimeout(6000); // > one poll interval
    await waitShown({ top: "Tee trắng (fixture)", bottom: "Jeans xanh (fixture)" }, 1000);
    // Choosing B now uses the finished fitting; the top stays.
    await item("Jeans đen (fixture)").click();
    await waitShown({ top: "Tee trắng (fixture)", bottom: "Jeans đen (fixture)" });

    // Pending auto-apply while still selected: tee B is prepared and appears by itself, jeans kept.
    await item("Tee đỏ (fixture)").click();
    await page.getByRole("status").filter({ hasText: "Đang chuẩn bị áo" }).waitFor();
    await finishNext("garment.drape", B.parts.top.bytes);
    await waitShown({ top: "Tee đỏ (fixture)", bottom: "Jeans đen (fixture)" });

    // Camera: auto-orbit toggle, then a side view that is saved with the look.
    await page.getByRole("button", { name: "Tự xoay", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Dừng tự xoay" }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Dừng tự xoay" }).click();
    await page.getByRole("button", { name: "Bên", exact: true }).click();
    await page.waitForTimeout(2000); // let orbit damping from auto-rotate settle
    await page.getByRole("button", { name: "Bên", exact: true }).click();
    const sideCamera = await page.getByTestId("viewer-canvas").getAttribute("data-camera");
    await page.screenshot({ path: "test-results/c1-full-look-side.png" });
    await page.getByLabel("Tên bộ phối").fill("Cuối tuần thun + jeans");
    await page.getByRole("button", { name: "Lưu bộ vào tài khoản" }).click();
    await page.getByRole("status").filter({ hasText: "Đã lưu cả bộ" }).waitFor();
    const look = JSON.parse(
      v2.sql(`select row_to_json(l) from fm_v2_looks l where user_id='${owner}' and name='Cuối tuần thun + jeans';`),
    );
    const fittingOf = (g) =>
      v2.sql(`select id from fm_v2_models where kind='fitting' and avatar_id='${avatar.modelId}' and garment_id='${g.modelId}';`);
    assert.equal(look.top_fitting_id, fittingOf(teeB));
    assert.equal(look.bottom_fitting_id, fittingOf(jeansB));
    assert.equal(look.fitting_id, look.top_fitting_id);
    assert.equal(look.camera.autoOrbit, false);
    const savedCamera = [...look.camera.position, ...look.camera.target];
    JSON.parse(sideCamera).forEach((v, i) => assert.ok(Math.abs(v - savedCamera[i]) < 0.01, "saved camera is the side view"));
    assert.match(look.snapshot.top.sha256, /^[0-9a-f]{64}$/);
    assert.equal(look.snapshot.bottom.garmentId, jeansB.modelId);
    assert.equal(look.snapshot.avatar.modelId, avatar.modelId);

    // Reopen: same outfit and camera, no new job, no inference.
    const jobsAtSave = v2.sql(`select count(*) from fm_v2_jobs where user_id='${owner}';`);
    await page.goto(`${base}/looks`);
    await page.getByRole("link", { name: /Cuối tuần thun \+ jeans/ }).click();
    await ready();
    await waitShown({ top: "Tee đỏ (fixture)", bottom: "Jeans đen (fixture)" });
    JSON.parse(await page.getByTestId("viewer-canvas").getAttribute("data-camera")).forEach((v, i) =>
      assert.ok(Math.abs(v - savedCamera[i]) < 0.002, "camera restored from the look"),
    );
    assert.equal(v2.sql(`select count(*) from fm_v2_jobs where user_id='${owner}';`), jobsAtSave, "reopen runs no AI job");
    assert.equal((await worker("claim", {})).status, 204, "nothing queued after reopen");
    await page.getByRole("button", { name: "Trước", exact: true }).click();
    await page.screenshot({ path: "test-results/c1-full-look-reopened.png" });
    // Lookbook: rendered from the same scene, chosen angle and background, no generator.
    await page.getByLabel("Góc máy lookbook").selectOption("back");
    await page.getByLabel("Nền lookbook").selectOption("white");
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Lưu ảnh lookbook" }).click();
    const file = await (await downloading).path();
    const png = sharp(file);
    const meta = await png.metadata();
    assert.equal(meta.format, "png");
    const { data, info } = await png.raw().toBuffer({ resolveWithObject: true });
    const px = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
    assert.deepEqual(px(2, 2), [255, 255, 255], "white background as chosen");
    const center = px(Math.floor(info.width / 2), Math.floor(info.height * 0.35));
    assert.notDeepEqual(center, [255, 255, 255], "the outfit is in the frame");
    await (await import("node:fs/promises")).copyFile(file, "test-results/c3-lookbook-back-white.png");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no horizontal scroll on phone width");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  console.log(
    "PASS C1 full look (real routes + PostgreSQL + browser): jeans enqueue→bottom.reconstruct/bottom.drape with slot/category/shared frame validated against schemas/v1-r2, per-item fittings (one job for jeans B, no outfit combinations), two independent slots, A→B→A with late result not applied, pending auto-apply only while selected, auto-orbit toggle, whole outfit + camera + asset sha saved, reopen restores outfit and camera with no new job. Synthetic box geometry only.",
  );
}
