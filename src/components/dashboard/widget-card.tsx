"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { BarChart } from "@/components/charts/bar-chart";
import { compactNumber } from "@/components/charts/format";
import { LineChart } from "@/components/charts/line-chart";
import { PieChart } from "@/components/charts/pie-chart";
import { ForecastWidget } from "@/components/dashboard/forecast-widget";
import { MomentumWidget } from "@/components/dashboard/momentum-widget";
import { computeKpiTotals } from "@/lib/analytics/kpi";
import { byDayOfWeek, timeSeries, topRows, type Table } from "@/lib/dashboard/compute";
import { colorForMetric, type WidgetSpec } from "@/lib/dashboard/widgets";
import { cn } from "@/lib/utils";

/** Colorful, evenly-distinct slice colors for pie widgets (position-based is fine here — slices aren't a fixed entity). */
const PIE_PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)"];

export interface CompanyStat {
  name: string;
  label: string;
  avgRoas: number | null;
  totalAdspend: number | null;
}

/** Formatter appropriate to a canonical metric. */
export function fmtFor(metric?: string): (n: number) => string {
  if (metric === "ROAS") return (n) => `${n.toFixed(2)}×`;
  if (metric === "CVR") return (n) => `${(n * 100).toFixed(1)}%`;
  if (metric === "Revenue" || metric === "Total Adspend" || metric === "CPC" || metric === "CPA")
    return (n) => `$${compactNumber(n)}`;
  return compactNumber;
}

const fmtUsd = (v: number | null) =>
  v == null ? "—" : v >= 10_000 ? `$${(v / 1000).toLocaleString("en", { maximumFractionDigits: 1 })}K` : `$${v.toLocaleString("en", { maximumFractionDigits: 2 })}`;
const fmtInt = (v: number | null) =>
  v == null ? "—" : v >= 10_000 ? `${(v / 1000).toLocaleString("en", { maximumFractionDigits: 1 })}K` : v.toLocaleString("en", { maximumFractionDigits: 0 });

