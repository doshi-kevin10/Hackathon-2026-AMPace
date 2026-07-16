import { expect, test } from "@playwright/test";

test("upload a workbook and see sheets and detected tables", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Excel Table Studio" })).toBeVisible();

  // The dropzone's file input is visually hidden; setInputFiles works regardless.
  await page.locator('input[type="file"]').setInputFiles("fixtures/two-tables-one-sheet.xlsx");

  await page.waitForURL(/\/workbooks\/[0-9a-f-]+/);

  // Workbook summary
  await expect(page.getByRole("heading", { name: "two-tables-one-sheet.xlsx" })).toBeVisible();

  // Sidebar lists both sheets with their table counts
  const stacked = page.getByRole("button", { name: /Stacked/ });
  const sideBySide = page.getByRole("button", { name: /SideBySide/ });
  await expect(stacked).toBeVisible();
  await expect(sideBySide).toBeVisible();

  // Both detected tables on the first sheet render as cards with their ranges
  await expect(page.getByRole("heading", { name: "Table 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Table 2" })).toBeVisible();
  await expect(page.getByText("A1:C4")).toBeVisible();
  await expect(page.getByText("A7:C10")).toBeVisible();

  // Data preview shows real cell content
  await expect(page.getByText("Doohickey")).toBeVisible();

  // Switching sheets shows that sheet's tables
  await sideBySide.click();
  await expect(page.getByText("D1:E4")).toBeVisible();
});
