"use client";

import { useMemo } from "react";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";

/** Aggregate KPIs computed from the currently-visible (filtered) rows. */
export function KpiSummary({
  columns,
  rows,
}: {
  columns: ParsedColumn[];
  rows: Record<string, CellValue>[];
}) {
  const kpis = useMemo(() => {
    const id = (name: string) => columns.find((c) => c.name === name)?.id;
    const sum = (name: string) => {
      const colId = id(name);
      if (!colId) return null;
      let total = 0;
      let seen = false;
      for (const r of rows) {
        const v = Number(r[colId]?.normalized);
        if (Number.isFinite(v)) {
          total += v;
          seen = true;
        }
      }
      return seen ? total : null;
    };

    const adspend = sum("Total Adspend");
    const clicks = sum("Clicks");
    const revenue = sum("Revenue");
    const conversions = sum("Conversions");
    // Ratios are computed from the totals (not averaged) so they stay correct under filtering.
    const cpc = adspend != null && clicks ? adspend / clicks : null;
    const roas = revenue != null && adspend ? revenue / adspend : null;
    const cvr = conversions != null && clicks ? conversions / clicks : null;
    const cpa = adspend != null && conversions ? adspend / conversions : null;

    // Companies that track CPA (relabeled at the read layer) show CPA, not ROAS.
    const tracksCpa = columns.some((c) => c.name === "CPA");
    const headline = tracksCpa
      ? { label: "CPA", value: cpa, fmt: "usd" as const }
      : { label: "ROAS", value: roas, fmt: "x" as const };

    return [
      { label: "Total adspend", value: adspend, fmt: "usd" as const },
      { label: "Clicks", value: clicks, fmt: "int" as const },
      { label: "CPC", value: cpc, fmt: "usd" as const },
      { label: "Revenue", value: revenue, fmt: "usd" as const },
      { label: "Conversions", value: conversions, fmt: "int" as const },
      headline,
      { label: "CVR", value: cvr, fmt: "pct" as const },
    ];
  }, [columns, rows]);

  const fmt = (v: number | null, kind: string): string => {
    if (v == null) return "—";
    switch (kind) {
      case "usd":
        return v >= 10_000
          ? `$${(v / 1000).toLocaleString("en", { maximumFractionDigits: 1 })}K`
          : `$${v.toLocaleString("en", { maximumFractionDigits: 2 })}`;
      case "int":
        return v >= 10_000
          ? `${(v / 1000).toLocaleString("en", { maximumFractionDigits: 1 })}K`
          : v.toLocaleString("en", { maximumFractionDigits: 0 });
      case "x":
        return `${v.toLocaleString("en", { maximumFractionDigits: 1 })}×`;
      case "pct":
        return `${(v * 100).toLocaleString("en", { maximumFractionDigits: 1 })}%`;
      default:
        return String(v);
    }
  };

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {kpis.map((k) => (
        <div key={k.label} className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">{k.label}</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight">{fmt(k.value, k.fmt)}</p>
        </div>
      ))}
    </div>
  );
}
