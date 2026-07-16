"use client";

import { useMemo } from "react";
import { computeKpiTotals } from "@/lib/analytics/kpi";
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
    const { adspend, clicks, cpc, revenue, conversions, roas, cvr } = computeKpiTotals({ columns, rows });
    return [
      { label: "Total adspend", value: adspend, fmt: "usd" as const },
      { label: "Clicks", value: clicks, fmt: "int" as const },
      { label: "CPC", value: cpc, fmt: "usd" as const },
      { label: "Revenue", value: revenue, fmt: "usd" as const },
      { label: "Conversions", value: conversions, fmt: "int" as const },
      { label: "ROAS", value: roas, fmt: "x" as const },
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
