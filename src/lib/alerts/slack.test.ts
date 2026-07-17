import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSlackMessage, type SlackAlert } from "./slack";

const base: SlackAlert = { severity: "critical", title: "Acme · Revenue down 32%", detail: "Big drop." };

type Block = { type: string; elements?: { url?: string }[]; text?: { text?: string } };
const blocksOf = (msg: Record<string, unknown>): Block[] =>
  ((msg.attachments as { blocks: Block[] }[])[0].blocks) as Block[];
const buttonUrls = (msg: Record<string, unknown>): string[] =>
  blocksOf(msg).filter((b) => b.type === "actions").flatMap((b) => (b.elements ?? []).map((e) => e.url!));

describe("buildSlackMessage", () => {
  const original = process.env.APP_BASE_URL;
  beforeEach(() => {
    process.env.APP_BASE_URL = "https://ampulse.example.com";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = original;
  });

  it("colors the attachment bar by severity", () => {
    const color = (a: SlackAlert) => (buildSlackMessage(a).attachments as { color: string }[])[0].color;
    expect(color({ ...base, severity: "critical" })).toBe("#E01E5A");
    expect(color({ ...base, severity: "positive" })).toBe("#2EB67D");
  });

  it("always includes a text fallback for notifications/accessibility", () => {
    expect(buildSlackMessage(base).text).toContain("Acme · Revenue down 32%");
  });

  it("resolves the primary button to an absolute URL from the app base", () => {
    const urls = buttonUrls(buildSlackMessage({ ...base, href: "/datasets/acme/analytics" }));
    expect(urls).toContain("https://ampulse.example.com/datasets/acme/analytics");
  });

  it("adds a second button for a news source when provided", () => {
    const urls = buttonUrls(buildSlackMessage({ ...base, href: "/x", sourceUrl: "https://news.example/story" }));
    expect(urls).toContain("https://news.example/story");
  });

  it("omits the button block entirely when there is no usable link", () => {
    const msg = buildSlackMessage(base); // no href, no sourceUrl
    expect(blocksOf(msg).some((b) => b.type === "actions")).toBe(false);
  });

  it("truncates an over-long header to Slack's 150-char cap", () => {
    const header = blocksOf(buildSlackMessage({ ...base, title: "x".repeat(300) }))[0];
    expect(header.type).toBe("header");
    expect((header.text!.text as string).length).toBeLessThanOrEqual(150);
  });

  const ownerText = (msg: Record<string, unknown>): string | undefined =>
    blocksOf(msg).find((b) => b.type === "section" && b.text?.text?.startsWith("👤"))?.text?.text;

  it("shows the owner's name as plain text when no Slack ID is set", () => {
    const text = ownerText(buildSlackMessage({ ...base, owner: { name: "Ana Analyst" } }));
    expect(text).toContain("Ana Analyst");
    expect(text).not.toContain("<@");
  });

  it("renders the owner as a Slack @-mention when a Slack ID is set (so they get pinged)", () => {
    const text = ownerText(buildSlackMessage({ ...base, owner: { name: "Ana Analyst", slackId: "U012ABC" } }));
    expect(text).toContain("<@U012ABC>");
  });

  it("omits the owner section entirely when no owner is given", () => {
    expect(ownerText(buildSlackMessage(base))).toBeUndefined();
  });
});
