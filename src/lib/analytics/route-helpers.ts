/**
 * Shared route preamble for the analytics/forecast APIs. Called independently by
 * EVERY route so company authorization is enforced per-request (never trusted
 * from the client): authenticate → resolve dataset access → confirm Databricks
 * is configured. Returns either the authorized user or the exact error response.
 */
import { NextResponse } from "next/server";
import { databricksDatasetAccessProvider, DatasetAccessError } from "@/lib/access/dataset-access-provider";
import type { SessionUser } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/server";
import { databricksConfigured } from "@/lib/databricks/client";
import type { ZodType } from "zod";

export type Authorized = { ok: true; user: SessionUser } | { ok: false; response: NextResponse };

const err = (code: string, message: string, status: number) =>
  NextResponse.json({ error: { code, message } }, { status });

export async function authorizeCompany(name: string): Promise<Authorized> {
  const user = await requireUser();
  if (user instanceof NextResponse) return { ok: false, response: user };

  try {
    await databricksDatasetAccessProvider.assertDatasetAccess(user, name);
  } catch (e) {
    if (e instanceof DatasetAccessError) {
      const status = e.code === "NOT_FOUND" ? 404 : 403;
      return { ok: false, response: err(e.code, e.message, status) };
    }
    return { ok: false, response: err("ACCESS_CHECK_FAILED", "Could not verify access", 502) };
  }

  if (!databricksConfigured()) {
    return { ok: false, response: err("NOT_CONFIGURED", "Databricks is not configured", 503) };
  }
  return { ok: true, user };
}

/** Parse+validate a JSON body against a Zod schema; returns data or a 400 response. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const json = await req.json().catch(() => null);
  const result = schema.safeParse(json);
  if (!result.success) {
    return { ok: false, response: err("INVALID_REQUEST", "Invalid request body", 400) };
  }
  return { ok: true, data: result.data };
}
