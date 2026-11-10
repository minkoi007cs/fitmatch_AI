import { chromium } from "/home/claude/fitmatch-ux41/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
const axe = readFileSync("/tmp/claude-0/axe/node_modules/axe-core/axe.min.js", "utf8");
const base = "http://127.0.0.1:3330";
const b = await chromium.launch();
for (const [path, name] of [["/", "home"], ["/does-not-exist", "404"]]) for (const width of [320, 390, 820, 1440]) {
  const p = await b.newPage({ viewport: { width, height: width < 800 ? 844 : 900 } });
  await p.goto(base + path, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(2500);
  await p.screenshot({ path: `/tmp/claude-0/ux41/shots/${name}-${width}.png`, fullPage: false });
  const info = await p.evaluate(() => {
    const r = (el) => el && (({ top, bottom, left, right, height }) => ({ top, bottom, left, right, height }))(el.getBoundingClientRect());
    const hero = document.querySelector('section[aria-labelledby="hero-title"]');
    const cap = hero && [...hero.querySelectorAll("p")].find((x) => x.textContent.startsWith("Style reference photo"));
    const lock = hero && [...hero.querySelectorAll("div")].find((x) => x.textContent.startsWith("Sign in to access"));
    const nav = document.querySelector("header, nav");
    return { lang: document.documentElement.lang, scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
      hero: r(hero), caption: r(cap), lock: r(lock), h1: r(document.querySelector("h1")), nav: r(nav), title: document.title };
  });
  await p.addScriptTag({ content: axe });
  const res = await p.evaluate(async () => { const r = await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] });
    return { violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((x) => x.target.join(" ") + " :: " + (x.failureSummary || "").split("\n")[1]) })),
      incomplete: r.incomplete.filter((v) => v.id === "color-contrast").map((v) => v.nodes.length) }; });
  // keyboard: first Tab must reach skip link
  await p.keyboard.press("Tab");
  const focused = await p.evaluate(() => document.activeElement?.textContent?.trim());
  console.log(JSON.stringify({ path, width, ...info, firstTab: focused, axe: res }));
  await p.close();
}
await b.close();
