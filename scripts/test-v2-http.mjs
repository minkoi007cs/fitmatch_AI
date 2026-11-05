import assert from "node:assert/strict";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { mesh } from "../tests/fixtures/mesh.mjs";
export async function testV2({ base, request, jar, owner, itemId, v2 }) {
  const { token, workerId } = v2.worker(owner);
  const post = async (path, body, headers = {}) =>
    request("/api/v2/" + path, {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });
  const worker = async (path, body) =>
    fetch(base + "/api/v2/worker/" + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  for (const path of [
    "models",
    "jobs",
    "looks",
    "style-profiles",
    "recommendations",
  ])
    assert.equal((await request("/api/v2/" + path, {}, new Map())).status, 401);
  for (const path of ["/prepare", "/looks", "/quiz"])
    assert.equal((await request(path, {}, new Map())).status, 303);
  assert.equal(
    (await post("style-profiles", {}, { Origin: "https://evil.invalid" }))
      .status,
    403,
  );
  assert.equal(
    (await post("worker/claim", {})).status,
    401,
    "browser cookie is not a worker credential",
  );
  const caps = {
    "avatar.reconstruct": { model: "synthetic-fixture", revision: "test-only" },
    "garment.reconstruct": {
      model: "synthetic-fixture",
      revision: "test-only",
    },
    "garment.drape": { model: "synthetic-fixture", revision: "test-only" },
  };
  assert.equal((await worker("heartbeat", { capabilities: caps })).status, 200);
  assert.equal((await worker("claim", {})).status, 204);
  const photo = await sharp({
    create: { width: 600, height: 600, channels: 3, background: "#aabbcc" },
  })
    .png()
    .toBuffer();
  async function upload(bytes) {
    const response = await post("assets/upload-intent", {
      kind: "photo",
      bytes: bytes.length,
    });
    assert.equal(response.status, 201, await response.clone().text());
    const intent = await response.json();
    const uploaded = await fetch(intent.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: bytes,
    });
    assert.equal(uploaded.status, 200);
    return intent.assetId;
  }
  const bad = await upload(Buffer.from("not an image"));
  assert.equal((await post(`assets/${bad}/finalize`, {})).status, 400);
  const assets = [];
  for (let i = 0; i < 3; i++) {
    const a = await upload(photo);
    const ready = await post(`assets/${a}/finalize`, {});
    assert.equal(ready.status, 200, await ready.clone().text());
    assets.push(a);
  }
  const avatarRequest = {
    kind: "avatar",
    name: "Avatar test giao thức",
    heightCm: 170,
    inputAssetIds: assets,
  };
  const created = await post("models", avatarRequest, {
    "Idempotency-Key": "test-avatar-0001",
  });
  assert.equal(created.status, 202, await created.clone().text());
  const avatar = await created.json();
  assert.equal(
    (
      await (
        await post("models", avatarRequest, {
          "Idempotency-Key": "test-avatar-0001",
        })
      ).json()
    ).jobId,
    avatar.jobId,
  );
  assert.equal(
    (
      await post(
        "models",
        { ...avatarRequest, heightCm: 180 },
        { "Idempotency-Key": "test-avatar-0001" },
      )
    ).status,
    409,
  );
  const completeJob = async (expected) => {
    const c = await worker("claim", {});
    assert.equal(c.status, 200, await c.clone().text());
    const job = await c.json();
    assert.equal(job.modelId, expected);
    assert.equal(job.protocolVersion, 1);
    assert.equal(job.modelRevision.revision, "test-only");
    for (const a of job.input.assets) {
      const response = await fetch(a.url);
      assert.equal(response.status, 200);
      assert.equal((await response.arrayBuffer()).byteLength, a.bytes);
    }
    const lease = { leaseToken: job.lease.token };
    assert.equal(
      (
        await worker(`jobs/${job.jobId}/heartbeat`, {
          ...lease,
          stage: "exporting",
        })
      ).status,
      200,
    );
    const bytes = mesh([0.8, 0.5, 0.3, 1]);
    const intentResp = await worker(`jobs/${job.jobId}/output-intent`, {
      ...lease,
      bytes: bytes.length,
    });
    assert.equal(intentResp.status, 201);
    const intent = await intentResp.json();
    assert.equal(
      (
        await fetch(intent.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "model/gltf-binary" },
          body: bytes,
        })
      ).status,
      200,
    );
    const done = { ...lease, assetId: intent.assetId };
    const finalized = await worker(`jobs/${job.jobId}/finalize`, done);
    assert.equal(finalized.status, 200, await finalized.clone().text());
    assert.equal(
      (await worker(`jobs/${job.jobId}/complete`, done)).status,
      200,
    );
    assert.equal(
      (await worker(`jobs/${job.jobId}/complete`, done)).status,
      409,
    );
    return job;
  };
  await completeJob(avatar.modelId);
  const garmentResp = await post(
    "models",
    {
      kind: "garment",
      name: "Existing wardrobe",
      inputAssetIds: assets.slice(0, 2),
      wardrobeItemId: itemId,
    },
    { "Idempotency-Key": "test-garment-0001" },
  );
  assert.equal(garmentResp.status, 202, await garmentResp.clone().text());
  const garment = await garmentResp.json();
  await completeJob(garment.modelId);
  const fitResp = await post(
    "models",
    {
      kind: "fitting",
      name: "Sơ mi trên avatar",
      avatarId: avatar.modelId,
      garmentId: garment.modelId,
    },
    { "Idempotency-Key": "test-fitting-0001" },
  );
  assert.equal(fitResp.status, 202);
  const fit = await fitResp.json();
  await completeJob(fit.modelId);
  const publicJobs = await (await request("/api/v2/jobs")).json();
  assert.ok(
    publicJobs.jobs.every(
      (j) =>
        !("lease_token" in j) && !("worker_id" in j) && !("payload_hash" in j),
    ),
  );
  assert.equal(
    (await request("/api/v2/models/99999999-9999-4999-a999-999999999999"))
      .status,
    404,
  );
  const other = "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb",
    foreignModel = "cccccccc-cccc-4ccc-accc-cccccccccccc";
  v2.sql(
    `insert into auth.users values('${other}');insert into fm_v2_models(id,user_id,kind,name) values('${foreignModel}','${other}','avatar','Foreign avatar');`,
  );
  assert.equal((await request("/api/v2/models/" + foreignModel)).status, 404);
  const foreign = v2.worker(other);
  const foreignCall = (path, body) =>
    fetch(base + "/api/v2/worker/" + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + foreign.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await foreignCall("heartbeat", { capabilities: caps })).status,
    200,
  );
  assert.equal(
    (await foreignCall("claim", {})).status,
    204,
    "worker must not claim another owner jobs",
  );
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies(
      [...jar].map(([name, value]) => ({ name, value, url: base })),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/quiz");
    await page
      .getByRole("button", { name: "Đi làm Gọn gàng và chỉn chu" })
      .click();
    await page.reload();
    await page.waitForFunction(() =>
      document
        .querySelector('button[aria-pressed="true"]')
        ?.textContent?.includes("Đi làm"),
    );
    await page.screenshot({
      path: "test-results/v2-quiz-desktop.png",
      fullPage: true,
    });
    for (let i = 0; i < 5; i++) {
      const next = page.getByRole("button", { name: "Tiếp theo", exact: true });
      await next.waitFor({ state: "visible" });
      await next.click();
    }
    await page.getByRole("button", { name: "Lưu & gợi ý mặc thử" }).click();
    await page.waitForURL("**/looks");
    await page
      .getByRole("heading", { name: "Existing wardrobe", exact: true })
      .waitFor();
    await page.screenshot({
      path: "test-results/v2-looks-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Hợp gu", exact: true }).click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (b) =>
          b.textContent === "Hợp gu" &&
          b.getAttribute("aria-pressed") === "true",
      ),
    );
    await page.getByRole("button", { name: "Ẩn khỏi gợi ý" }).click();
    await page
      .getByRole("heading", { name: "Chưa tìm thấy áo phù hợp." })
      .waitFor();
    await page
      .getByRole("button", { name: "Existing wardrobe · Hoàn tác" })
      .click();
    await page
      .getByRole("heading", { name: "Existing wardrobe", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Lưu look", exact: true }).click();
    await page
      .getByRole("heading", { name: "Look đã lưu trên tài khoản" })
      .waitFor();
    await page.getByRole("link", { name: "Mặc thử 3D", exact: false }).click();
    await page.getByRole("button", { name: "Trước", exact: true }).waitFor();
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll("button")].find(
          (b) => b.textContent === "Trước",
        )?.disabled,
    );
    await page.screenshot({
      path: "test-results/v2-cloud-studio.png",
      fullPage: true,
    });
    assert.equal(
      await page
        .getByRole("button", { name: "Chỉ xem avatar", exact: true })
        .count(),
      1,
    );
    // A slow cloud load must not overwrite a newer local import.
    let releaseCloud;
    const gate = new Promise((resolve) => {
      releaseCloud = resolve;
    });
    await page.route(`**/api/v2/models/${avatar.modelId}`, async (route) => {
      await gate;
      await route.continue();
    });
    await page
      .getByRole("button", { name: "Mở từ tài khoản", exact: true })
      .click();
    await page.getByLabel("Chọn manifest và mô hình GLB").setInputFiles([
      {
        name: "manifest.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            version: 1,
            avatar: {
              id: "local-race-test",
              name: "Local import remains selected",
              file: "avatar.glb",
            },
            garments: [],
          }),
        ),
      },
      { name: "avatar.glb", mimeType: "model/gltf-binary", buffer: mesh() },
    ]);
    await page
      .getByRole("heading", { name: "Local import remains selected" })
      .waitFor();
    releaseCloud();
    await page
      .getByRole("button", { name: "Mở từ tài khoản", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("heading", { name: "Local import remains selected" })
        .count(),
      1,
    );
    await page.unroute(`**/api/v2/models/${avatar.modelId}`);
    // New photo -> actual API -> PostgreSQL job from browser, with worker deliberately offline.
    v2.sql(
      `update fm_v2_workers set last_seen=now()-interval '5 minutes' where id='${workerId}';`,
    );
    await page.goto(base + "/prepare");
    await page
      .getByText("Máy xử lý đang ngoại tuyến · tác vụ mới sẽ chờ", {
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "Thêm ảnh cơ thể" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tên avatar").fill("Avatar tải qua trình duyệt");
    await dialog.getByLabel("Chiều cao (cm)").fill("172");
    for (const label of ["Mặt trước", "Mặt bên", "Mặt sau"])
      await dialog.getByLabel(label, { exact: true }).setInputFiles({
        name: "fixture.png",
        mimeType: "image/png",
        buffer: photo,
      });
    await dialog.getByRole("button", { name: "Gửi ảnh và tạo 3D" }).click();
    await dialog
      .getByRole("status")
      .filter({ hasText: "Đã đưa vào hàng đợi" })
      .waitFor();
    await page.keyboard.press("Escape");
    await page
      .getByRole("heading", { name: "Avatar tải qua trình duyệt" })
      .waitFor();
    await page.screenshot({
      path: "test-results/v2-prepare-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/quiz");
    await page
      .getByRole("button", { name: "Tiếp theo", exact: true })
      .waitFor();
    await page.screenshot({
      path: "test-results/v2-quiz-mobile.png",
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    for (let i = 0; i < 5; i++)
      await page
        .getByRole("button", { name: "Tiếp theo", exact: true })
        .click();
    await page.getByRole("button", { name: "Lưu & gợi ý mặc thử" }).click();
    await page.waitForURL("**/looks");
    assert.equal(
      v2.sql(`select count(*) from fm_v2_profiles where user_id='${owner}';`),
      "1",
      "unchanged retake reuses profile version",
    );
    const before = await (await request("/api/v2/recommendations")).json();
    const repeated = await post("recommendations", {});
    assert.equal(
      (await repeated.json()).recommendation.id,
      before.recommendation.id,
      "repeated current snapshot is reused",
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  // Exercise the actual Python transport with an explicit synthetic adapter in a temp directory.
  const temp = await mkdtemp(join(tmpdir(), "fitmatch-worker-test-"));
  try {
    const adapter = join(temp, "synthetic-adapter.mjs");
    await writeFile(
      adapter,
      `import assert from 'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';const input=JSON.parse(readFileSync(process.argv[2],'utf8'));assert.equal(input.params.heightCm,172);assert.equal(input.assets.length,3);assert.equal(process.env.FITMATCH_WORKER_TOKEN,undefined);writeFileSync(process.argv[3],Buffer.from('${mesh().toString("base64")}','base64'));`,
    );
    const config = join(temp, "config.json");
    await writeFile(
      config,
      JSON.stringify({
        appUrl: base,
        workDir: join(temp, "data"),
        engines: {
          "avatar.reconstruct": {
            model: "synthetic-fixture",
            revision: "test-only",
            command: [process.execPath, adapter, "{input}", "{output}"],
          },
        },
      }),
    );
    const output = await promisify(execFile)(
      "python3",
      [resolve("scripts/worker/worker.py"), "--config", config, "--once"],
      { env: { ...process.env, FITMATCH_WORKER_TOKEN: token }, timeout: 60000 },
    );
    assert.match(output.stdout, /Completed job/);
    const models = await (await request("/api/v2/models")).json();
    assert.ok(
      models.models.find((m) => m.name === "Avatar tải qua trình duyệt")
        .output_asset_id,
    );
    v2.sql(`update fm_v2_workers set enabled=false where id='${workerId}';`);
    assert.equal(
      (await worker("heartbeat", { capabilities: caps })).status,
      401,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  console.log(
    "PASS S1/S2 real HTTP + PostgreSQL + browser: auth/CSRF, private image normalization, idempotency, worker claims/output/fencing, body+garment+fitting, quiz restore/save, inventory suggestions, cloud look, verified GLB Studio, offline browser capture queue, mobile layout. Geometry is synthetic; no inference-quality claim.",
  );
}
