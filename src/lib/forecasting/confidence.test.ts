import { describe, expect, it } from "vitest";
import { classifyConfidence } from "./confidence";

const good = {
  observations: 200,
  minObservations: 42,
  dataQualityScore: 100,
  wape: 0,
  meanRelativeIntervalWidth: 0.05,
  windowStability: 1,
};
const bad = {
  observations: 42,
  minObservations: 42,
  dataQualityScore: 40,
  wape: 0.5,
  meanRelativeIntervalWidth: 0.9,
  windowStability: 0.2,
};

describe("classifyConfidence (deterministic — never from an LLM)", () => {
  it("scores plentiful, accurate, precise, stable forecasts high", () => {
    const c = classifyConfidence(good);
    expect(c.label).toBe("high");
    expect(c.score).toBeGreaterThan(0.66);
  });

  it("scores sparse, inaccurate, wide, unstable forecasts low", () => {
    expect(classifyConfidence(bad).label).toBe("low");
  });

  it("worse backtest error lowers the score, all else equal", () => {
    const better = classifyConfidence({ ...good, wape: 0.1 }).score;
    const worse = classifyConfidence({ ...good, wape: 0.4 }).score;
    expect(worse).toBeLessThan(better);
  });
});
