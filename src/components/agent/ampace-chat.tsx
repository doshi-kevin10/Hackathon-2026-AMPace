"use client";

import { Compass } from "lucide-react";
import { ChatDrawer, useCompanyContext, type ChatMsg } from "@/components/agent/chat-drawer";
import { coachingReply, isCoachingPrompt, personaIntro } from "@/lib/advisor/persona";
import { addWidgets, routePrompt } from "@/lib/dashboard/widgets";

const SUGGESTIONS = [
  "How am I doing — and how do I improve?",
  "Where am I wasting spend?",
  "What should I do differently?",
  "Show me revenue trends",
  "How does ROAS compare across companies?",
  "Break down revenue by day of week",
];

/** AMPace: your ad-performance advisor. It coaches you on how to do better and builds analytics on request. */
export function AmpaceChat() {
  const { company, label } = useCompanyContext();

  const onSubmit = async (q: string): Promise<ChatMsg> => {
    // Coaching intent → scripted persona advice (works with or without a company open).
    if (isCoachingPrompt(q)) {
      return { role: "assistant", content: coachingReply(company, label, q) };
    }
    if (!company) {
      return { role: "assistant", content: "Open a company first — then I’ll build charts, tables, and alerts on its Analytics dashboard. Or ask me how to improve, where you’re wasting spend, or what to do differently." };
    }
    // Build widgets deterministically and drop them on the dashboard (instant, demo-safe).
    const specs = routePrompt(q);
    addWidgets(company, specs);
    window.dispatchEvent(new CustomEvent("ampulse:show-analytics", { detail: company }));
    const titles = specs.map((s) => s.title);

    // Ask Claude for a natural confirmation (falls back instantly if unavailable).
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q, company: label, added: titles }),
      });
      const d = await res.json();
      return { role: "assistant", content: d.reply ?? `Added ${titles.length} widget(s).`, chips: titles };
    } catch {
      return { role: "assistant", content: `Added ${titles.join(", ")} to ${label}’s dashboard.`, chips: titles };
    }
  };

  return (
    <ChatDrawer
      label="AMPace"
      Icon={Compass}
      subtitle={label ? `${label} · advisor & analytics` : "your ad-performance advisor"}
      placeholder="Ask for advice, or a chart, table, or KPI…"
      busyLabel="Analyzing…"
      suggestions={SUGGESTIONS}
      intro={personaIntro(label)}
      openEvent="ampulse:open-advisor"
      onSubmit={onSubmit}
    />
  );
}
