import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  company: z.string().max(120).optional(),
  /** Titles of the widgets the client just added to the dashboard. */
  added: z.array(z.string().max(120)).max(12).default([]),
});

const SYSTEM_PROMPT = [
  "You are AMPace, an assistant embedded in an ad-performance analytics app.",
  "The user asks for analytics and the app has ALREADY added the relevant widgets (charts, tables, KPI tiles, or alerts) to their dashboard.",
  "Your only job is to write ONE short, friendly confirmation (1–2 sentences) describing what was just added and inviting a follow-up.",
  "Be concrete and reference the widget titles provided. Do not invent numbers, do not describe data you can't see, do not use markdown headings or bullet lists — plain conversational text only.",
].join("\n");

let client: Anthropic | null = null;
const getClient = (): Anthropic | null => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
};

/** A deterministic, instant reply used when Claude is unavailable — keeps the demo unbreakable. */
function fallbackReply(company: string | undefined, added: string[]): string {
  const where = company ? ` to ${company}'s dashboard` : "";
  if (added.length === 0) return "Done — take a look at your dashboard.";
  if (added.length === 1) return `Added “${added[0]}”${where}. Want to compare it against another metric or company?`;
  return `Added ${added.length} widgets${where}: ${added.map((a) => `“${a}”`).join(", ")}. Ask for more, or say “clear” to reset.`;
}

/** Writes the Analyst's chat reply. Widgets are added client-side; this only phrases the confirmation. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid request" } }, { status: 400 });
  }
  const { prompt, company, added } = body.data;

  const anthropic = getClient();
  if (!anthropic) {
    return NextResponse.json({ reply: fallbackReply(company, added), source: "fallback" });
  }

  try {
    const context = `Company: ${company ?? "(none selected)"}\nUser asked: ${prompt}\nWidgets just added: ${added.length ? added.join(", ") : "(none — the request didn't map to a widget)"}`;
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 256,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: context }],
    });
    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text?.trim();
    return NextResponse.json({ reply: text || fallbackReply(company, added), source: text ? "claude" : "fallback" });
  } catch (err) {
    console.error("Assistant reply failed:", err);
    // Never fail the chat — the analytics are already on screen.
    return NextResponse.json({ reply: fallbackReply(company, added), source: "fallback" });
  }
}
