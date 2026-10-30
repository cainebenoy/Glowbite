import { expect, test } from "@playwright/test";
import { DEFAULT_SETTINGS } from "../../lib/settings";
import { INTRUDER, resetData, service, signInAs, TEST_ADMIN } from "./helpers";

test.beforeEach(async () => {
  await resetData();
});

test("8a. /admin redirects to login when signed out", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
  const csv = await page.request.get("/admin/export");
  expect(csv.status()).toBe(401);
});

test("8b. a non-allowlisted session is rejected and signed out", async ({ page }) => {
  await signInAs(page, INTRUDER);
  await expect(page).toHaveURL(/\/admin\/login\?error=not_authorised/);
  await expect(page.getByRole("alert").filter({ hasText: "isn't authorised" })).toBeVisible();
  // the session is gone: going back to /admin lands on plain login
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("8d. the real magic-link flow signs an allowlisted admin in (email via Mailpit)", async ({ page }) => {
  const MAILPIT = "http://127.0.0.1:54324";
  const inbox = async () =>
    ((await (await page.request.get(`${MAILPIT}/api/v1/messages`)).json()) as { messages: { ID: string; To: { Address: string }[]; Created: string }[] })
      .messages.filter((m) => m.To.some((t) => t.Address.toLowerCase() === TEST_ADMIN));
  const before = new Set((await inbox()).map((m) => m.ID));

  await page.goto("/admin/login");
  await page.getByLabel("Admin email").fill(TEST_ADMIN);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("sign-in link is on its way");

  let id = "";
  await expect
    .poll(async () => {
      id = (await inbox()).find((m) => !before.has(m.ID))?.ID ?? "";
      return id;
    }, { timeout: 20_000 })
    .not.toBe("");
  const msg = (await (await page.request.get(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text: string; HTML: string };
  const link = (msg.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1] ?? msg.Text.match(/(https?:\/\/\S*\/auth\/v1\/verify\S*)/)?.[1] ?? "").replace(/&amp;/g, "&");
  expect(link, "magic link in email").toContain("/auth/v1/verify");

  await page.goto(link);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText(TEST_ADMIN)).toBeVisible();
});

test("8e. a non-allowlisted email gets the same reply but no email", async ({ page }) => {
  const MAILPIT = "http://127.0.0.1:54324";
  const count = async () =>
    ((await (await page.request.get(`${MAILPIT}/api/v1/messages`)).json()) as { messages: { To: { Address: string }[] }[] }).messages.filter(
      (m) => m.To.some((t) => t.Address.toLowerCase() === INTRUDER),
    ).length;
  const before = await count();
  await page.goto("/admin/login");
  await page.getByLabel("Admin email").fill(INTRUDER);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("sign-in link is on its way");
  await page.waitForTimeout(2000);
  expect(await count()).toBe(before);
});

test("8c. an allowlisted admin sees leads and can export CSV", async ({ page }) => {
  await service()
    .from("leads")
    .insert({ full_name: "Export, Test", phone: "+919811111111", pin_code: "560001", consent_text_version: "t" });
  await signInAs(page, TEST_ADMIN);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/leads");
  await expect(page.getByRole("link", { name: "Export, Test" })).toBeVisible();
  const res = await page.request.get("/admin/export");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body.charCodeAt(0)).toBe(0xfeff);
  expect(body).toContain('"Export, Test"');
  expect(body).toContain("+91 98111 11111");
});

test("9. toggling IPX7 in settings shows the IPX7 scene and spec", async ({ page }) => {
  const db = service();
  try {
    await page.goto("/");
    await expect(page.locator("#ipx7")).toHaveCount(0);

    await signInAs(page, TEST_ADMIN);
    await page.goto("/admin/settings");
    await page.locator('input[name="ipx7_verified"]').check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Saved. The live page is updating.")).toBeVisible();

    await expect
      .poll(
        async () => {
          await page.goto("/");
          return page.locator("#ipx7").count();
        },
        { timeout: 20_000 },
      )
      .toBe(1);
    await expect(page.locator("#ipx7")).toContainText("Rated IPX7 for water resistance.");
    await expect(page.getByTestId("spec-grid")).toContainText("IPX7");
    await expect(page.locator("#rail button[data-go=ipx7]")).toHaveCount(1);
  } finally {
    // restore defaults through the same path (so the static page is revalidated)
    await page.goto("/admin/settings");
    const box = page.locator('input[name="ipx7_verified"]');
    if (await box.isChecked()) {
      await box.uncheck();
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Saved. The live page is updating.")).toBeVisible();
    }
    await db.from("settings").update({ data: DEFAULT_SETTINGS }).eq("id", 1);
  }
});
