import { describe, expect, it } from "vitest";
import { routePrompt } from "./widgets";

const types = (p: string) => routePrompt(p).map((w) => w.type);

describe("routePrompt", () => {
  it("always returns at least one widget (demo-safe fallback)", () => {
    for (const p of ["", "asdf qwerty", "hello", "make it pretty", "42"]) {
      expect(routePrompt(p).length).toBeGreaterThan(0);
    }
  });

  it("routes common intents to the right widget types", () => {
    expect(types("show me revenue trends")).toContain("line");
    expect(types("compare ROAS across companies")).toContain("compare");
    expect(types("break down revenue by day of week")).toContain("barDow");
    expect(types("what needs my attention?")).toContain("alerts");
    expect(types("give me a table of top days")).toContain("table");
    expect(types("kpi summary")).toContain("kpi");
  });

  it("picks the metric named in the prompt", () => {
    const w = routePrompt("plot clicks over time").find((s) => s.type === "line");
    expect(w?.metric).toBe("Clicks");
  });

  it("assigns fresh ids per call", () => {
    expect(routePrompt("revenue")[0].id).not.toBe(routePrompt("revenue")[0].id);
  });
});
