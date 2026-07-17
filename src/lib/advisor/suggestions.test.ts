import { describe, expect, it } from "vitest";
import type { DatasetBehavior } from "@/lib/activity/behavior";
import type { Dataset } from "@/lib/databricks/analytics";
import { buildSuggestions } from "./suggestions";

const ds = (name: string, label: string, latestDate: string): Dataset => ({
  name,
  label,
  fqn: `x.${name}`,
  rowCount: 100,
  latestDate,
  avgRoas: 3,
  avgCpa: null,
  usesCpa: false,
  totalAdspend: 1000,
});

const beh = (o: Partial<DatasetBehavior>): DatasetBehavior => ({
  views: 0,
  analyticsViews: 0,
  lastViewedAt: null,
  lastSeenLatestDate: null,
  ...o,
});

const AA = ds("excel_company_aa", "American Airlines", "2026-07-20");
const BOB = ds("excel_company_bbb", "BoB", "2026-07-20");

describe("buildSuggestions", () => {
  it("is empty when the user has done nothing", () => {
    expect(buildSuggestions([AA, BOB], {})).toEqual([]);
  });

  it("fires 'new data' when latest date advanced since the last visit", () => {
    const s = buildSuggestions([AA], {
      excel_company_aa: beh({ views: 3, lastViewedAt: "2026-07-17T09:00:00Z", lastSeenLatestDate: "2026-07-18" }),
    });
    expect(s).toHaveLength(1);
    expect(s[0].id).toBe("fresh:excel_company_aa");
    expect(s[0].body).toContain("2 new days");
  });

  it("flags an unopened Analytics tab after repeat visits", () => {
    const s = buildSuggestions([AA], {
      excel_company_aa: beh({ views: 3, analyticsViews: 0, lastViewedAt: "2026-07-20T09:00:00Z", lastSeenLatestDate: "2026-07-20" }),
    });
    expect(s.map((x) => x.id)).toContain("analytics:excel_company_aa");
  });

  it("nudges about a never-opened company once the user is active elsewhere", () => {
    const s = buildSuggestions([AA, BOB], {
      excel_company_aa: beh({ views: 2, analyticsViews: 1, lastViewedAt: "2026-07-20T09:00:00Z", lastSeenLatestDate: "2026-07-20" }),
    });
    const neglected = s.find((x) => x.id === "neglected:excel_company_bbb");
    expect(neglected).toBeDefined();
    expect(neglected!.body).toContain("American Airlines");
  });

  it("ranks fresh data ahead of neglected companies", () => {
    const s = buildSuggestions([AA, BOB], {
      excel_company_aa: beh({ views: 2, analyticsViews: 1, lastViewedAt: "2026-07-20T09:00:00Z", lastSeenLatestDate: "2026-07-18" }),
    });
    expect(s[0].tone).toBe("new");
  });
});
