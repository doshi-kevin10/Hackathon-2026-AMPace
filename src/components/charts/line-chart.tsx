"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { compactNumber, niceTicks } from "./format";

export interface LineSeries {
  id: string;
  name: string;
  color: string;
  points: (number | null)[];
}

interface LineChartProps {
  labels: string[];
  series: LineSeries[];
  height?: number;
  formatValue?: (n: number) => string;
  className?: string;
}

const PAD = { top: 12, right: 12, bottom: 22, left: 44 };
const WIDTH = 600;

/**
 * Single-axis line chart (never dual-axis — see dataviz skill anti-patterns).
 * Comparing metrics with different scales/units is done as small multiples of
 * this component, one metric per chart, not as two y-axes on one chart.
 */
export function LineChart({ labels, series, height = 180, formatValue = compactNumber, className }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const n = labels.length;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const allValues = series.flatMap((s) => s.points.filter((v): v is number => v != null));
  const rawMin = allValues.length ? Math.min(...allValues) : 0;
  const rawMax = allValues.length ? Math.max(...allValues) : 1;
  const min = Math.min(0, rawMin);
  const max = rawMax > min ? rawMax : min + 1;
  const ticks = niceTicks(min, max);
  const domainMin = Math.min(min, ticks[0] ?? min);
  const domainMax = Math.max(max, ticks[ticks.length - 1] ?? max);
  const span = domainMax - domainMin || 1;

  const xAt = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => PAD.top + plotH - ((v - domainMin) / span) * plotH;

  const pathFor = (points: (number | null)[]) => {
    let d = "";
    let drawing = false;
    points.forEach((v, i) => {
      if (v == null) {
        drawing = false;
        return;
      }
      d += `${drawing ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)} `;
      drawing = true;
    });
    return d.trim();
  };

  const labelStep = Math.max(1, Math.ceil(n / 6));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const i = Math.round(((relX - PAD.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hoverPct = hover != null ? (xAt(hover) / WIDTH) * 100 : 0;

  return (
    <div className={cn("relative w-full select-none", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Line chart: ${series.map((s) => s.name).join(", ")}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text x={PAD.left - 6} y={yAt(t)} textAnchor="end" dominantBaseline="middle" style={{ fontSize: 10, fill: "var(--muted-foreground)" }}>
              {formatValue(t)}
            </text>
          </g>
        ))}

        {labels.map((l, i) =>
          i % labelStep === 0 ? (
            <text key={i} x={xAt(i)} y={height - 6} textAnchor="middle" style={{ fontSize: 10, fill: "var(--muted-foreground)" }}>
              {l}
            </text>
          ) : null
        )}

        {hover != null && (
          <line
            x1={xAt(hover)}
            x2={xAt(hover)}
            y1={PAD.top}
            y2={height - PAD.bottom}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}

        {series.map((s) => (
          <g key={s.id}>
            <path d={pathFor(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.points.map((v, i) =>
              v != null && (i === n - 1 || i === hover) ? (
                <circle key={i} cx={xAt(i)} cy={yAt(v)} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} />
              ) : null
            )}
          </g>
        ))}
      </svg>

      {hover != null && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-28 rounded-md border border-border bg-popover px-2 py-1.5 text-xs shadow-md"
          style={{
            left: `${Math.min(96, Math.max(4, hoverPct))}%`,
            transform: hoverPct > 55 ? "translateX(-100%)" : undefined,
          }}
        >
          <div className="mb-1 font-medium text-popover-foreground">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
              </span>
              <span className="font-medium tabular-nums text-popover-foreground">
                {s.points[hover] == null ? "—" : formatValue(s.points[hover]!)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
