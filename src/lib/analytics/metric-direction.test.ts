import { describe, expect, it } from "vitest";
import { directionFor, sentimentFor, METRIC_DIRECTION } from "./metric-direction";

describe("directionFor", () => {
  it("maps canonical fields to their optimisation direction", () => {
    expect(METRIC_DIRECTION.revenue).toBe("higher_is_better");
    expect(METRIC_DIRECTION.roas).toBe("higher_is_better");
    expect(METRIC_DIRECTION.cvr).toBe("higher_is_better");
    expect(METRIC_DIRECTION.conversions).toBe("higher_is_better");
    expect(METRIC_DIRECTION.cpc).toBe("lower_is_better");
    expect(METRIC_DIRECTION.total_adspend).toBe("context");
    expect(METRIC_DIRECTION.clicks).toBe("context");
  });

  it("treats CPA (a read-layer relabel, not a canonical id) as lower-is-better", () => {
    expect(directionFor("CPA")).toBe("lower_is_better");
    expect(directionFor("cpa")).toBe("lower_is_better");
  });
});

describe("sentimentFor", () => {
  it("higher-is-better: up favorable, down unfavorable", () => {
    expect(sentimentFor("revenue", 0.1)).toBe("favorable");
    expect(sentimentFor("revenue", -0.1)).toBe("unfavorable");
  });

  it("lower-is-better: down favorable, up unfavorable", () => {
    expect(sentimentFor("cpc", -0.1)).toBe("favorable");
    expect(sentimentFor("cpc", 0.1)).toBe("unfavorable");
  });

  it("context metrics are always neutral", () => {
    expect(sentimentFor("total_adspend", 0.5)).toBe("neutral");
    expect(sentimentFor("clicks", -0.5)).toBe("neutral");
  });

  it("changes within epsilon are neutral (noise is not a movement)", () => {
    expect(sentimentFor("revenue", 0.001)).toBe("neutral");
    expect(sentimentFor("cpc", -0.001)).toBe("neutral");
    expect(sentimentFor("revenue", 0.02, 0.05)).toBe("neutral"); // custom epsilon
  });

  it("null change is neutral", () => {
    expect(sentimentFor("revenue", null)).toBe("neutral");
  });
});
