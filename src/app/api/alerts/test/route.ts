import { NextResponse } from "next/server";
import { isSlackConfigured, sendSlackAlert } from "@/lib/alerts/slack";
import { requireUser } from "@/lib/auth/server";

export const runtime = "nodejs";

/** Send one sample alert to Slack so the webhook can be verified end-to-end. */
export async function POST() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!isSlackConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "SLACK_WEBHOOK_URL is not set. Add it to .env.local and restart the server.",
    });
  }

  await sendSlackAlert({
    severity: "positive",
    title: "AMPulse alerts are live 🎉",
    detail:
      "This is a test alert. You'll see anomalies (news-explained), week-over-week moves, data-quality issues, and low-confidence forecasts here.",
    metric: "Test",
    date: new Date().toISOString().slice(0, 10),
    // Show whoever ran the test as the owner (falls back to the configured default).
    owner: { name: user.name, email: user.email },
    href: "/",
    context: "test",
  });

  return NextResponse.json({ ok: true, configured: true });
}
