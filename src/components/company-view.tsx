"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { DataWorkspace } from "@/components/tables/data-workspace";
import { companyLabel } from "@/lib/company-labels";

type Tab = "data" | "analytics";

/** One company, two things: Data and Analytics. Nothing else. */
export function CompanyView({ name, initialTab = "data" }: { name: string; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [building, setBuilding] = useState(false);
  const buildTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = companyLabel(name);

  // AMPace (top bar) switches us to Analytics when it adds widgets. Show a 3s
  // "building" buffer over the canvas before revealing the freshly-built plots.
  useEffect(() => {
    const onShow = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail !== name) return;
      setTab("analytics");
      setBuilding(true);
      if (buildTimer.current) clearTimeout(buildTimer.current);
      buildTimer.current = setTimeout(() => setBuilding(false), 3000);
    };
    window.addEventListener("ampace:show-analytics", onShow);
    return () => {
      window.removeEventListener("ampace:show-analytics", onShow);
      if (buildTimer.current) clearTimeout(buildTimer.current);
    };
  }, [name]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-6 pt-4 pb-3">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← All companies</Link>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="tablist" aria-label="Company view">
            {(["data", "analytics"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "data" ? (
        <div className="flex min-h-0 flex-1 flex-col px-6 pb-4">
          <DataWorkspace name={name} label={label} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
          <div className="relative mx-auto max-w-[1600px]">
            <DashboardCanvas name={name} />
            {building && <BuildingOverlay />}
          </div>
        </div>
      )}
    </main>
  );
}

/** Polished 3s buffer shown over the canvas while AMPace's freshly-built plots render underneath. */
function BuildingOverlay() {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative grid size-14 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" aria-hidden />
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Loader2 className="size-7 animate-spin" />
          </span>
        </div>
        <p className="text-sm font-semibold">Building your analytics…</p>
        <p className="text-xs text-muted-foreground">Crunching the numbers and drawing your charts.</p>
      </div>
    </div>
  );
}
