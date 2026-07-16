export const isSlackConfigured = (): boolean => Boolean(process.env.SLACK_WEBHOOK_URL);

/**
 * Post a message to the configured Slack incoming webhook. No-ops (just
 * logs) when SLACK_WEBHOOK_URL isn't set, so alerting is optional until
 * configured rather than breaking the monitor endpoint.
 */
export async function sendSlackAlert(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.log("[slack:not-configured]", text);
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("Slack webhook rejected the alert:", res.status, await res.text());
  } catch (err) {
    console.error("Failed to send Slack alert:", err);
  }
}
