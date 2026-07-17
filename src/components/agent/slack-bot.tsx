"use client";

import { MessageSquare } from "lucide-react";
import { ChatDrawer, useCompanyContext, type ChatMsg } from "@/components/agent/chat-drawer";

const SUGGESTIONS = [
  "Alert me when ROAS drops below target",
  "Send me a daily performance digest",
  "Notify me on revenue anomalies",
  "Ping me when ad spend spikes",
];

/** Slack bot: describe the alert you want; it fires your fixed alert to Slack. Alerts only — separate from AMPace. */
export function SlackBot() {
  const { company, label } = useCompanyContext();

  const onSubmit = async (q: string): Promise<ChatMsg> => {
    try {
      const res = await fetch("/api/alerts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q, company: label, dataset: company }),
      });
      const d = await res.json();
      return {
        role: "assistant",
        content: d.ok
          ? `✅ Sent it to your Slack — “${d.title}”. Press enter again any time to re-fire it.`
          : d.message ?? "I couldn’t reach Slack. Check the webhook and try again.",
      };
    } catch {
      return { role: "assistant", content: "I couldn’t reach Slack. Check the webhook and try again." };
    }
  };

  return (
    <ChatDrawer
      label="Slack"
      Icon={MessageSquare}
      subtitle={label ? `${label} · alerts` : "portfolio alerts"}
      placeholder="Describe the Slack alert you want…"
      busyLabel="Sending to Slack…"
      suggestions={SUGGESTIONS}
      onSubmit={onSubmit}
    />
  );
}
