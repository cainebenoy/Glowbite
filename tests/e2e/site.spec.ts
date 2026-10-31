import { expect, test } from "@playwright/test";
import { DUMMY_TOKEN, fillLead, gotoForm, leadsByPhone, phoneFor, resetData, waitForTurnstile } from "./helpers";

test.beforeEach(async () => {
  await resetData();
});

test("1. landing renders the full text content with JavaScript disabled", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/");
  // textContent (whitespace-collapsed): WebKit's innerText drops the space where the headline wraps between word spans
  const text = ((await page.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
  for (const s of [
    "A fresher-feeling clean, made simple.",
    "Discover the GlowBite Water Flosser",
    "Join the Pre-order List",
    "₹1,299",
    "Pre-order interest price",
    "No payment taken now.",
    "A generous 350 ml tank.",
    "Multiple modes for a personalised feel, including a child mode.",
    "Multiple tips for different users and routines.",
    "Portable, rechargeable convenience over USB-C.",
    "Fill.",
    "Choose.",
    "Glide.",
    "Be first",
    "Free shipping, subject to confirmed terms",
    "Dispatch timing will be confirmed before your order is finalised",
    "Product details, availability, shipping and warranty terms will be confirmed before your order is finalised.",
    "At a glance.",
    "What is a water flosser?",
    "Is it suitable for children?",
    "Your details are used only to contact you",
  ])
    expect(text, `missing: ${s}`).toContain(s);
  // gated claims stay hidden by default
  expect(text).not.toContain("IPX7");
  expect(text).not.toMatch(/MRP|Warranty: /);
  await ctx.close();
});

test("2. every CTA reaches the form", async ({ page }, info) => {
  await page.goto("/");
  const ctas = info.project.name === "desktop" ? ["header", "hero"] : ["hero", "sticky"];
  for (const where of ctas) {
    await page.evaluate(() => window.scrollTo(0, 0));
    if (where === "sticky") {
      await page.evaluate(() => window.scrollTo(0, innerHeight * 3));
      await expect(page.locator("#bar")).toHaveClass(/show/);
    }
    await page.locator(`[data-cta="${where}"]`).click();
    // the card can be taller than a phone screen: check the section heading and the card top arrive on screen
    await expect(page.locator("#preorder-title")).toBeInViewport({ timeout: 20_000 }); // headroom: the 3D scene builds on first scroll (slow under software WebGL in CI)
    await expect(page.locator("#formCard")).toBeInViewport();
  }
});

test("3. invalid submit shows inline errors and focuses the first one", async ({ page }) => {
  await page.goto("/");
  await gotoForm(page);
  await page.fill("#phone", "12345");
  await page.locator("button[type=submit]").click();
  await expect(page.locator("#e-name")).toHaveText("Enter your full name.");
  await expect(page.locator("#e-phone")).toHaveText("Enter a 10-digit Indian mobile number.");
  await expect(page.locator("#e-pin")).toHaveText("Enter a valid 6-digit PIN code.");
  await expect(page.locator("#name")).toBeFocused();
  await expect(page.locator("#name")).toHaveAttribute("aria-invalid", "true");
});

test("4. valid submit shows success and saves a normalised lead", async ({ page }, info) => {
  const digits = phoneFor(info);
  await page.goto("/?utm_source=e2e&utm_campaign=launch");
  await gotoForm(page);
  await fillLead(page, { name: "Asha Menon", phone: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`, email: "asha@example.in" });
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.locator("#optin").check();
  await waitForTurnstile(page);
  await page.locator("button[type=submit]").click();
  const done = page.getByTestId("lead-done");
  await expect(done).toContainText("You're on the list!");
  await expect(done).toContainText("No payment has been taken.");
  const rows = await leadsByPhone(`+91${digits}`);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    full_name: "Asha Menon",
    phone: `+91${digits}`,
    pin_code: "682001",
    email: "asha@example.in",
    quantity: 2,
    marketing_opt_in: true,
    status: "new",
    price_shown: 1299,
    utm: { utm_source: "e2e", utm_campaign: "launch" },
  });
  expect(rows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
});

test("5. the same phone again says already on the list and keeps one row", async ({ page }, info) => {
  const digits = phoneFor(info);
  const first = await page.request.post("/api/leads", {
    data: { name: "First Time", phone: digits, pin: "682001", quantity: 1, turnstileToken: DUMMY_TOKEN },
  });
  expect((await first.json()).status).toBe("created");
  await page.goto("/");
  await gotoForm(page);
  await fillLead(page, { name: "Second Time", phone: `0${digits}` });
  await waitForTurnstile(page);
  await page.locator("button[type=submit]").click();
  await expect(page.getByTestId("lead-done")).toContainText("You're already on the list.");
  const rows = await leadsByPhone(`+91${digits}`);
  expect(rows).toHaveLength(1);
  expect(rows[0].full_name).toBe("First Time");
});

test("6. honeypot submit shows success but saves nothing", async ({ page }, info) => {
  const digits = phoneFor(info);
  await page.goto("/");
  await gotoForm(page);
  await fillLead(page, { phone: digits });
  await page.locator("#company").fill("Bot Co", { force: true });
  await waitForTurnstile(page);
  await page.locator("button[type=submit]").click();
  await expect(page.getByTestId("lead-done")).toContainText("You're on the list!");
  expect(await leadsByPhone(`+91${digits}`)).toHaveLength(0);
});

test("7. the 6th rapid submit is refused politely", async ({ page }, info) => {
  for (let i = 0; i < 5; i++) {
    const r = await page.request.post("/api/leads", {
      data: { name: "Rapid Fire", phone: phoneFor(info, i + 1), pin: "682001", quantity: 1, turnstileToken: DUMMY_TOKEN },
    });
    expect(r.status()).toBe(200);
  }
  await page.goto("/");
  await gotoForm(page);
  const digits = phoneFor(info, 9);
  await fillLead(page, { phone: digits });
  await waitForTurnstile(page);
  await page.locator("button[type=submit]").click();
  await expect(page.getByRole("alert").filter({ hasText: "Too many attempts" })).toBeVisible();
  // the visitor's details stay in the form
  await expect(page.locator("#phone")).toHaveValue(digits);
  expect(await leadsByPhone(`+91${digits}`)).toHaveLength(0);
});

test("10a. no horizontal scroll at 360px", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/");
  for (const y of [0, 0.25, 0.5, 0.75, 1]) {
    await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), y);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
  await ctx.close();
});

test("10b. reduced motion has no running animations", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.waitForLoadState("load");
  await page.evaluate(() => window.scrollTo(0, innerHeight * 2));
  await page.waitForTimeout(500);
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
  expect(running).toBe(0);
  // counters jump to their final values
  await expect(page.locator("#ml")).toHaveText("350");
  await ctx.close();
});
