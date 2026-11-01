// The iPhone 13 profile on real WebKit (Safari's engine): `pnpm test:e2e:webkit`.
import { devices } from "@playwright/test";
import base from "./playwright.config";

const config = { ...base, projects: [{ name: "iphone-13-webkit", use: { ...devices["iPhone 13"] } }] };
export default config;
