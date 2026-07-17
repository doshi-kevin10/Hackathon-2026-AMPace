import { describe, expect, it } from "vitest";
import { buildNotifications } from "./watchtower";
import { mockDailySeries } from "@/lib/databricks/mock-data";

const co = (name: string, label: string) => ({ name, label, points: mockDailySeries(name).points });

describe("buildNotifications (deterministic watchtower)", () => {
  const notes = buildNotifications([
    co("excel_company_nike", "Nike"),
    co("excel_company_adidas", "Adidas"),
    co("excel_company_spotify", "Spotify"),
    co("excel_company_airbnb", "Airbnb"),
  ]);

  it("flags Adidas' CPC blow-up as unfavorable (warning/critical)", () => {
    const cpc = notes.find((n) => n.company === "excel_company_adidas" && n.metric === "cpc");
    expect(cpc).toBeDefined();
    expect(["warning", "critical"]).toContain(cpc!.severity);
    expect(cpc!.href).toBe("/datasets/excel_company_adidas/analytics");
  });

  it("flags Spotify's revenue spike as an anomaly", () => {
    const anom = notes.find((n) => n.company === "excel_company_spotify" && n.kind === "anomaly");
    expect(anom).toBeDefined();
  });

  it("surfaces Nike's revenue growth as positive", () => {
    const pos = notes.find((n) => n.company === "excel_company_nike" && n.severity === "positive");
    expect(pos).toBeDefined();
  });

  it("is sorted most-urgent first and every item deep-links to a company", () => {
    const rank = { critical: 4, warning: 3, positive: 2, info: 1 } as const;
    for (let i = 1; i < notes.length; i++) {
      expect(rank[notes[i - 1].severity]).toBeGreaterThanOrEqual(rank[notes[i].severity]);
    }
    notes.forEach((n) => expect(n.href).toMatch(/^\/datasets\/.+\/analytics$/));
  });
});
