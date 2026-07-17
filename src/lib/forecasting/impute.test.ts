import { describe, expect, it } from "vitest";
import { densify } from "./impute";

describe("densify", () => {
  it("fills interior calendar gaps by linear interpolation", () => {
    const d = densify([
      { date: "2026-01-01", value: 10 },
      { date: "2026-01-02", value: 20 },
      { date: "2026-01-04", value: 40 },
    ]);
    expect(d.dates).toEqual(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
    expect(d.values).toEqual([10, 20, 30, 40]); // 2026-01-03 interpolated
    expect(d.imputed).toBe(1);
  });

  it("back/forward-fills nulls at the ends", () => {
    const d = densify([
      { date: "2026-01-01", value: null },
      { date: "2026-01-02", value: 20 },
      { date: "2026-01-03", value: null },
    ]);
    expect(d.values).toEqual([20, 20, 20]);
    expect(d.imputed).toBe(2);
  });

  it("returns empty for no finite values", () => {
    expect(densify([{ date: "2026-01-01", value: null }]).values).toEqual([]);
  });
});
