/**
 * Minimal Databricks SQL Statement Execution API client (REST, no SDK).
 * Auth comes from the same env vars the databricks CLI uses — the token is
 * never exposed to the browser (server-only module).
 */

const HOST = process.env.DATABRICKS_HOST?.replace(/\/$/, "");
const TOKEN = process.env.DATABRICKS_TOKEN;
const WAREHOUSE_ID = process.env.DATABRICKS_WAREHOUSE_ID ?? "060a27190dd3ecb5"; // dev-SQLusers serverless

export class DatabricksError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "DatabricksError";
  }
}

// Mock mode is a valid data source, so it counts as "configured" — otherwise the
// dataset routes 503 before their own mock fallback runs. Inlined (not imported from
// mock-data) to avoid a client↔analytics↔mock-data import cycle.
export const databricksConfigured = (): boolean => process.env.AMPACE_MOCK !== "0" || Boolean(HOST && TOKEN);

interface StatementResult {
  columns: string[];
  rows: (string | null)[][];
}

const api = async (path: string, init?: RequestInit): Promise<Record<string, unknown>> => {
  if (!HOST || !TOKEN) {
    throw new DatabricksError(
      "NOT_CONFIGURED",
      "Databricks is not configured — set DATABRICKS_HOST and DATABRICKS_TOKEN"
    );
  }
  const res = await fetch(`${HOST}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new DatabricksError(
      String(body.error_code ?? res.status),
      String(body.message ?? `Databricks API error (${res.status})`)
    );
  }
  return body;
};

/** Execute one SQL statement and wait for completion (polls past the initial 30s window). */
export async function executeStatement(sql: string): Promise<StatementResult> {
  let res = await api("/api/2.0/sql/statements", {
    method: "POST",
    body: JSON.stringify({
      statement: sql,
      warehouse_id: WAREHOUSE_ID,
      wait_timeout: "30s",
      on_wait_timeout: "CONTINUE",
    }),
  });

  const deadline = Date.now() + 120_000;
  let status = (res.status as { state?: string; error?: { message?: string } }) ?? {};
  while ((status.state === "PENDING" || status.state === "RUNNING") && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await api(`/api/2.0/sql/statements/${res.statement_id as string}`);
    status = (res.status as typeof status) ?? {};
  }

  if (status.state !== "SUCCEEDED") {
    throw new DatabricksError(
      status.state ?? "FAILED",
      status.error?.message ?? `Statement did not succeed (state: ${status.state})`
    );
  }

  const manifest = res.manifest as
    | { schema?: { columns?: { name: string }[] } }
    | undefined;
  const result = res.result as { data_array?: (string | null)[][] } | undefined;
  return {
    columns: manifest?.schema?.columns?.map((c) => c.name) ?? [],
    rows: result?.data_array ?? [],
  };
}
