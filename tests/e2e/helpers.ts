import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page, type TestInfo } from "@playwright/test";

config({ path: ".env.local" });

export const TEST_ADMIN = "e2e-admin@glowbite.test";
export const INTRUDER = "e2e-intruder@glowbite.test";

export const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** Clears leads and the rate-limit buckets so each test starts clean. */
export async function resetData() {
  const db = service();
  await db.from("leads").delete().not("id", "is", null);
  await db.from("rate_limits").delete().not("ip_hash", "is", null);
}

/** A valid, unique Indian mobile number (national digits) per test and project. */
export function phoneFor(info: TestInfo, n = 0): string {
  const project = info.project.name === "desktop" ? 1 : 2;
  const seed = (info.titlePath.join("|").split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 100000) + n;
  return `9${project}${String(seed).padStart(8, "0").slice(-8)}`;
}

export async function leadsByPhone(e164: string) {
  const { data, error } = await service().from("leads").select("*").eq("phone", e164);
  if (error) throw error;
  return data;
}

/** Scrolls the form into view (works with Lenis smooth scroll). */
export async function gotoForm(page: Page) {
  await page.locator("#formCard").scrollIntoViewIfNeeded();
  await expect(page.locator("#name")).toBeVisible();
}

/** Waits until the Turnstile widget (test keys) has produced a token. */
export async function waitForTurnstile(page: Page) {
  await expect
    .poll(async () => page.locator('input[name="cf-turnstile-response"]').inputValue().catch(() => ""), { timeout: 30_000 })
    .not.toBe("");
}

export async function fillLead(page: Page, v: { name?: string; phone: string; pin?: string; email?: string }) {
  await page.fill("#name", v.name ?? "Test Lead");
  await page.fill("#phone", v.phone);
  await page.fill("#pin", v.pin ?? "682001");
  if (v.email) await page.fill("#email", v.email);
}

/** Signs in as an admin without email: mints a magic-link token with the service role. */
export async function signInAs(page: Page, email: string) {
  const { data, error } = await service().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await page.goto(`/admin/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`);
}

/** Turnstile's dummy token, accepted by the always-pass test secret. */
export const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
