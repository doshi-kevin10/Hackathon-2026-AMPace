"use client";

import { useMemo, useState } from "react";
import { BarChart } from "@/components/charts/bar-chart";
import { compactNumber, percentFormat } from "@/components/charts/format";
import { LineChart } from "@/components/charts/line-chart";
import { PieChart } from "@/components/charts/pie-chart";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  categoricalColumns,
  categoryAggregate,
  dateColumn,
  histogram,
  lineSeries,
  numericColumns,
} from "@/lib/excel/chart-data";
import type { ParsedColumn, ParsedTable } from "@/lib/schemas/workbook";

const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

const formatterFor = (col: ParsedColumn) =>
  (col.typeOverride ?? col.inferredType) === "percentage" ? percentFormat : compactNumber;

export function TableAnalytics({ table }: { table: ParsedTable }) {
  const numCols = useMemo(() => numericColumns(table), [table]);
  const dateCol = useMemo(() => dateColumn(table), [table]);
  const catCols = useMemo(() => categoricalColumns(table), [table]);

  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    () => new Set(numericColumns(table).slice(0, 2).map((c) => c.id))
  );
  const [histColId, setHistColId] = useState<string | undefined>(undefined);
  const [groupColId, setGroupColId] = useState<string | undefined>(undefined);
  const [groupMetricId, setGroupMetricId] = useState<string | undefined>(undefined);
  const [breakdownForm, setBreakdownForm] = useState<"bar" | "pie">("bar");

  const groupColObj = catCols.find((c) => c.column.id === groupColId)?.column ?? catCols[0]?.column;
  const groupMetricObj = numCols.find((c) => c.id === groupMetricId) ?? numCols[0];
  const histColObj = numCols.find((c) => c.id === histColId) ?? numCols[0];

  const pieData = useMemo(() => {
    if (!groupColObj || !groupMetricObj) return [];
    const agg = categoryAggregate(table, groupColObj, groupMetricObj);
    const top = agg.slice(0, 4).map((d, i) => ({ ...d, color: SERIES_COLORS[i] }));
    const restSum = agg.slice(4).reduce((s, d) => s + d.value, 0);
    if (restSum > 0) top.push({ label: "Other", value: restSum, color: "var(--muted-foreground)" });
    return top;
  }, [table, groupColObj, groupMetricObj]);

  if (numCols.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No numeric columns to chart.</p>;
  }

  const toggleMetric = (id: string) => {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeMetrics = numCols.filter((c) => selectedMetrics.has(c.id));

  return (
    <div className="grid gap-6">
      {dateCol && (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h4 className="text-sm font-semibold">Trend over time</h4>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {numCols.map((c, i) => (
                <label key={c.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={selectedMetrics.has(c.id)}
                    onChange={() => toggleMetric(c.id)}
                    style={{ accentColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          {/* One metric per chart, never a dual-axis combo: different units/scales get their own y-axis. */}
          {activeMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">Select at least one metric above.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeMetrics.map((c) => {
                const idx = numCols.findIndex((n) => n.id === c.id);
                const points = lineSeries(table, dateCol, c);
                return (
                  <div key={c.id} className="rounded-lg border border-border p-3">
                    <p className="mb-1 text-xs font-medium text-foreground">{c.name}</p>
                    <LineChart
                      labels={points.map((p) => p.x)}
                      series={[
                        {
                          id: c.id,
                          name: c.name,
                          color: SERIES_COLORS[idx % SERIES_COLORS.length],
                          points: points.map((p) => p.value),
                        },
                      ]}
                      height={160}
                      formatValue={formatterFor(c)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {catCols.length > 0 && groupColObj && groupMetricObj && (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">Breakdown by category</h4>
            <Select value={groupColObj.id} onValueChange={(v) => v && setGroupColId(v)}>
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue>
                  {(v: string) => catCols.find((c) => c.column.id === v)?.column.name ?? v}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {catCols.map((c) => (
                  <SelectItem key={c.column.id} value={c.column.id}>
                    {c.column.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={groupMetricObj.id} onValueChange={(v) => v && setGroupMetricId(v)}>
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue>{(v: string) => numCols.find((c) => c.id === v)?.name ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {numCols.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-1">
              <Button
                type="button"
                variant={breakdownForm === "bar" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setBreakdownForm("bar")}
              >
                Bar
              </Button>
              <Button
                type="button"
                variant={breakdownForm === "pie" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setBreakdownForm("pie")}
              >
                Pie
              </Button>
            </div>
          </div>
          {breakdownForm === "bar" ? (
            <BarChart
              data={categoryAggregate(table, groupColObj, groupMetricObj)}
              formatValue={formatterFor(groupMetricObj)}
              height={190}
            />
          ) : (
            <PieChart data={pieData} formatValue={formatterFor(groupMetricObj)} />
          )}
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold">Distribution</h4>
          {histColObj && (
            <Select value={histColObj.id} onValueChange={(v) => v && setHistColId(v)}>
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue>{(v: string) => numCols.find((c) => c.id === v)?.name ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {numCols.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {histColObj && (
          <BarChart data={histogram(table, histColObj)} color="var(--chart-1)" formatValue={compactNumber} height={170} />
        )}
      </section>
    </div>
  );
}

export const hasChartableData = (table: ParsedTable): boolean => numericColumns(table).length > 0;
