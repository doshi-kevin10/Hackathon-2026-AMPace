import { beforeAll, describe, expect, it } from "vitest";
import { runAgent, stripMarkdown } from "./agent";

// Force the deterministic mock path (no API key needed).
beforeAll(() => {
  delete process.env.AI_MODE;
});

describe("stripMarkdown", () => {
  it("removes bold/italic/headers/backticks", () => {
    expect(stripMarkdown("**Revenue** is `up` and _good_\n# Title")).toBe("Revenue is up and good\nTitle");
  });
});

describe("runAgent (mock)", () => {
  it("answers 'what needs attention today?' from the deterministic watchtower", async () => {
    const r = await runAgent([{ role: "user", content: "what needs attention today?" }]);
    expect(r.mode).toBe("mock");
    expect(r.reply.length).toBeGreaterThan(0);
    expect(r.reply).not.toContain("**"); // clean output
    expect(r.actions.some((a) => a.type === "navigate")).toBe(true);
  });

  it("forecasts a named company + metric and offers to open it", async () => {
    const r = await runAgent([{ role: "user", content: "forecast Nike revenue for the next 14 days" }]);
    expect(r.reply.toLowerCase()).toContain("nike");
    expect(r.reply).toMatch(/\$/); // a real dollar estimate
    expect(r.actions[0]).toMatchObject({ type: "navigate", href: "/datasets/excel_company_nike/analytics" });
  });

  it("summarizes a company's stats when asked how it's doing", async () => {
    const r = await runAgent([{ role: "user", content: "how is Adidas doing?" }]);
    expect(r.reply.toLowerCase()).toContain("adidas");
    expect(r.reply.toLowerCase()).toContain("roas");
  });
});
