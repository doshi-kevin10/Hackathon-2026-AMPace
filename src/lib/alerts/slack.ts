/**
 * Slack alerting — one small structured model (`SlackAlert`) rendered into
 * Block Kit so every alert AMPulse sends (anomalies, week-over-week moves,
 * data-quality issues, low-confidence forecasts) looks like one system:
 * a severity-colored bar, a header with a severity emoji, a details section,
 * a context line, and deep-link buttons back into the app.
 *
 * The builder (`buildSlackMessage`) is pure and testable; `sendSlackAlert`
 * is the only side-effecting piece. No-ops (just logs) when SLACK_WEBHOOK_URL
 * isn't set, so alerting stays optional until configured.
 */

import { ownerMention, type AlertOwner } from "./owners";

export type AlertSeverity = "critical" | "warning" | "positive" | "info";

export interface SlackAlert {
  severity: AlertSeverity;
  /** One-line headline, e.g. "Acme · Revenue down 32% this week". */
  title: string;
  /** The supporting sentence(s). Slack mrkdwn allowed. */
  detail: string;
  /** Human label for the metric, shown as a field (optional). */
  metric?: string;
  /** ISO date the alert refers to, shown as a field (optional). */
  date?: string;
  /** Who owns the dataset. Rendered as a Slack @-mention when a slackId is set. */
  owner?: AlertOwner;
  /** App-relative path (e.g. "/datasets/acme/analytics") for the primary button. */
  href?: string;
  /** Small footnote, e.g. "robust z=3.5" or "backtest WAPE 41%". */
  context?: string;
  /** Optional secondary link (e.g. the news article that explains an anomaly). */
  sourceUrl?: string;
  sourceLabel?: string;
}

export const isSlackConfigured = (): boolean => Boolean(process.env.SLACK_WEBHOOK_URL);

/** Slack's brand palette maps cleanly onto our four severities. */
const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: "#E01E5A",
  warning: "#ECB22E",
  positive: "#2EB67D",
  info: "#36C5F0",
};

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  critical: "🔴",
  warning: "🟠",
  positive: "🟢",
  info: "🔵",
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  positive: "Good news",
  info: "Heads up",
};

/** Slack header blocks are plain_text and cap at 150 chars. */
const truncate = (s: string, max = 150) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

/**
 * Resolve an app-relative href to an absolute URL for Slack buttons (Slack
 * rejects relative/invalid URLs). Returns null if no usable base URL, so the
 * caller can simply omit the button.
 */
function absoluteUrl(href: string | undefined): string | null {
  if (!href) return null;
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/** Build the Slack webhook JSON body for an alert. Pure — no env writes, safe to test. */
export function buildSlackMessage(alert: SlackAlert): Record<string, unknown> {
  const emoji = SEVERITY_EMOJI[alert.severity];
  const blocks: Record<string, unknown>[] = [];

  // 1. Headline.
  blocks.push({ type: "header", text: { type: "plain_text", text: truncate(`${emoji} ${alert.title}`), emoji: true } });

  // 2. The story + an at-a-glance metadata grid (Status / Metric / When).
  const fields: { type: string; text: string }[] = [
    { type: "mrkdwn", text: `*Status*\n${SEVERITY_LABEL[alert.severity]}` },
  ];
  if (alert.metric) fields.push({ type: "mrkdwn", text: `*Metric*\n${alert.metric}` });
  if (alert.date) fields.push({ type: "mrkdwn", text: `*When*\n${alert.date}` });
  blocks.push({ type: "section", text: { type: "mrkdwn", text: alert.detail }, fields });

  // 3. Owner — its own section so a Slack @-mention actually pings them
  // (mentions in context blocks don't notify).
  if (alert.owner) blocks.push({ type: "section", text: { type: "mrkdwn", text: `👤 *Owner:* ${ownerMention(alert.owner)}` } });

  // 4. Call-to-action buttons.
  const primary = absoluteUrl(alert.href);
  const buttons: Record<string, unknown>[] = [];
  if (primary)
    buttons.push({ type: "button", text: { type: "plain_text", text: "View in AMPulse", emoji: true }, url: primary, style: "primary" });
  if (alert.sourceUrl)
    buttons.push({ type: "button", text: { type: "plain_text", text: alert.sourceLabel ?? "Read the news", emoji: true }, url: alert.sourceUrl });
  if (buttons.length) {
    blocks.push({ type: "divider" });
    blocks.push({ type: "actions", elements: buttons });
  }

  // 5. Provenance footer.
  const footnote = ["📡 AMPulse", alert.context, alert.date].filter(Boolean).join("  ·  ");
  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: footnote }] });

  return {
    // Fallback text drives phone/desktop notification previews and accessibility.
    text: `${emoji} ${alert.title} — ${alert.detail}${alert.owner ? ` · Owner: ${alert.owner.name}` : ""}`,
    attachments: [{ color: SEVERITY_COLOR[alert.severity], blocks }],
  };
}

/**
 * Post an alert to the configured Slack incoming webhook. No-ops (logs) when
 * SLACK_WEBHOOK_URL isn't set. Never throws — a failed alert must not break
 * the request that triggered it.
 */
export async function sendSlackAlert(alert: SlackAlert): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.log("[slack:not-configured]", alert.title);
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSlackMessage(alert)),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("Slack webhook rejected the alert:", res.status, await res.text());
  } catch (err) {
    console.error("Failed to send Slack alert:", err);
  }
}
