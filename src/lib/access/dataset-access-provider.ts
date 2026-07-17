/**
 * Server-side dataset access resolution (§11). The browser never decides access;
 * scope is intersected with this provider at compile, activate, and every run.
 * Model-supplied dataset ids are always re-checked here.
 *
 * MVP: any authenticated user can access every `excel_company_*` table (single
 * tenant demo). The interface leaves room for per-user company assignment later
 * without touching callers.
 */
import type { SessionUser } from "@/lib/auth/config";
import { isValidDatasetName, listDatasets } from "@/lib/databricks/analytics";
import { CANONICAL_FIELD_IDS, type CanonicalFieldId } from "@/lib/metrics/canonical-registry";

export type AuthenticatedUser = SessionUser;

export interface DatasetDescriptor {
  id: string;
  label: string;
  latestDate: string | null;
  rowCount: number;
  /** Canonical fields available in this dataset (all share the fixed 9-col schema). */
  availableFields: CanonicalFieldId[];
}

export interface DatasetAccessProvider {
  listAccessibleDatasets(user: AuthenticatedUser): Promise<DatasetDescriptor[]>;
  /** Resolve one dataset, throwing DatasetAccessError if the user can't access it. */
  assertDatasetAccess(user: AuthenticatedUser, datasetId: string): Promise<DatasetDescriptor>;
}

export class DatasetAccessError extends Error {
  constructor(
    public code: "FORBIDDEN" | "NOT_FOUND",
    message: string
  ) {
    super(message);
    this.name = "DatasetAccessError";
  }
}

/** Default provider backed by the existing Databricks table allowlist. */
export const databricksDatasetAccessProvider: DatasetAccessProvider = {
  async listAccessibleDatasets() {
    const datasets = await listDatasets();
    return datasets.map((d) => ({
      id: d.name,
      label: d.label,
      latestDate: d.latestDate,
      rowCount: d.rowCount,
      availableFields: [...CANONICAL_FIELD_IDS],
    }));
  },

  async assertDatasetAccess(user, datasetId) {
    if (!isValidDatasetName(datasetId)) {
      throw new DatasetAccessError("NOT_FOUND", `Unknown dataset "${datasetId}"`);
    }
    const accessible = await this.listAccessibleDatasets(user);
    const match = accessible.find((d) => d.id === datasetId);
    if (!match) throw new DatasetAccessError("FORBIDDEN", `No access to dataset "${datasetId}"`);
    return match;
  },
};

/**
 * Intersect a set of requested dataset ids with the user's accessible datasets.
 * Unknown/unauthorized ids are dropped (never trusted from the client or model).
 */
export function intersectAccess(requested: string[], accessible: DatasetDescriptor[]): DatasetDescriptor[] {
  const byId = new Map(accessible.map((d) => [d.id, d]));
  const seen = new Set<string>();
  const out: DatasetDescriptor[] = [];
  for (const id of requested) {
    const d = byId.get(id);
    if (d && !seen.has(id)) {
      seen.add(id);
      out.push(d);
    }
  }
  return out;
}
