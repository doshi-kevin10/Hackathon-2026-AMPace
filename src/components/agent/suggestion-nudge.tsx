"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ArrowRight, Sparkles, X } from "lucide-react";
import {
  dismissSuggestion,
  getBehavior,
  getLastNudgeAt,
  isDismissedToday,
  markNudged,
  recordView,
  subscribeBehavior,
} from "@/lib/activity/behavior";
import { logDatabricksGrowth } from "@/lib/activity/db-watch";
import { buildSuggestions, type Suggestion, type SuggestionTone } from "@/lib/advisor/suggestions";
import type { Dataset } from "@/lib/databricks/analytics";
import { cn } from "@/lib/utils";

const REFRESH_MS = 15_000; // re-pull dataset freshness fast, to catch feeder row-adds quickly
const GAP_MS = 15_000; // minimum gap between auto-popping nudges
const AUTO_HIDE_MS = 12_000;

const TONE_DOT: Record<SuggestionTone, string> = {
  new: "bg-emerald-500",
  attention: "bg-amber-500",
  info: "bg-primary",
};

/**
 * Ambient activity nudge. It watches what the user opens (recorded on every
 * navigation) and the live data freshness, and slides a single suggestion in
 * bottom-right on its own — no prompts, no "how am I doing" button. Auto-hides
 * to a small pill the user can reopen. Purely observational copy.
 */
export function SuggestionNudge() {
  const router = useRouter();
  const pathname = usePathname();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const shownId = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const datasetsRef = useRef<Dataset[]>([]);
  datasetsRef.current = datasets;

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await fetch("/api/datasets");
      const d = await res.json();
      if (Array.isArray(d.datasets)) {
        setDatasets(d.datasets as Dataset[]);
        logDatabricksGrowth(d.datasets as Dataset[]); // surface feeder row-adds in the notifications bar
      }
    } catch {
      /* offline / unauthed — no nudges, no noise */
    }
  }, []);

  // Pull dataset freshness on mount and on a slow interval.
  useEffect(() => {
    void fetchDatasets();
    const t = setInterval(() => void fetchDatasets(), REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchDatasets]);

  // The one place we record activity: once per navigation to a company page.
  // Reads freshness from a ref so a late datasets fetch doesn't re-fire it.
  useEffect(() => {
    const m = /^\/datasets\/([^/]+)(\/analytics)?/.exec(pathname ?? "");
    if (!m) return;
    const name = decodeURIComponent(m[1]);
    const latestDate = datasetsRef.current.find((d) => d.name === name)?.latestDate ?? null;
    recordView(name, { analytics: Boolean(m[2]), latestDate });
  }, [pathname]);

  // Recompute suggestions whenever behavior or dataset freshness changes.
  useEffect(() => {
    const recompute = () =>
      setSuggestions(buildSuggestions(datasets, getBehavior()).filter((s) => !isDismissedToday(s.id)));
    recompute();
    return subscribeBehavior(recompute);
  }, [datasets]);

  // Auto-pop the top suggestion when a new one appears (throttled).
  useEffect(() => {
    const top = suggestions[0];
    if (!top) {
      setOpen(false);
      return;
    }
    if (top.id !== shownId.current && Date.now() - getLastNudgeAt() > GAP_MS) {
      shownId.current = top.id;
      markNudged();
      setShowAll(false);
      setOpen(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setOpen(false), AUTO_HIDE_MS);
    }
  }, [suggestions]);

  if (suggestions.length === 0) return null;

  const go = (s: Suggestion) => {
    dismissSuggestion(s.id); // acting on it counts as handled for the day
    setOpen(false);
    router.push(s.href);
  };

  // Collapsed pill — always reachable when there's something to see.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setShowAll(true);
          setOpen(true);
        }}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-lg transition-colors hover:bg-muted"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-2 animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        {suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"}
      </button>
    );
  }

  const top = suggestions[0];
  const rest = suggestions.slice(1);

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[340px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" aria-hidden />
      <div className="flex items-center justify-between px-4 pt-3.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          <Sparkles className="size-3.5" /> AMPace noticed
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="px-4 pb-3 pt-2">
        <div className="flex items-start gap-2.5">
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[top.tone])} aria-hidden />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-snug text-foreground">{top.title}</p>
            <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{top.body}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(top)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {top.actionLabel} <ArrowRight className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => dismissSuggestion(top.id)}
            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      </div>

      {rest.length > 0 && (
        <div className="border-t border-border">
          {!showAll ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full px-4 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              See all {suggestions.length} →
            </button>
          ) : (
            <ul className="max-h-56 overflow-y-auto">
              {rest.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => go(s)}
                    className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[s.tone])} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-snug text-foreground">{s.title}</span>
                      <span className="block text-xs leading-snug text-muted-foreground">{s.body}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
