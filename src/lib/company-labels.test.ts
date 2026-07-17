import { describe, expect, it } from "vitest";
import { companyLabel } from "./company-labels";

describe("companyLabel", () => {
  it("applies demo overrides", () => {
    expect(companyLabel("excel_company_aa")).toBe("American Airlines");
    expect(companyLabel("excel_company_bbb")).toBe("BoB");
    expect(companyLabel("excel_company_overstock")).toBe("Amazon");
  });

  it("prettifies un-overridden slugs", () => {
    expect(companyLabel("excel_company_groupon")).toBe("Groupon");
    expect(companyLabel("excel_company_nike")).toBe("Nike");
  });
});
