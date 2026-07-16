"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { compactNumber } from "./format";

export interface PieDatum {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieDatum[];
  size?: number;
  formatValue?: (n: number) => string;
  className?: string;
}

export function PieChart({ data, size = 160, formatValue = compactNumber, className }: PieChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;

  const slices = data.reduce<(PieDatum & { start: number; end: number; frac: number })[]>((acc, d) => {
    const start = acc.length ? acc[acc.length - 1].end : -Math.PI / 2;
    const frac = d.value / total;
    acc.push({ ...d, start, end: start + frac * Math.PI * 2, frac });
    return acc;
  }, []);

  const arcPath = (start: number, end: number, radius: number) => {
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2} Z`;
  };

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data to chart.</p>;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Pie chart">
        {slices.map((s, i) => (
          <path
            key={s.label}
            d={arcPath(s.start, s.end, hover === i ? r + 3 : r)}
            fill={s.color}
            stroke="var(--card)"
            strokeWidth={2}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            style={{ transition: "d 120ms ease" }}
          />
        ))}
      </svg>
      <div className="grid gap-1 text-xs">
        {slices.map((s, i) => (
          <div key={s.label} className={cn("flex items-center gap-1.5", hover === i && "font-medium")}>
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-foreground">{s.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatValue(s.value)} ({Math.round(s.frac * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
