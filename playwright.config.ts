import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });

const PORT = 3000;

// Cloudflare's published always-pass Turnstile test keys: verification runs for real, and always succeeds.
const TURNSTILE_TEST = {
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET: "1x0000000000000000000000000000000AA",
};

export default defineConfig({
  testDir: "tests/e2e",
  // tests share one database and one rate-limit bucket: run them one at a time
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // iPhone 13 profile (viewport, touch, UA, DPR) on Chromium for a stable Windows/CI run
    { name: "iphone-13", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: `http://localhost:${PORT}`,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
    env: { ...TURNSTILE_TEST, NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`, PORT: String(PORT) },
  },
});
