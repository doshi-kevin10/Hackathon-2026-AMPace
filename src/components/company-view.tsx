"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { DataWorkspace } from "@/components/tables/data-workspace";

type Tab = "data" | "analytics";

const prettify = (slug: string) =>
  slug
    .replace(/^excel_company_/, "")
    .split("_")
    .filter(Boolean)
    .map((t) => (/^[a-z]{1,3}$/.test(t) ? t.toUpperCase() : t[0].toUpperCase() + t.slice(1)))
    .join(" ");

/** One company, two things: Data and Analytics. Nothing else. */
export function CompanyView({ name, initialTab = "data" }: { name: string; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const label = prettify(name);

  // The Analyst chatbot (top bar) switches us to Analytics when it adds widgets.
  useEffect(() => {
    const onShow = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail === name) setTab("analytics");
    };
    window.addEventListener("ampulse:show-analytics", onShow);
    return () => window.removeEventListener("ampulse:show-analytics", onShow);
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
          <div className="mx-auto max-w-[1600px]">
            <DashboardCanvas name={name} />
          </div>
        </div>
      )}
    </main>
  );
}
