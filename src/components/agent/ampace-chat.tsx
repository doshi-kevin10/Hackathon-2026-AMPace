"use client";

import { Compass } from "lucide-react";
import { ChatDrawer, useCompanyContext, type ChatMsg } from "@/components/agent/chat-drawer";
import { addWidgets, routePrompt } from "@/lib/dashboard/widgets";

const SUGGESTIONS = [
  "Show me revenue trends",
  "How does ROAS compare across companies?",
  "Break down revenue by day of week",
  "Chart spend vs conversions",
];

const INTRO =
  "👋 I build analytics on request. Open a company, then ask for any chart, table, or KPI — I’ll drop it on its dashboard.";

/** AMPace: builds analytics (charts, tables, KPIs) on request. Activity nudges live separately. */
export function AmpaceChat() {
  const { company, label } = useCompanyContext();

  const onSubmit = async (q: string): Promise<ChatMsg> => {
    if (!company) {
      return { role: "assistant", content: "Open a company first — then I’ll build charts, tables, and KPIs on its Analytics dashboard." };
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
      subtitle={label ? `${label} · analytics builder` : "analytics builder"}
      placeholder="Ask for a chart, table, or KPI…"
      busyLabel="Building…"
      suggestions={SUGGESTIONS}
      intro={INTRO}
      openEvent="ampulse:open-advisor"
      onSubmit={onSubmit}
    />
  );
}
