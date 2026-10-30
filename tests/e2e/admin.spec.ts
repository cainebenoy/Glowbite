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
