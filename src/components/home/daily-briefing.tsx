"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass, Info, Lightbulb, Sunrise, TrendingDown, TrendingUp, X } from "lucide-react";
import { AnimatedContent } from "@/components/reactbits/animated-content";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  ATTENTION_COMPANY,
  BRIEFING_HIGHLIGHTS,
  BRIEFING_SUGGESTION,
  greetingFor,
  type HighlightTone,
} from "@/lib/advisor/persona";
import { cn } from "@/lib/utils";

const dismissKey = (day: string) => `ampulse:briefing-dismissed:${day}`;

const TONE: Record<HighlightTone, { icon: typeof TrendingUp; className: string }> = {
  up: { icon: TrendingUp, className: "text-emerald-600" },
  down: { icon: TrendingDown, className: "text-rose-600" },
  info: { icon: Info, className: "text-primary" },
};

/**
 * "Summary of the day" — a scripted morning briefing shown atop the home screen
 * on login. Dismissible; the dismissal is remembered per calendar day, so it
 * returns fresh each morning. Copy comes from lib/advisor/persona (story-anchored).
 */
export function DailyBriefing({ userName }: { userName: string }) {
  // Start hidden so SSR and the first client render match; the effect reveals it.
  const [show, setShow] = useState(false);
  const [greeting, setGreeting] = useState("Hello");
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    setGreeting(greetingFor(now.getHours()));
    setDateLabel(now.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }));
    setShow(localStorage.getItem(dismissKey(day)) !== "1");
  }, []);

  if (!show) return null;

  const firstName = userName.split(" ")[0];
  const dismiss = () => {
    localStorage.setItem(dismissKey(new Date().toISOString().slice(0, 10)), "1");
    setShow(false);
  };

  return (
    <AnimatedContent className="mb-6">
      <section
        aria-label="Daily briefing"
        className="relative overflow-hidden rounded-2xl border border-border bg-card px-7 py-6 shadow-sm"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" aria-hidden />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss briefing"
          className="absolute right-4 top-4 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          <Sunrise className="size-3.5" /> Your summary of the day
        </div>
        <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-foreground">
          {greeting}, {firstName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-8">
          <ul className="grid content-start gap-3.5">
            {BRIEFING_HIGHLIGHTS.map((h) => {
              const { icon: Icon, className } = TONE[h.tone];
              return (
                <li key={h.text} className="flex items-start gap-3 text-[15px] leading-snug">
                  <Icon className={cn("mt-0.5 size-[18px] shrink-0", className)} aria-hidden />
                  <span className="text-foreground/90">{h.text}</span>
                </li>
              );
            })}
          </ul>

          <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-3.5">
            <Lightbulb className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
            <p className="text-[15px] leading-snug">
              <span className="font-semibold">Suggested move — </span>
              <span className="text-foreground/90">{BRIEFING_SUGGESTION}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent("ampulse:open-advisor"))} className="gap-1.5">
            <Compass className="size-4" /> Open advisor
          </Button>
          <Link
            href={`/datasets/${ATTENTION_COMPANY.name}/analytics`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            See {ATTENTION_COMPANY.label} <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </AnimatedContent>
  );
}
