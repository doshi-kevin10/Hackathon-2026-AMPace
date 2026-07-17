import { expect, test } from "@playwright/test";

/**
 * The 10-step advanced-analytics workspace flow. Targets a company with ample
 * history (BBB) so a 14-day forecast is supported. Requires a configured
 * Databricks env (same as analytics.spec.ts).
 */
test("advanced analytics workspace: history, comparison, trend, forecast, export", async ({ page }) => {
  // Log in (form is prefilled with the analyst demo credentials).
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible({ timeout: 30_000 });

  // 1) Open a company → advanced analytics workspace.
  const bbbCard = page.locator("div.group", { hasText: "BBB" }).first();
  await expect(bbbCard).toBeVisible({ timeout: 30_000 });
  await bbbCard.getByRole("link", { name: "Advanced analytics →" }).click();
  await expect(page).toHaveURL(/\/datasets\/.+\/analytics/);
  await expect(page.getByText(/observations/)).toBeVisible({ timeout: 60_000 });

  // 2) Change date range.
  await page.locator("#from").fill("2020-01-01");
  await expect(page.getByText(/observations/)).toBeVisible({ timeout: 60_000 });

  // 3) Compare with a different period.
  await page.getByLabel("Compare to").selectOption("previous_week");
  await expect(page.getByText("Period comparison")).toBeVisible({ timeout: 60_000 });

  // 4) View the historical time-series chart.
  await expect(page.locator("svg[aria-label^='Time series']").first()).toBeVisible({ timeout: 60_000 });

  // 5) Trend / driver analysis is present.
  await expect(page.getByText("Baseline & trend")).toBeVisible();
  await expect(page.getByText("Why did it change?")).toBeVisible();

  // 6/7) Forecast tab → Revenue, 14-day horizon.
  await page.getByRole("tab", { name: "Forecast" }).click();
  await page.getByLabel("Forecast metric").selectOption("revenue");
  await page.getByLabel("Forecast horizon").selectOption("14");

  // 8) Forecast line + shaded interval.
  await expect(page.locator("svg[aria-label*='Forecast']")).toBeVisible({ timeout: 60_000 });

  // 9) Model used + backtest accuracy.
  await expect(page.getByText(/^model:/)).toBeVisible();
  await expect(page.getByText(/^confidence:/)).toBeVisible();

  // 10) Export forecast results (CSV download).
  const exportBtn = page.getByRole("button", { name: /Export CSV/ });
  await expect(exportBtn).toBeVisible();
  const download = page.waitForEvent("download");
  await exportBtn.click();
  expect((await download).suggestedFilename()).toContain("forecast");
});
