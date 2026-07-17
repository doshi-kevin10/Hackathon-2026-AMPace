import { NextResponse } from "next/server";
import { z } from "zod";
import { isSlackConfigured, sendSlackAlert } from "@/lib/alerts/slack";
import { ownerFor } from "@/lib/alerts/owners";
import { requireUser } from "@/lib/auth/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  /** What the user typed (for logging / future personalization). */
  prompt: z.string().max(2000).optional(),
  /** Company display label, e.g. "Nike". */
  company: z.string().max(120).optional(),
  /** Dataset slug, e.g. "excel_company_nike" — used for the deep link and owner mapping. */
  dataset: z.string().max(120).optional(),
});

/**
 * Fire the user's fixed, ready-to-send Slack alert. Demo behavior: whatever the
 * user describes to the AMPace chatbot, pressing enter sends this one curated,
 * professional alert to their configured webhook — personalized to the company
 * they're viewing. Reuses the shared Slack delivery layer (Block Kit).
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const { company, dataset } = parsed.data;

  if (!isSlackConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "Slack isn't connected yet. Add SLACK_WEBHOOK_URL to .env.local and restart to enable alerts.",
    });
  }

  const label = company ?? "Portfolio";
  const title = `${label} · ROAS dropped below target`;

  await sendSlackAlert({
    severity: "critical",
    title,
    detail:
      "*ROAS fell to 2.4×* over the last 3 days — below the 3.0× target. Revenue is pacing *18% behind* last week while ad spend held flat, so this reads as an efficiency problem, not a budget one. Suggested action: pause the 3 lowest-ROAS keywords and shift that spend to the top performers.",
    metric: "ROAS",
    date: new Date().toISOString().slice(0, 10),
    owner: dataset ? ownerFor(dataset) : { name: user.name, email: user.email },
    href: dataset ? `/datasets/${dataset}/analytics` : "/",
    context: "AMPace personal alert · robust z = 3.2",
  });

  return NextResponse.json({ ok: true, configured: true, title });
}
