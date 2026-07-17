"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Sparkles, Sunrise, X } from "lucide-react";
import { AnimatedContent } from "@/components/reactbits/animated-content";
import { Button } from "@/components/ui/button";
import { getBehavior, subscribeBehavior } from "@/lib/activity/behavior";
import { buildSuggestions, type Suggestion, type SuggestionTone } from "@/lib/advisor/suggestions";
import type { Dataset } from "@/lib/databricks/analytics";
import { cn } from "@/lib/utils";

const dismissKey = (day: string) => `ampulse:briefing-dismissed:${day}`;
const greetingFor = (h: number) => (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");

const TONE_DOT: Record<SuggestionTone, string> = {
  new: "bg-emerald-500",
  attention: "bg-amber-500",
  info: "bg-primary",
};

/**
 * Home-screen activity summary. Reads the same behavior-driven suggestion engine
 * as the ambient nudge and lists what's worth a second look based on what you've
 * been doing (and what you've skipped). Neutral and observational — no scores,
 * no coaching. Dismissible per calendar day.
 */
export function DailyBriefing({ userName }: { userName: string }) {
  // Start hidden so SSR and the first client render match; the effect reveals it.
  const [show, setShow] = useState(false);
  const [greeting, setGreeting] = useState("Hello");
  const [dateLabel, setDateLabel] = useState("");
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    setGreeting(greetingFor(now.getHours()));
    setDateLabel(now.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }));
    setShow(localStorage.getItem(dismissKey(day)) !== "1");
  }, []);

  useEffect(() => {
    fetch("/api/datasets")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.datasets)) setDatasets(d.datasets as Dataset[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const recompute = () => setSuggestions(buildSuggestions(datasets, getBehavior()));
    recompute();
    return subscribeBehavior(recompute);
  }, [datasets]);

  if (!show) return null;

  const firstName = userName.split(" ")[0];
  const dismiss = () => {
    localStorage.setItem(dismissKey(new Date().toISOString().slice(0, 10)), "1");
    setShow(false);
  };
  const top = suggestions.slice(0, 3);

  return (
    <AnimatedContent className="mb-6">
      <section
        aria-label="Activity summary"
        className="relative overflow-hidden rounded-2xl border border-border bg-card px-7 py-6 shadow-sm"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" aria-hidden />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-4 top-4 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          <Sunrise className="size-3.5" /> Your activity summary
        </div>
        <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-foreground">
          {greeting}, {firstName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>

        {top.length === 0 ? (
          <div className="mt-6 flex items-start gap-3 text-[15px] leading-snug text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-emerald-600" aria-hidden />
            <span>You&rsquo;re all caught up. Open a company and AMPulse will flag anything worth a second look as you work.</span>
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" /> Based on what you&rsquo;ve been looking at
            </div>
            <ul className="mt-3 grid content-start gap-2">
              {top.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => router.push(s.href)}
                    className="flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-muted/50"
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[s.tone])} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold leading-snug text-foreground">{s.title}</span>
                      <span className="block text-sm leading-snug text-muted-foreground">{s.body}</span>
                    </span>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </AnimatedContent>
  );
}
