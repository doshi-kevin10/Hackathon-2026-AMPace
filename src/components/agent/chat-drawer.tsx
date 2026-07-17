"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  /** Optional pills shown under an assistant reply (e.g. added widget titles). */
  chips?: string[];
}

const prettify = (slug: string) =>
  slug
    .replace(/^excel_company_/, "")
    .split("_")
    .filter(Boolean)
    .map((t) => (/^[a-z]{1,3}$/.test(t) ? t.toUpperCase() : t[0].toUpperCase() + t.slice(1)))
    .join(" ");

/** The company (dataset slug + display label) implied by the current URL, if any. */
export function useCompanyContext(): { company: string | null; label: string | null } {
  const pathname = usePathname();
  const m = /^\/datasets\/([^/]+)/.exec(pathname ?? "");
  const company = m ? decodeURIComponent(m[1]) : null;
  return { company, label: company ? prettify(company) : null };
}

/**
 * Reusable top-bar chat drawer. Owns the open/message/input UI; each bot supplies
 * its behavior via `onSubmit`, which performs the side effects and returns the
 * assistant reply to render.
 */
export function ChatDrawer({
  label,
  Icon,
  subtitle,
  placeholder,
  suggestions,
  busyLabel = "Working…",
  onSubmit,
}: {
  label: string;
  Icon: LucideIcon;
  subtitle: string;
  placeholder: string;
  suggestions: string[];
  busyLabel?: string;
  onSubmit: (text: string) => Promise<ChatMsg>;
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const reply = await onSubmit(q);
      setMsgs((m) => [...m, reply]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Icon className="size-4" /> {label}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center gap-2 border-b px-4 py-3">
              <Icon className="size-4 text-primary" />
              <span className="font-semibold">{label}</span>
              <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
              <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-md p-1 hover:bg-muted" aria-label="Close">
                <X className="size-4" />
              </button>
            </header>

            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  <p className="mb-3">Try:</p>
                  <div className="grid gap-2">
                    {suggestions.map((s) => (
                      <button key={s} type="button" onClick={() => void send(s)} className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted">
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
                    {m.chips && m.chips.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.chips.map((c, j) => (
                          <span key={j} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                            + {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && <p className="text-sm text-muted-foreground">{busyLabel}</p>}
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
                placeholder={placeholder}
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
