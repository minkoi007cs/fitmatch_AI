/** Runs inside the isolated auth fixture. Geometry is synthetic, never an AI avatar. */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { unzipSync, strFromU8 } from "fflate";
import { readFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { mesh } from "../tests/fixtures/mesh.mjs";
export async function testStudio(base, jar) {
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
    await mkdir("test-results", { recursive: true });
    // UI-UX-39: real browser regressions on isolated data, including failed reads and legacy nulls.
    await page.goto(base + "/");
    await page.getByRole("heading", { level: 1, name: /Đồ bạn có/ }).waitFor();
    assert.equal(await page.getByText("Looks generated today.", { exact: true }).count(), 0);
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `home fits ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/ux-home-mobile.png", fullPage: true });
    const menu = page.getByRole("button", { name: "Mở menu điều hướng", exact: true });
    await menu.click();
    await page.getByRole("dialog", { name: "Không gian của bạn" }).waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(await menu.evaluate((el) => el === document.activeElement), true, "Escape restores navigation trigger focus");
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
    await menu.click();
    await page.getByRole("dialog").getByRole("link", { name: "Tủ đồ", exact: true }).click();
    await page.waitForURL(base + "/wardrobe");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByRole("heading", { name: "Tủ đồ của bạn" }).waitFor();
    await page.route("**/api/wardrobe", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, items: [{ id: "22222222-2222-4222-a222-222222222222", name: "Món đồ cũ chưa có màu", category: "shirt", color: null, style: null, image_path: null }] }) }));
    await page.reload();
    await page.getByRole("heading", { name: "Món đồ cũ chưa có màu" }).waitFor();
    await page.getByRole("textbox", { name: "Tìm đồ theo màu" }).fill("trắng");
    await page.getByText("Chưa có món nào khớp bộ lọc.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
    await page.getByRole("button", { name: "Sửa Món đồ cũ chưa có màu", exact: true }).click();
    await page.getByRole("dialog", { name: "Sửa món đồ" }).waitFor();
    await page.waitForFunction(() => { const r = document.querySelector('[role="dialog"]')?.getBoundingClientRect(); return r && r.left >= -1 && r.right <= window.innerWidth + 1; });
    await page.screenshot({ path: "test-results/ux-edit-before-fields.png" });
    await page.getByRole("dialog").getByLabel(/Tên món đồ/i).waitFor();
    await page.getByRole("dialog").getByLabel(/Loại đồ/i).selectOption("jeans");
    await page.getByRole("dialog").getByLabel(/Phong cách/i).selectOption("minimal");
    assert.equal(await page.getByRole("dialog").getByLabel(/Loại đồ/i).inputValue(), "jeans", "translated label retains raw category");
    assert.equal(await page.getByRole("dialog").getByLabel(/Phong cách/i).inputValue(), "minimal", "translated label retains raw style");
    await page.screenshot({ path: "test-results/ux-wardrobe-mobile.png" });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.unroute("**/api/wardrobe");
    let wardrobeReads = 0;
    await page.route("**/api/wardrobe", (route) => ++wardrobeReads === 1 ? route.fulfill({ status: 503, contentType: "application/json", body: '{"success":false}' }) : route.continue());
    await page.reload();
    await page.getByRole("button", { name: "Thử tải lại tủ đồ", exact: true }).waitFor();
    assert.equal(await page.getByText("Tủ đồ của bạn còn trống", { exact: true }).count(), 0, "read failure is not an empty wardrobe");
    await page.getByRole("button", { name: "Thử tải lại tủ đồ", exact: true }).click();
    await page.getByRole("button", { name: "Thử tải lại tủ đồ", exact: true }).waitFor({ state: "hidden" });
    assert.ok(wardrobeReads >= 2);
    await page.unroute("**/api/wardrobe");
    let modelReads = 0;
    await page.route("**/api/v2/models", (route) => route.fulfill({ status: ++modelReads === 1 ? 503 : 200, contentType: "application/json", body: modelReads === 1 ? '{"error":"DATA_UNAVAILABLE"}' : '{"models":[]}' }));
    await page.goto(base + "/studio");
    await page.getByRole("button", { name: "Thử tải lại thư viện", exact: true }).waitFor();
    await page.screenshot({ path: "test-results/ux-studio-recovery-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "Thử tải lại thư viện", exact: true }).click();
    await page.getByRole("button", { name: "Thử tải lại thư viện", exact: true }).waitFor({ state: "hidden" });
    await page.unroute("**/api/v2/models");
    await page.route("**/api/v2/models", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"DATA_UNAVAILABLE"}' }));
    await page.goto(base + "/prepare");
    await page.getByText("Chưa kiểm tra được trạng thái xử lý", { exact: true }).waitFor();
    assert.equal(await page.getByText("Đang kiểm tra máy xử lý…", { exact: true }).count(), 0, "failed library read does not leave a perpetual checking state");
    await page.getByRole("link", { name: "thêm đồ vào tủ", exact: true }).waitFor();
    await page.screenshot({ path: "test-results/ux-prepare-unavailable-mobile.png", fullPage: true });
    await page.unroute("**/api/v2/models");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/");
    await page.getByRole("button", { name: "Mở menu tài khoản", exact: true }).click();
    await page.getByRole("link", { name: "Tủ đồ của bạn", exact: true }).click();
    await page.waitForURL(base + "/wardrobe");
    assert.equal(await page.getByRole("button", { name: "Mở menu tài khoản", exact: true }).getAttribute("aria-expanded"), "false", "account navigation closes the dropdown");
    await page.goto(base + "/ux-check-page-does-not-exist");
    await page.getByRole("heading", { name: "Trang này chưa có ở đây." }).waitFor();
    const homeLink = page.getByRole("link", { name: "Về trang chủ", exact: true });
    assert.equal(await homeLink.locator("button").count(), 0, "404 navigation does not nest interactive controls");
    await homeLink.click();
    await page.waitForURL(base + "/");
    await page.goto(base + "/studio");
    await page
      .getByRole("heading", { name: "Phòng thử đồ của bạn." })
      .waitFor();
    await mkdir("test-results", { recursive: true });
    await page.screenshot({
      path: "test-results/studio-desktop-empty.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Chuẩn bị avatar", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog.getByLabel("Tên avatar").fill("Test capture");
    await dialog.getByLabel("Chiều cao (cm)").fill("170");
    const png = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = c.height = 600;
      const x = c.getContext("2d");
      x.fillStyle = "#ddd";
      x.fillRect(0, 0, 600, 600);
      return c.toDataURL("image/png").split(",")[1];
    });
    const photo = {
      name: "synthetic-capture.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    };
    await dialog
      .getByLabel("Mặt trước", { exact: true })
      .setInputFiles({
        name: "bad.png",
        mimeType: "image/png",
        buffer: Buffer.from("not an image"),
      });
    await dialog.getByRole("alert").waitFor();
    for (const name of ["Mặt trước", "Mặt bên", "Mặt sau"])
      await dialog.getByLabel(name, { exact: true }).setInputFiles(photo);
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll("button")].find((b) =>
          b.textContent.includes("Xuất bộ ảnh cho PC"),
        )?.disabled,
    );
    const downloading = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Xuất bộ ảnh cho PC" }).click();
    const download = await downloading;
    const packed = unzipSync(
      new Uint8Array(await readFile(await download.path())),
    );
    const capture = JSON.parse(strFromU8(packed["capture.json"]));
    assert.equal(capture.kind, "avatar");
    assert.equal(capture.heightCm, 170);
    assert.equal(capture.views.length, 3);
    assert.equal(capture.status, "input_only");
    assert.ok(packed["photos/front.png"]);
    await dialog
      .getByRole("status")
      .filter({ hasText: "Đã xuất bộ ảnh ZIP" })
      .waitFor();
    await dialog
      .locator("form")
      .evaluate((el) => (el.parentElement.scrollTop = 0));
    await page.screenshot({ path: "test-results/studio-capture-avatar.png" });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Thêm sơ mi", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("heading", { name: "Chuẩn bị áo của bạn" })
      .waitFor();
    assert.equal(
      await page
        .getByRole("dialog")
        .getByLabel("Mặt bên", { exact: true })
        .count(),
      0,
    );
    await dialog.getByLabel("Tên chiếc áo").fill("Test shirt");
    for (const name of ["Mặt trước", "Mặt sau"])
      await dialog.getByLabel(name, { exact: true }).setInputFiles(photo);
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll("button")].find((b) =>
          b.textContent.includes("Xuất bộ ảnh cho PC"),
        )?.disabled,
    );
    const shirtDownloading = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Xuất bộ ảnh cho PC" }).click();
    const shirtZip = unzipSync(
      new Uint8Array(await readFile(await (await shirtDownloading).path())),
    );
    const shirtCapture = JSON.parse(strFromU8(shirtZip["capture.json"]));
    assert.equal(shirtCapture.kind, "shirt");
    assert.equal(shirtCapture.views.length, 2);
    assert.equal(shirtCapture.heightCm, null);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const input = page.getByLabel("Chọn manifest và mô hình GLB");
    await input.setInputFiles([
      {
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from("{}"),
      },
    ]);
    await page
      .getByRole("alert")
      .filter({ hasText: "manifest.json" })
      .waitFor();
    const manifest = {
      version: 1,
      avatar: {
        id: "synthetic-avatar",
        name: "Synthetic geometry test",
        file: "avatar.glb",
      },
      garments: [
        {
          id: "tee",
          name: "Synthetic tee",
          file: "tee.glb",
          category: "t-shirt",
          avatarId: "synthetic-avatar",
        },
      ],
    };
    await input.setInputFiles([
      {
        name: "manifest.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(manifest)),
      },
      {
        name: "avatar.glb",
        mimeType: "model/gltf-binary",
        buffer: mesh([0.8, 0.8, 0.8, 1]),
      },
      {
        name: "tee.glb",
        mimeType: "model/gltf-binary",
        buffer: mesh([0.8, 0.3, 0.1, 1]),
      },
    ]);
    await page.locator("canvas").waitFor();
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll("button")].find(
          (b) => b.textContent === "Trước",
        )?.disabled,
    );
    const tee = page.getByRole("button", { name: /Synthetic tee/ });
    await tee.click();
    assert.equal(await tee.getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Ghi nhớ look A" }).click();
    await page.getByRole("button", { name: "Chỉ xem avatar" }).click();
    await page.getByRole("button", { name: "So sánh A ↔ B" }).click();
    assert.equal(await tee.getAttribute("aria-pressed"), "true");
    await page.getByLabel("Tìm đồ").fill("missing garment");
    await page.getByText("Không có món đồ phù hợp bộ lọc.").first().waitFor();
    await page.getByLabel("Tìm đồ").fill("");
    await page.getByRole("button", { name: "Sơ mi", exact: true }).click();
    await page.getByText("Không có món đồ phù hợp bộ lọc.").first().waitFor();
    await page.getByRole("button", { name: "Tất cả", exact: true }).click();
    await page.getByLabel("Tên bộ phối").fill("Weekend look");
    await page.getByRole("button", { name: "Lưu look trong phiên" }).click();
    await page
      .getByRole("button", { name: "Lưu trên máy", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Đã lưu bộ 3D" })
      .waitFor();
    await page.reload();
    assert.equal(
      await page.locator("canvas").count(),
      0,
      "Stored body must not auto-open",
    );
    await page.getByRole("button", { name: "Mở bản lưu trên máy" }).click();
    await page
      .getByRole("button", { name: "Weekend look", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll("button")].find(
          (b) => b.textContent === "Trước",
        )?.disabled,
    );
    assert.equal(
      await page
        .getByRole("button", { name: /Synthetic tee/ })
        .getAttribute("aria-pressed"),
      "true",
    );
    for (const name of ["Bên", "Sau", "Đặt lại"])
      await page.getByRole("button", { name, exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: "test-results/studio-synthetic-mesh.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.getByRole("button", { name: "Đóng bộ 3D" }).click();
    await page
      .getByRole("heading", { name: "Bắt đầu với avatar của bạn" })
      .waitFor();
    assert.equal(await page.locator("canvas").count(), 0);
    await page.getByRole("button", { name: "Xóa bản lưu trên máy" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Đã xóa bản lưu" })
      .waitFor();
    await page.getByRole("button", { name: "Mở bản lưu trên máy" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Chưa có bộ 3D lưu" })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: avatar/shirt capture ZIP contents, image rejection, modal dismissal, GLB import, filter, compare, saved look, IndexedDB save/reload/restore/delete, camera and responsive layout (synthetic inputs)",
    );
  } finally {
    await browser.close();
  }
}