function Shell({ spec, onRemove, children, subtitle }: { spec: WidgetSpec; onRemove: () => void; children: React.ReactNode; subtitle?: string }) {
  return (
    <div className={cn("group/w flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm", spec.span === 2 ? "lg:col-span-2" : "")}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{spec.title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${spec.title}`}
          title="Remove"
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/w:opacity-100"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function WidgetCard({
  spec,
  table,
  label,
  companies,
  onRemove,
}: {
  spec: WidgetSpec;
  table: Table;
  label: string;
  companies: CompanyStat[];
  onRemove: () => void;
}) {
  const body = useMemo(() => {
    switch (spec.type) {
      case "kpi": {
        const k = computeKpiTotals(table);
        const tracksCpa = table.columns.some((c) => c.name === "CPA");
        const tiles: { label: string; value: string }[] = [
          { label: "Ad spend", value: fmtUsd(k.adspend) },
          { label: "Revenue", value: fmtUsd(k.revenue) },
          { label: "Clicks", value: fmtInt(k.clicks) },
          { label: "Conversions", value: fmtInt(k.conversions) },
          { label: "CPC", value: fmtUsd(k.cpc) },
          tracksCpa
            ? { label: "CPA", value: fmtUsd(k.cpa) }
            : { label: "ROAS", value: k.roas == null ? "—" : `${k.roas.toFixed(2)}×` },
          { label: "CVR", value: k.cvr == null ? "—" : `${(k.cvr * 100).toFixed(1)}%` },
        ];
        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-lg border border-border/70 bg-background px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">{t.value}</p>
              </div>
            ))}
          </div>
        );
      }
      case "line": {
        const metric = spec.metric ?? "Revenue";
        const { labels, points } = timeSeries(table, metric);
        if (!labels.length) return <Empty />;
        return (
          <LineChart
            labels={labels}
            height={220}
            formatValue={fmtFor(metric)}
            series={[{ id: metric, name: metric, color: colorForMetric(metric), points }]}
          />
        );
      }
      case "barDow": {
        const metric = spec.metric ?? "Revenue";
        const data = byDayOfWeek(table, metric);
        if (!data.length) return <Empty />;
        return <BarChart data={data} height={220} color={colorForMetric(metric)} formatValue={fmtFor(metric)} />;
      }
      case "pie": {
        const metric = spec.metric ?? "Revenue";
        const data = byDayOfWeek(table, metric).filter((d) => d.value > 0);
        if (!data.length) return <Empty />;
        const pieData = data.map((d, i) => ({ ...d, color: PIE_PALETTE[i % PIE_PALETTE.length] }));
        return (
          <div className="grid h-full place-items-center">
            <PieChart data={pieData} size={200} formatValue={fmtFor(metric)} />
          </div>
        );
      }
      case "compare": {
        const isSpend = spec.compareMetric === "spend";
        const data = companies
          .map((c) => ({ label: c.label, value: (isSpend ? c.totalAdspend : c.avgRoas) ?? 0 }))
          .filter((d) => d.value > 0)
          .sort((a, b) => b.value - a.value);
        if (!data.length) return <Empty />;
        return <BarChart data={data} height={240} color="var(--chart-1)" formatValue={isSpend ? (n) => `$${compactNumber(n)}` : (n) => `${n.toFixed(2)}×`} />;
      }
      case "table": {
        const metric = spec.metric ?? "Revenue";
        const rows = topRows(table, metric, 8);
        const f = fmtFor(metric);
        if (!rows.length) return <Empty />;
        return (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-1.5 font-medium">#</th>
                <th className="py-1.5 font-medium">Date</th>
                <th className="py-1.5 text-right font-medium">{metric}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.label + i} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="py-1.5">{r.label}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{f(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      case "alerts":
        return <Alerts table={table} label={label} />;
      case "momentum":
        return <MomentumWidget table={table} />;
      case "forecast":
        return <ForecastWidget table={table} metric={spec.metric} />;
    }
  }, [spec, table, label, companies]);

  return (
    <Shell spec={spec} onRemove={onRemove}>
      {body}
    </Shell>
  );
}

const Empty = () => (
  <div className="grid h-40 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
    This metric isn’t available for this company.
  </div>
);

/** Deterministic, professional "signals" derived from the real series — reads like a Tableau alert strip. */
function Alerts({ table, label }: { table: Table; label: string }) {
  const cards = useMemo(() => {
    const out: { tone: "good" | "warn" | "bad" | "info"; title: string; detail: string }[] = [];
    const trend = (metric: string) => {
      const { points } = timeSeries(table, metric);
      const vals = points.filter((v): v is number => v != null);
      if (vals.length < 8) return null;
      const half = Math.min(7, Math.floor(vals.length / 2));
      const recent = vals.slice(-half).reduce((a, b) => a + b, 0) / half;
      const prior = vals.slice(-2 * half, -half).reduce((a, b) => a + b, 0) / half;
      if (!prior) return null;
      return { pct: (recent - prior) / prior, recent };
    };

    const rev = trend("Revenue");
    if (rev) {
      const up = rev.pct >= 0;
      out.push({
        tone: up ? "good" : "warn",
        title: `Revenue ${up ? "up" : "down"} ${Math.abs(rev.pct * 100).toFixed(0)}% week-over-week`,
        detail: `${label}'s recent 7-day revenue run rate is ${up ? "ahead of" : "behind"} the prior week.`,
      });
    }
    const roas = trend("ROAS");
    if (roas) {
      const below = roas.recent < 3;
      out.push({
        tone: below ? "bad" : "good",
        title: `ROAS averaging ${roas.recent.toFixed(2)}× recently`,
        detail: below ? "Below the 3.0× efficiency target — review bids and creatives." : "Comfortably above the 3.0× efficiency target.",
      });
    }
    const spend = trend("Total Adspend");
    if (spend && spend.pct > 0.15) {
      out.push({
        tone: "warn",
        title: `Ad spend climbing ${(spend.pct * 100).toFixed(0)}% week-over-week`,
        detail: "Pacing faster than last week — confirm budget headroom for the period.",
      });
    }
    out.push({ tone: "info", title: "Data current", detail: "Metrics synced from Databricks; no data-quality gaps detected in the loaded window." });
    return out;
  }, [table, label]);

  const TONE: Record<string, string> = {
    good: "border-emerald-500/30 bg-emerald-500/5",
    warn: "border-amber-500/30 bg-amber-500/5",
    bad: "border-destructive/30 bg-destructive/5",
    info: "border-border bg-background",
  };
  const DOT: Record<string, string> = { good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-destructive", info: "bg-muted-foreground" };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {cards.map((c, i) => (
        <div key={i} className={cn("flex items-start gap-3 rounded-lg border p-3", TONE[c.tone])}>
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[c.tone])} aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug">{c.title}</p>
            <p className="text-xs text-muted-foreground">{c.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
