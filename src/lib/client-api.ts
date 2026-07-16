import type { ParsedWorkbook, TablePatch } from "@/lib/schemas/workbook";

export class ApiRequestError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const parseJson = async (res: Response) => {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiRequestError(
      body?.error?.code ?? "REQUEST_FAILED",
      body?.error?.message ?? `Request failed (${res.status})`
    );
  }
  return body;
};

export const fetchWorkbook = async (id: string): Promise<ParsedWorkbook> =>
  parseJson(await fetch(`/api/workbooks/${id}`));

export const patchTable = async (
  workbookId: string,
  tableId: string,
  patch: TablePatch
): Promise<ParsedWorkbook> =>
  parseJson(
    await fetch(`/api/workbooks/${workbookId}/tables/${tableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );

export interface SyncResponse {
  results: {
    tableId: string;
    name: string;
    status: "synced" | "skipped" | "failed";
    databricksTable?: string;
    rowCount?: number;
    reason?: string;
  }[];
  workbook: ParsedWorkbook;
}

export const syncWorkbook = async (workbookId: string): Promise<SyncResponse> =>
  parseJson(await fetch(`/api/workbooks/${workbookId}/sync`, { method: "POST" }));

export interface LiveTableResponse {
  columns: import("@/lib/schemas/workbook").ParsedColumn[];
  rows: Record<string, import("@/lib/schemas/workbook").CellValue>[];
  databricksTable: string;
  fetchedAt: string;
}

export const fetchLiveTable = async (
  workbookId: string,
  tableId: string
): Promise<LiveTableResponse> =>
  parseJson(await fetch(`/api/workbooks/${workbookId}/tables/${tableId}/live`));
