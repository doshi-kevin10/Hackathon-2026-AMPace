import { describe, expect, it } from "vitest";
import { coachingReply, greetingFor, isCoachingPrompt, personaIntro } from "./persona";

describe("isCoachingPrompt", () => {
  it("matches advice/coaching phrasings", () => {
    for (const q of [
      "How am I doing — and how do I improve?",
      "Where am I wasting spend?",
      "What should I do differently?",
      "how can we make this better",
      "any advice for me?",
      "what are my habits",
    ]) {
      expect(isCoachingPrompt(q), q).toBe(true);
    }
  });

  it("does NOT hijack AMPace's build prompts", () => {
    for (const q of [
      "Forecast revenue for the next two weeks",
      "Show me revenue trends",
      "How does ROAS compare across companies?",
      "Break down revenue by day of week",
      "What needs my attention?",
    ]) {
      expect(isCoachingPrompt(q), q).toBe(false);
    }
  });
});

describe("coachingReply", () => {
  it("returns company-specific advice when a known company is open", () => {
    expect(coachingReply("excel_company_adidas", "Adidas", "how do I improve?")).toMatch(/Adidas/);
  });
  it("interpolates the label for an unknown company", () => {
    expect(coachingReply("excel_company_zzz", "Zzz", "improve?")).toMatch(/For Zzz:/);
  });
  it("falls back to portfolio advice with no company", () => {
    expect(coachingReply(null, null, "how can we make this better")).toMatch(/portfolio/i);
  });
  it("leads with the habit profile for a habits question", () => {
    expect(coachingReply("excel_company_nike", "Nike", "what are my habits?")).toMatch(/ROAS is the first thing/);
  });
});

describe("greetingFor", () => {
  it("splits morning/afternoon/evening", () => {
    expect(greetingFor(8)).toBe("Good morning");
    expect(greetingFor(13)).toBe("Good afternoon");
    expect(greetingFor(20)).toBe("Good evening");
  });
});

describe("personaIntro", () => {
  it("names the company when open, else stays portfolio-level", () => {
    expect(personaIntro("Nike")).toMatch(/Nike/);
    expect(personaIntro(null)).toMatch(/run these accounts/);
  });
});
