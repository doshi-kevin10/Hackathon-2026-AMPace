"use client";

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = ["Health check of my accounts", "Which accounts are missing their goal?", "Any unusual moves today?"];

/** Sidebar assistant grounded in the current cross-account KPI/goal/anomaly snapshot — see /api/chat. */
export function Chatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "The assistant could not respond.");
      setMessages([...next, { role: "assistant", content: body.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The assistant could not respond.");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    }
  };

  return (
    <div className="flex h-96 flex-col rounded-lg border border-border">
      <div className="border-b border-border px-3 py-2">
        <h3 className="text-sm font-semibold">Assistant</h3>
        <p className="text-[11px] text-muted-foreground">Grounded in your accounts&apos; current KPIs, goals &amp; anomalies</p>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="grid gap-1.5">
            <p className="text-xs text-muted-foreground">Try asking:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-md border border-border px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/40"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap",
              m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground"
            )}
          >
            {m.content}
          </div>
        ))}
        {busy && <div className="max-w-[90%] rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">Thinking…</div>}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex gap-2 border-t border-border p-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your accounts…"
          className="h-8 flex-1 text-xs"
          disabled={busy}
        />
        <Button type="submit" size="icon-sm" disabled={busy || !input.trim()} aria-label="Send">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
