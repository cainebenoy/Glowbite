// Renders the hero device from the live 3D stage into the stills shown before WebGL loads (and when
// it can't): public/poster.jpg (desktop framing) and public/poster-phone.jpg (phone framing).
// The crops match the poster CSS in app/globals.css (.fallback-prod). Run against a started build:
//   PORT=3100 pnpm start   then   pnpm tsx scripts/render-poster.ts http://localhost:3100
import { chromium, type Page } from "@playwright/test";

const base = process.argv[2] || "http://localhost:3000";
const HIDE = ".story,.after,.top,.rail,.progress,.bar,.fallback-bg{visibility:hidden!important}";

async function settle(page: Page) {
  await page.goto(base, { waitUntil: "load" });
  await page.waitForTimeout(2500); // let React hydrate before interacting
  // phones mount the stage on first interaction: nudge the scroll, then return to the hero
  await page.evaluate(() => window.scrollTo(0, 1));
  await page.waitForFunction(() => document.documentElement.classList.contains("gl-on"), null, { timeout: 60000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(2500);
}

(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  // reduced motion: no sway, no jet, camera settled on the hero keyframe

  const only = process.argv[3]; // "desk" | "phone" to render just one
  if (only !== "phone") {
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  await settle(desk);
  // device right of centre → CSS: left 59.7vw, top 5.5vh, height 91vh
  await desk.screenshot({ path: "public/poster.jpg", type: "jpeg", quality: 86, timeout: 180000, clip: { x: 860, y: 50, width: 300, height: 820 } });
  }

  if (only !== "desk") {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await settle(phone);
  // device centred → CSS (max-width: 860px): centred, top 5.33vh, height 62.8vh
  await phone.screenshot({ path: "public/poster-phone.jpg", type: "jpeg", quality: 84, timeout: 180000, clip: { x: 95, y: 45, width: 200, height: 530 } });
  }

  await browser.close();
  console.log("wrote public/poster.jpg (600x1640) and public/poster-phone.jpg (400x1060)");
})();
