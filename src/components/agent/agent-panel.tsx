"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentAction, AgentMessage } from "@/lib/agent/agent";

const SUGGESTIONS = [
  "What needs my attention today?",
  "Forecast Nike revenue for the next 14 days",
  "How is Adidas doing?",
  "Which account has the best ROAS?",
];

interface Msg extends AgentMessage {
  actions?: AgentAction[];
}

/** The AMPulse agent: ask anything; it answers with real numbers and can open pages for you. */
export function AgentPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history: AgentMessage[] = [...msgs.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: q }];
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error?.message ?? "Agent failed");
      setMsgs((m) => [...m, { role: "assistant", content: d.reply, actions: d.actions ?? [] }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Sparkles className="size-4" /> Ask AMPulse
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center gap-2 border-b px-4 py-3">
              <Sparkles className="size-4 text-primary" />
              <span className="font-semibold">AMPulse agent</span>
              <span className="text-xs text-muted-foreground">grounded in your real metrics</span>
              <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-md p-1 hover:bg-muted" aria-label="Close">
                <X className="size-4" />
              </button>
            </header>

            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  <p className="mb-3">I watch your ad accounts and answer with real numbers. Try:</p>
                  <div className="grid gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => send(s)} className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    {m.actions?.filter((a) => a.type === "navigate").map((a, j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          router.push(a.href);
                        }}
                        className="mt-2 inline-block rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/80"
                      >
                        {a.label} →
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {busy && <p className="text-sm text-muted-foreground">Thinking…</p>}
            </div>

            <form
              className="flex items-center gap-2 border-t p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about any account…"
                className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
                <ArrowUp className="size-4" />
              </Button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
