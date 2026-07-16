import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/server";
import { buildAccountsSummary } from "@/lib/chat/accounts-summary";

export const runtime = "nodejs";

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(40),
});

const SYSTEM_PROMPT = [
  "You are the AMPulse analytics assistant, embedded in the sidebar of a live advertising-analytics dashboard.",
  "",
  "What you can see: a snapshot of every account (company) currently in the workspace — total adspend, clicks, " +
    "CPC, revenue, conversions, ROAS, and CVR; each account's performance goal if one has been set (ROAS or CPA) " +
    "and how many of the last 7 days met it; and any recent day-over-day anomalies in their metrics. This snapshot " +
    "is provided below and is refreshed every time you're asked something — you are not looking at live numbers " +
    "between messages, and you cannot see individual rows, raw news articles, or anything outside this summary.",
  "",
  "Answer from this data only. If something isn't in the summary (e.g. a metric for an account not listed, or a " +
    "time range finer than what's given), say so plainly rather than guessing. Be concise — this is a sidebar " +
    "panel, not a report; lead with the answer, use short bullet points for multi-account comparisons.",
].join("\n");

let client: Anthropic | null = null;
const getClient = (): Anthropic | null => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
};

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const anthropic = getClient();
  if (!anthropic) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Set ANTHROPIC_API_KEY to enable the assistant." } },
      { status: 503 }
    );
  }

  const body = ChatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: body.error.issues.map((i) => i.message).join("; ") } },
      { status: 400 }
    );
  }

  try {
    const summary = await buildAccountsSummary();
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      output_config: { effort: "medium" },
      system: `${SYSTEM_PROMPT}\n\n--- Current accounts snapshot ---\n\n${summary}`,
      messages: body.data.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
    return NextResponse.json({ reply: text || "I couldn't generate a response — please try again." });
  } catch (err) {
    console.error("Chat request failed:", err);
    return NextResponse.json(
      { error: { code: "CHAT_FAILED", message: "The assistant could not respond. Please try again." } },
      { status: 502 }
    );
  }
}
