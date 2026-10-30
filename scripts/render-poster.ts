// Renders the hero device from the live 3D stage into public/poster.jpg (the still shown before
// WebGL loads, and when it can't). Run against a started build:
//   PORT=3100 pnpm start   then   pnpm tsx scripts/render-poster.ts http://localhost:3100
import { chromium } from "@playwright/test";

const base = process.argv[2] || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  // reduced motion: no sway, no jet, camera settled on the hero keyframe
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  await page.goto(base, { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.classList.contains("gl-on"), null, { timeout: 30000 });
  await page.addStyleTag({ content: ".story,.after,.top,.rail,.progress,.bar,.fallback-bg{visibility:hidden!important}" });
  await page.waitForTimeout(1500);
  // the hero keyframe puts the device right of centre; crop a tall frame around it
  await page.screenshot({ path: "public/poster.jpg", type: "jpeg", quality: 86, clip: { x: 860, y: 50, width: 300, height: 820 } });
  await browser.close();
  console.log("wrote public/poster.jpg (600x1640)");
})();
