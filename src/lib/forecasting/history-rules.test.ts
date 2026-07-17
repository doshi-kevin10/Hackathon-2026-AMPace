import { describe, expect, it } from "vitest";
import { allowedHorizons, isHorizonSupported, minObservationsFor, SUPPORTED_HORIZONS } from "./history-rules";

describe("history rules", () => {
  it("exposes the minimum observations per horizon", () => {
    expect(minObservationsFor(7)).toBe(42);
    expect(minObservationsFor(14)).toBe(60);
    expect(minObservationsFor(30)).toBe(120);
  });

  it("lists only horizons whose history requirement is met", () => {
    expect(allowedHorizons(30)).toEqual([]); // < 42
    expect(allowedHorizons(50)).toEqual([7]);
    expect(allowedHorizons(70)).toEqual([7, 14]);
    expect(allowedHorizons(130)).toEqual([7, 14, 30]);
  });

  it("checks a specific horizon", () => {
    expect(isHorizonSupported(14, 70)).toBe(true);
    expect(isHorizonSupported(30, 70)).toBe(false);
  });

  it("supported horizons are 7/14/30", () => {
    expect(SUPPORTED_HORIZONS).toEqual([7, 14, 30]);
  });
});
