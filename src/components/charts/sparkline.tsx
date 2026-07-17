"use client";

import { cn } from "@/lib/utils";

/** Minimal axis-less trend line (stock-ticker style) with a soft area fill. Pure SVG, no deps. */
export function Sparkline({
  points,
  color = "var(--chart-1)",
  height = 48,
  className,
}: {
  points: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  const W = 240;
  const H = height;
  const P = 3;
  if (points.length < 2) return <div style={{ height: H }} className={className} aria-hidden />;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const n = points.length;
  const x = (i: number) => P + (i / (n - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - min) / span) * (H - 2 * P);

  const line = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("w-full", className)} style={{ height: H }} role="img" aria-label="trend">
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
