import { expect, test } from "@playwright/test";

test("unauthenticated users are redirected to login", async ({ page }) => {
  await page.goto("/datasets/excel_company_overstock");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "AMPulse" })).toBeVisible();
});

test("analyst logs in, sees company datasets, and opens live analytics", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);

  // Login form is prefilled with the analyst demo credentials.
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$|\/\?/);
  await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();

  // Dataset cards load from Databricks.
  const firstCard = page.locator('a[href^="/datasets/"]').first();
  await expect(firstCard).toBeVisible({ timeout: 30_000 });

  await firstCard.click();
  await expect(page).toHaveURL(/\/datasets\//);

  // Live grid renders with canonical metric columns.
  await expect(page.locator("table[role=grid]")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("auto-refreshes every 30s")).toBeVisible();
  await expect(page.getByRole("button", { name: /Total Adspend/ })).toBeVisible();
});
