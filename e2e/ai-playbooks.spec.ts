import { expect, test, type APIRequestContext } from "@playwright/test";

// These specs require the deterministic mock providers:
//   AI_MODE=mock PLAYBOOK_DATA_SOURCE=mock
// Run against a server started with those env vars (see README).

const EXAMPLE_INTENT =
  "Find high-spend companies whose ROAS has fallen by at least 15 percent compared with the previous period. " +
  "Only qualify companies with at least 10000 in current spend. Prioritize the largest estimated revenue gap using the previous period ROAS as the baseline.";

const analysisState = {
  schemaVersion: 1,
  datasetId: "excel_company_overstock",
  dateWindow: { kind: "rolling", unit: "day", count: 14, includeToday: false },
  comparison: { kind: "previous_period" },
  globalSearch: null,
  filters: [],
  sorting: [],
  visibleColumns: [],
  columnOrder: [],
  calculatedColumns: [{ id: "c1", name: "Profit", formula: "[Revenue] - [Total Adspend]", format: "currency" }],
  ranking: null,
};

async function login(request: APIRequestContext, email: string) {
  const res = await request.post("/api/auth/login", { data: { email, password: "ampulse" } });
  expect(res.ok()).toBeTruthy();
}

async function seedRun(request: APIRequestContext) {
  const compileRes = await request.post("/api/playbooks/compile", {
    data: {
      datasetId: "excel_company_overstock",
      userIntent: EXAMPLE_INTENT,
      analysisState,
      compactEventTrace: [],
      requestedScope: { type: "ALL_ACCESSIBLE_DATASETS" },
      requestedSchedule: { frequency: "MANUAL" },
      requestedComparison: { kind: "previous_period" },
      dateBehavior: "explicit_rolling",
    },
  });
  const compile = await compileRes.json();
  expect(compile.output.status).toBe("ready");

  const createRes = await request.post("/api/playbooks", {
    data: {
      draft: compile.output.draft,
      source: { datasetId: "excel_company_overstock", analysisState, compactEventTrace: [], userIntent: "e2e" },
      compiler: { ...compile.compiler, warnings: [] },
      activate: true,
      runNow: true,
    },
  });
  expect(createRes.status()).toBe(201);
}

test("unauthenticated users are redirected away from Playbooks and Opportunities", async ({ page }) => {
  await page.goto("/opportunities");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/playbooks");
  await expect(page).toHaveURL(/\/login/);
});

test("a viewer cannot create a playbook", async ({ request }) => {
  await login(request, "viewer@ampulse.dev");
  const res = await request.post("/api/playbooks/compile", {
    data: {
      datasetId: "excel_company_overstock",
      userIntent: "x",
      analysisState,
      compactEventTrace: [],
      requestedScope: { type: "ALL_ACCESSIBLE_DATASETS" },
      requestedSchedule: { frequency: "MANUAL" },
      requestedComparison: null,
      dateBehavior: "explicit_rolling",
    },
  });
  expect(res.status()).toBe(403);
});

test("analyst: compile → activate → run → inbox → detail → acted on → outcome not ready → investigation", async ({ page, context }) => {
  await login(context.request, "analyst@ampulse.dev");
  await seedRun(context.request);

  // Opportunity Inbox shows the ranked, deterministic result.
  await page.goto("/opportunities");
  await expect(page.getByText("Opportunity Inbox")).toBeVisible();
  const bbbCard = page.locator('a[href^="/opportunities/"]', { hasText: "BBB" }).first();
  await expect(bbbCard).toBeVisible({ timeout: 15_000 });
  await expect(bbbCard).toContainText("128,520"); // deterministic impact

  // Detail: deterministic evidence + impact formula + no-causation is shown once evaluated.
  await bbbCard.click();
  await expect(page).toHaveURL(/\/opportunities\//);
  await expect(page.getByRole("heading", { name: "Impact estimate" })).toBeVisible();
  await expect(page.getByText(/Estimated revenue gap/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Conditions/ })).toBeVisible();

  // Mark acted on.
  await page.getByRole("button", { name: "Mark acted on" }).click();
  await page.getByRole("button", { name: "Save action" }).click();
  await expect(page.getByText("ACTED_ON").first()).toBeVisible({ timeout: 10_000 });

  // Evaluate observed outcome → not ready + explicit non-causal caveat.
  await page.getByRole("button", { name: "Evaluate observed outcome" }).click();
  await expect(page.getByText(/does not establish causation/)).toBeVisible({ timeout: 10_000 });

  // Open the generated investigation.
  await page.getByRole("link", { name: "Open investigation" }).click();
  await expect(page).toHaveURL(/investigation=/);
});
