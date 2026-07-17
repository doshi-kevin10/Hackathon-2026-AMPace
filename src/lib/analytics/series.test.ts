import { describe, expect, it } from "vitest";
import { canonicalValue } from "@/lib/metrics/aggregate";
import {
  bucketByGranularity,
  detectGaps,
  seriesValues,
  weekStart,
  type DailyPoint,
} from "./series";

const p = (
  date: string,
  total_adspend: number | null,
  clicks: number | null,
  revenue: number | null,
  conversions: number | null
): DailyPoint => ({ date, total_adspend, clicks, revenue, conversions, rowCount: 1 });

describe("weekStart", () => {
  it("returns the Monday of the ISO week", () => {
    expect(weekStart("2026-01-01")).toBe("2025-12-29"); // Thu → Mon that week
    expect(weekStart("2026-01-05")).toBe("2026-01-05"); // Monday itself
    expect(weekStart("2026-01-11")).toBe("2026-01-05"); // Sunday → prior Monday
  });
});

describe("bucketByGranularity day", () => {
  it("makes one bucket per point and preserves totals", () => {
    const pts = [p("2026-01-01", 100, 50, 200, 5), p("2026-01-02", 300, 100, 900, 20)];
    const buckets = bucketByGranularity(pts, "day");
    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({ key: "2026-01-01", total_adspend: 100, clicks: 50, dayCount: 1 });
  });
});

describe("bucketByGranularity week — ratio-of-sums", () => {
  it("recomputes CPC from summed components, not the mean of daily CPC", () => {
    // Day 1 CPC = 100/50 = 2.0 ; Day 2 CPC = 300/100 = 3.0 ; mean of daily = 2.5
    // Correct weekly CPC = (100+300)/(50+100) = 400/150 = 2.6667
    const pts = [p("2026-01-05", 100, 50, 500, 5), p("2026-01-06", 300, 100, 900, 20)];
    const [wk] = bucketByGranularity(pts, "week");
    expect(wk.total_adspend).toBe(400);
    expect(wk.clicks).toBe(150);
    expect(canonicalValue("cpc", wk)).toBeCloseTo(400 / 150, 10);
    expect(canonicalValue("cpc", wk)).not.toBeCloseTo(2.5, 5);
  });

  it("groups days into the correct Monday-keyed weeks", () => {
    const pts = [
      p("2026-01-05", 10, 10, 10, 1), // Mon wk A
      p("2026-01-11", 20, 20, 20, 2), // Sun wk A
      p("2026-01-12", 40, 40, 40, 4), // Mon wk B
    ];
    const buckets = bucketByGranularity(pts, "week");
    expect(buckets.map((b) => b.key)).toEqual(["2026-01-05", "2026-01-12"]);
    expect(buckets[0]).toMatchObject({ total_adspend: 30, dayCount: 2 });
    expect(buckets[1]).toMatchObject({ total_adspend: 40, dayCount: 1 });
  });
});

describe("bucketByGranularity month", () => {
  it("groups by calendar month and sums additive components", () => {
    const pts = [
      p("2026-01-31", 100, 10, 0, 0),
      p("2026-02-01", 200, 20, 0, 0),
      p("2026-02-15", 300, 30, 0, 0),
    ];
    const buckets = bucketByGranularity(pts, "month");
    expect(buckets.map((b) => b.key)).toEqual(["2026-01", "2026-02"]);
    expect(buckets[1].total_adspend).toBe(500);
    expect(buckets[1].dayCount).toBe(2);
  });
});

describe("null handling", () => {
  it("sums only finite values; all-null metric → null", () => {
    const pts = [p("2026-01-05", 100, null, 50, null), p("2026-01-06", null, null, 50, null)];
    const [wk] = bucketByGranularity(pts, "week");
    expect(wk.total_adspend).toBe(100); // 100 + (null ignored)
    expect(wk.clicks).toBeNull(); // all null
    expect(wk.revenue).toBe(100);
    expect(canonicalValue("cpc", wk)).toBeNull(); // clicks null → null, no divide-by-zero
  });
});

describe("detectGaps", () => {
  it("finds missing calendar dates between first and last", () => {
    const pts = [p("2026-01-01", 1, 1, 1, 1), p("2026-01-02", 1, 1, 1, 1), p("2026-01-05", 1, 1, 1, 1)];
    expect(detectGaps(pts)).toEqual(["2026-01-03", "2026-01-04"]);
  });

  it("returns [] for a contiguous series", () => {
    const pts = [p("2026-01-01", 1, 1, 1, 1), p("2026-01-02", 1, 1, 1, 1)];
    expect(detectGaps(pts)).toEqual([]);
  });
});

describe("seriesValues", () => {
  it("maps each bucket to its canonical value", () => {
    const pts = [p("2026-01-01", 100, 50, 500, 5), p("2026-01-02", 300, 100, 900, 20)];
    const buckets = bucketByGranularity(pts, "day");
    expect(seriesValues(buckets, "total_adspend")).toEqual([100, 300]);
    expect(seriesValues(buckets, "cpc")).toEqual([2, 3]);
  });
});
