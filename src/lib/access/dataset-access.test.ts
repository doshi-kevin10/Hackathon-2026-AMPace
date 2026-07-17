import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/config";
import {
  DatasetAccessError,
  intersectAccess,
  type DatasetAccessProvider,
  type DatasetDescriptor,
} from "./dataset-access-provider";

const d = (id: string): DatasetDescriptor => ({ id, label: id, latestDate: null, rowCount: 0, availableFields: [] });
const user: SessionUser = { email: "a@x.dev", name: "A", role: "ANALYST" };

describe("intersectAccess", () => {
  const accessible = [d("excel_company_a"), d("excel_company_b")];
  it("keeps only accessible ids, preserving requested order", () => {
    const r = intersectAccess(["excel_company_b", "excel_company_a"], accessible);
    expect(r.map((x) => x.id)).toEqual(["excel_company_b", "excel_company_a"]);
  });
  it("drops unknown/unauthorized ids", () => {
    expect(intersectAccess(["excel_company_a", "nope", "../evil"], accessible).map((x) => x.id)).toEqual(["excel_company_a"]);
  });
  it("dedups", () => {
    expect(intersectAccess(["excel_company_a", "excel_company_a"], accessible).length).toBe(1);
  });
});

describe("DatasetAccessProvider contract", () => {
  const provider: DatasetAccessProvider = {
    listAccessibleDatasets: async () => [d("excel_company_a")],
    async assertDatasetAccess(u, id) {
      const list = await this.listAccessibleDatasets(u);
      const m = list.find((x) => x.id === id);
      if (!m) throw new DatasetAccessError("FORBIDDEN", "no access");
      return m;
    },
  };

  it("resolves an accessible dataset", async () => {
    expect((await provider.assertDatasetAccess(user, "excel_company_a")).id).toBe("excel_company_a");
  });
  it("throws for an inaccessible dataset", async () => {
    await expect(provider.assertDatasetAccess(user, "excel_company_secret")).rejects.toBeInstanceOf(DatasetAccessError);
  });
});
