"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { compactNumber } from "./format";

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  color?: string;
  formatValue?: (n: number) => string;
  className?: string;
}

const PAD = { top: 12, right: 12, bottom: 30, left: 48 };
const WIDTH = 600;

/** Rounded top corners, square at the baseline — never a fully-rounded pill. */
const roundedTopRect = (x: number, y: number, w: number, h: number, r: number): string => {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
};

export function BarChart({ data, height = 180, color = "var(--chart-1)", formatValue = compactNumber, className }: BarChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const yAt = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const n = data.length;
  const bandW = plotW / Math.max(1, n);
  const barW = Math.min(24, bandW * 0.6);
  const ticks = [0, max * 0.25, max * 0.5, max * 0.75, max];

  if (n === 0) {
    return <p className="text-sm text-muted-foreground">No data to chart.</p>;
  }

  return (
    <div className={cn("relative w-full", className)}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" role="img" aria-label="Bar chart">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 6} y={yAt(t)} textAnchor="end" dominantBaseline="middle" style={{ fontSize: 10, fill: "var(--muted-foreground)" }}>
              {formatValue(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.left + bandW * i + bandW / 2;
          const h = (d.value / max) * plotH;
          const y = PAD.top + plotH - h;
          const isHover = hover === i;
          return (
            <g key={d.label}>
              <rect
                x={cx - bandW / 2}
                y={PAD.top}
                width={bandW}
                height={plotH}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
              <path d={roundedTopRect(cx - barW / 2, y, barW, h, 4)} fill={color} opacity={isHover ? 1 : 0.85} />
              <text x={cx} y={height - 16} textAnchor="middle" style={{ fontSize: 10, fill: "var(--muted-foreground)" }}>
                {d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1.5 text-xs shadow-md"
          style={{ left: `${((PAD.left + bandW * hover + bandW / 2) / WIDTH) * 100}%` }}
        >
          <div className="font-medium text-popover-foreground">{data[hover].label}</div>
          <div className="tabular-nums text-muted-foreground">{formatValue(data[hover].value)}</div>
        </div>
      )}
    </div>
  );
}
