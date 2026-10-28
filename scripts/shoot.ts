// Screenshots each scene of the running site (desktop + phone) — for visual review against reference/screens.
// Usage: pnpm tsx scripts/shoot.ts [baseUrl] [outDir]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] || "http://localhost:3000";
const out = process.argv[3] || "test-results/shots";
mkdirSync(out, { recursive: true });

const SCENES = ["hero", "tank", "modes", "tips", "charging", "routine", "preorder"];

async function run(name: string, viewport: { width: number; height: number }, isMobile: boolean) {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: isMobile ? 2 : 1 });
  page.on("console", (m) => m.type() === "error" && console.log(`[${name}] console:`, m.text()));
  await page.goto(base, { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.classList.contains("gl-on"), null, { timeout: 30000 }).catch(() => console.log("no gl-on"));
  for (const id of SCENES) {
    const y = await page.evaluate((sid) => {
      const el = document.getElementById(sid)!;
      // land mid-pin (the prototype holds each scene for the first ~70% of its pin)
      return sid === "preorder" ? el.offsetTop : el.offsetTop + Math.max(0, el.offsetHeight - innerHeight) * 0.45;
    }, id);
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${out}/${name}-${id}.png` });
  }
  await browser.close();
}

(async () => {
  await run("desktop", { width: 1440, height: 900 }, false);
  await run("phone", { width: 390, height: 844 }, true);
  console.log("shots in", out);
})();
