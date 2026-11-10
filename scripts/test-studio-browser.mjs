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
    await page.getByRole("heading", { level: 1, name: /Your clothes/ }).waitFor();
    assert.equal(await page.getByText("Looks generated today.", { exact: true }).count(), 0);
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `home fits ${width}px`);
    }
    // CL-UX-47: un-scrolled landing header over the hero photo has a dark backdrop and light links (readable on any photo).
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const headerStyle = await page.evaluate(() => {
      const h = document.querySelector("header"); const a = h.querySelector('nav[aria-label="Main navigation"] a:not([aria-current])');
      return { bg: getComputedStyle(h).backgroundImage, link: getComputedStyle(a).color };
    });
    assert.match(headerStyle.bg, /gradient/, "landing header has a backdrop over the hero");
    assert.match(headerStyle.link, /^(rgba?\(255, 255, 255|oklab\(0\.99)/, `landing nav links are light: ${headerStyle.link}`);
    await page.screenshot({ path: "test-results/ux-home-header-1440.png", clip: { x: 0, y: 0, width: 1440, height: 120 } });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/ux-home-mobile.png", fullPage: true });
    const menu = page.getByRole("button", { name: "Open navigation menu", exact: true });
    await menu.click();
    await page.getByRole("dialog", { name: "Your space" }).waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(await menu.evaluate((el) => el === document.activeElement), true, "Escape restores navigation trigger focus");
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
    await menu.click();
    await page.getByRole("dialog").getByRole("link", { name: "Wardrobe", exact: true }).click();
    await page.waitForURL(base + "/wardrobe");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByRole("heading", { name: "Your wardrobe" }).waitFor();
    await page.route("**/api/wardrobe", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, items: [{ id: "22222222-2222-4222-a222-222222222222", name: "Legacy item without color", category: "shirt", color: null, style: null, image_path: null }] }) }));
    await page.reload();
    await page.getByRole("heading", { name: "Legacy item without color" }).waitFor();
    await page.getByRole("textbox", { name: "Find items by color" }).fill("white");
    await page.getByText("No items match your filters.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    await page.getByRole("button", { name: "Edit Legacy item without color", exact: true }).click();
    await page.getByRole("dialog", { name: "Edit item" }).waitFor();
    await page.waitForFunction(() => { const r = document.querySelector('[role="dialog"]')?.getBoundingClientRect(); return r && r.left >= -1 && r.right <= window.innerWidth + 1; });
    await page.screenshot({ path: "test-results/ux-edit-before-fields.png" });
    await page.getByRole("dialog").getByLabel(/Item name/i).waitFor();
    await page.getByRole("dialog").getByLabel(/Category/i).selectOption("jeans");
    await page.getByRole("dialog").getByLabel(/Style/i).selectOption("minimal");
    assert.equal(await page.getByRole("dialog").getByLabel(/Category/i).inputValue(), "jeans", "translated label retains raw category");
    assert.equal(await page.getByRole("dialog").getByLabel(/Style/i).inputValue(), "minimal", "translated label retains raw style");
    await page.screenshot({ path: "test-results/ux-wardrobe-mobile.png" });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.unroute("**/api/wardrobe");
    let wardrobeReads = 0;
    await page.route("**/api/wardrobe", (route) => ++wardrobeReads === 1 ? route.fulfill({ status: 503, contentType: "application/json", body: '{"success":false}' }) : route.continue());
    await page.reload();
    await page.getByRole("button", { name: "Try loading wardrobe again", exact: true }).waitFor();
    assert.equal(await page.getByText("Your wardrobe is empty", { exact: true }).count(), 0, "read failure is not an empty wardrobe");
    await page.getByRole("button", { name: "Try loading wardrobe again", exact: true }).click();
    await page.getByRole("button", { name: "Try loading wardrobe again", exact: true }).waitFor({ state: "hidden" });
    assert.ok(wardrobeReads >= 2);
    await page.unroute("**/api/wardrobe");
    let modelReads = 0;
    await page.route("**/api/v2/models", (route) => route.fulfill({ status: ++modelReads === 1 ? 503 : 200, contentType: "application/json", body: modelReads === 1 ? '{"error":"DATA_UNAVAILABLE"}' : '{"models":[]}' }));
    await page.goto(base + "/studio");
    await page.getByRole("button", { name: "Try loading library again", exact: true }).waitFor();
    await page.screenshot({ path: "test-results/ux-studio-recovery-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "Try loading library again", exact: true }).click();
    await page.getByRole("button", { name: "Try loading library again", exact: true }).waitFor({ state: "hidden" });
    await page.unroute("**/api/v2/models");
    await page.route("**/api/v2/models", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"DATA_UNAVAILABLE"}' }));
    await page.goto(base + "/prepare");
    await page.getByText("Unable to check processing status", { exact: true }).waitFor();
    assert.equal(await page.getByText("Checking the processor…", { exact: true }).count(), 0, "failed library read does not leave a perpetual checking state");
    await page.getByRole("link", { name: "add clothes to your wardrobe", exact: true }).waitFor();
    await page.screenshot({ path: "test-results/ux-prepare-unavailable-mobile.png", fullPage: true });
    await page.unroute("**/api/v2/models");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/");
    await page.getByRole("button", { name: "Open account menu", exact: true }).click();
    await page.getByRole("link", { name: "Your wardrobe", exact: true }).click();
    await page.waitForURL(base + "/wardrobe");
    assert.equal(await page.getByRole("button", { name: "Open account menu", exact: true }).getAttribute("aria-expanded"), "false", "account navigation closes the dropdown");
    await page.goto(base + "/ux-check-page-does-not-exist");
    await page.getByRole("main").getByRole("heading", { name: "This page doesn't exist." }).waitFor();
    const homeLink = page.getByRole("link", { name: "Back to home", exact: true });
    assert.equal(await homeLink.locator("button").count(), 0, "404 navigation does not nest interactive controls");
    await homeLink.click();
    await page.waitForURL(base + "/");
    await page.goto(base + "/studio");
    await page
      .getByRole("heading", { name: "Your personal fitting room." })
      .waitFor();
    await mkdir("test-results", { recursive: true });
    await page.screenshot({
      path: "test-results/studio-desktop-empty.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Prepare avatar", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog.getByLabel("Avatar name").fill("Test capture");
    await dialog.getByLabel("Height (cm)").fill("170");
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
      .getByLabel("Front", { exact: true })
      .setInputFiles({
        name: "bad.png",
        mimeType: "image/png",
        buffer: Buffer.from("not an image"),
      });
    await dialog.getByRole("alert").waitFor();
    for (const name of ["Front", "Side", "Back"])
      await dialog.getByLabel(name, { exact: true }).setInputFiles(photo);
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll("button")].find((b) =>
          b.textContent.includes("Export photos for PC"),
        )?.disabled,
    );
    const downloading = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Export photos for PC" }).click();
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
      .filter({ hasText: "Photo ZIP exported" })
      .waitFor();
    await dialog
      .locator("form")
      .evaluate((el) => (el.parentElement.scrollTop = 0));
    await page.screenshot({ path: "test-results/studio-capture-avatar.png" });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Add shirt", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("heading", { name: "Prepare your garment" })
      .waitFor();
    assert.equal(
      await page
        .getByRole("dialog")
        .getByLabel("Side", { exact: true })
        .count(),
      0,
    );
    await dialog.getByLabel("Garment name").fill("Test shirt");
    for (const name of ["Front", "Back"])
      await dialog.getByLabel(name, { exact: true }).setInputFiles(photo);
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll("button")].find((b) =>
          b.textContent.includes("Export photos for PC"),
        )?.disabled,
    );
    const shirtDownloading = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Export photos for PC" }).click();
    const shirtZip = unzipSync(
      new Uint8Array(await readFile(await (await shirtDownloading).path())),
    );
    const shirtCapture = JSON.parse(strFromU8(shirtZip["capture.json"]));
    assert.equal(shirtCapture.kind, "shirt");
    assert.equal(shirtCapture.views.length, 2);
    assert.equal(shirtCapture.heightCm, null);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const input = page.getByLabel("Choose manifest and GLB models");
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
          (b) => b.textContent === "Front",
        )?.disabled,
    );
    const tee = page.getByRole("button", { name: /Synthetic tee/ });
    await tee.click();
    assert.equal(await tee.getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Remember look A" }).click();
    await page.getByRole("button", { name: "View avatar only" }).click();
    await page.getByRole("button", { name: "Compare A ↔ B" }).click();
    assert.equal(await tee.getAttribute("aria-pressed"), "true");
    await page.getByLabel("Find items").fill("missing garment");
    await page.getByText("No items match your filters.").first().waitFor();
    await page.getByLabel("Find items").fill("");
    await page.getByRole("button", { name: "Shirt", exact: true }).click();
    await page.getByText("No items match your filters.").first().waitFor();
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByLabel("Look name").fill("Weekend look");
    await page.getByRole("button", { name: "Save look in session" }).click();
    await page
      .getByRole("button", { name: "Save on this device", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "3D bundle and looks saved" })
      .waitFor();
    await page.reload();
    assert.equal(
      await page.locator("canvas").count(),
      0,
      "Stored body must not auto-open",
    );
    await page.getByRole("button", { name: "Open saved bundle on this device" }).click();
    await page
      .getByRole("button", { name: "Weekend look", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll("button")].find(
          (b) => b.textContent === "Front",
        )?.disabled,
    );
    assert.equal(
      await page
        .getByRole("button", { name: /Synthetic tee/ })
        .getAttribute("aria-pressed"),
      "true",
    );
    for (const name of ["Side", "Back", "Reset"])
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
    await page.getByRole("button", { name: "Close 3D bundle" }).click();
    await page
      .getByRole("heading", { name: "Start with your avatar" })
      .waitFor();
    assert.equal(await page.locator("canvas").count(), 0);
    await page.getByRole("button", { name: "Delete local save" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Local save deleted" })
      .waitFor();
    await page.getByRole("button", { name: "Open saved bundle on this device" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "No 3D bundle is saved" })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: avatar/shirt capture ZIP contents, image rejection, modal dismissal, GLB import, filter, compare, saved look, IndexedDB save/reload/restore/delete, camera and responsive layout (synthetic inputs)",
    );
  } finally {
    await browser.close();
  }
}
