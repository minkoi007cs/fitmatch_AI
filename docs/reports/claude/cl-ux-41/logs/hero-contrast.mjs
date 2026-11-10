import { chromium } from "/home/claude/fitmatch-ux41/node_modules/playwright/index.mjs";
import sharp from "/home/claude/fitmatch-ux41/node_modules/sharp/dist/index.cjs";
import { readFileSync } from "node:fs";
const img = readFileSync(process.argv[2]);
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const b = await chromium.launch();
for (const width of [320, 390, 820, 1440]) {
  const p = await b.newPage({ viewport: { width, height: width < 800 ? 844 : 900 } });
  await p.route("**/_next/image**", (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: img }));
  await p.goto("http://127.0.0.1:3330/", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(2000);
  const targets = await p.evaluate(() => {
    const hero = document.querySelector('section[aria-labelledby="hero-title"]');
    return [...hero.querySelectorAll("p, h1, h1 span, a, div.mt-8")].filter((e) => e.childNodes.length && e.textContent.trim()).map((e, i) => {
      e.dataset.ct = i; const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
      const cv = document.createElement("canvas").getContext("2d"); cv.clearRect(0, 0, 1, 1); cv.fillStyle = c.color; cv.fillRect(0, 0, 1, 1);
      const d = cv.getImageData(0, 0, 1, 1).data; const rgba = `rgba(${d[0]},${d[1]},${d[2]},${(d[3] / 255).toFixed(3)})`;
      return { i, text: e.textContent.trim().slice(0, 40), color: rgba, x: r.left, y: r.top, w: r.width, h: r.height, link: e.tagName === "A" };
    });
  });
  const shot = await p.screenshot();
  await p.addStyleTag({ content: 'section[aria-labelledby="hero-title"] *:not(img) { color: transparent !important; } section[aria-labelledby="hero-title"] a { visibility: hidden !important; }' });
  const bg = await sharp(await p.screenshot()).raw().toBuffer({ resolveWithObject: true });
  for (const t of targets.filter((t) => !t.link)) {
    const rgba = t.color.match(/[\d.]+/g).map(Number); // composite text color over bg approx: use alpha
    let worst = Infinity;
    for (let y = Math.max(0, Math.floor(t.y)); y < Math.min(bg.info.height, t.y + t.h); y += 2)
      for (let x = Math.max(0, Math.floor(t.x)); x < Math.min(bg.info.width, t.x + t.w); x += 2) {
        const o = (y * bg.info.width + x) * bg.info.channels; const bgc = [bg.data[o], bg.data[o + 1], bg.data[o + 2]];
        const a = rgba[3] ?? 1; const fg = [0, 1, 2].map((k) => rgba[k] * a + bgc[k] * (1 - a));
        worst = Math.min(worst, cr(fg, bgc));
      }
    console.log(width, `min ${worst.toFixed(2)}:1`, JSON.stringify(t.text), t.color);
  }
  await p.close();
}
await b.close();
