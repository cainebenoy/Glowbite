// One-off: run the iPhone 13 profile on real WebKit (Safari's engine). `pnpm exec playwright test -c playwright.webkit.config.ts`
import { devices } from "@playwright/test";
import base from "./playwright.config";

export default { ...base, projects: [{ name: "iphone-13-webkit", use: { ...devices["iPhone 13"] } }] };
