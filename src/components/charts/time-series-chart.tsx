"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { compactNumber, niceTicks } from "./format";

export interface TsSeries {
  id: string;
  name: string;
  color: string;
  points: (number | null)[];
  /** Dashed line (e.g. a comparison overlay or forecast point estimate). */
  dashed?: boolean;
}

/** A shaded region between two bounds (forecast interval / comparison range). */
export interface TsBand {
  lower: (number | null)[];
  upper: (number | null)[];
  color: string;
}

interface Props {
  labels: string[];
  series: TsSeries[];
  band?: TsBand;
  /** Index where the forecast begins — draws a dashed divider and shades the future. */
  forecastStartIndex?: number;
  height?: number;
  formatValue?: (n: number) => string;
  className?: string;
}

const PAD = { top: 14, right: 14, bottom: 24, left: 52 };
const WIDTH = 640;

/**
 * Single-axis time-series chart (never dual-axis — dataviz non-negotiable).
 * Multiple metrics are shown as small multiples of this component upstream, one
 * metric per chart. Supports a shaded band (forecast interval / comparison),
 * a forecast divider, and a hover crosshair+tooltip. Theme-aware via CSS vars.
 */
export function TimeSeriesChart({ labels, series, band, forecastStartIndex, height = 200, formatValue = compactNumber, className }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const bandValues = band ? [...band.lower, ...band.upper] : [];
  const allValues = [...series.flatMap((s) => s.points), ...bandValues].filter((v): v is number => v != null);
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

  const linePath = (pts: (number | null)[]) => {
    let d = "";
    let drawing = false;
    pts.forEach((v, i) => {
      if (v == null) {
        drawing = false;
        return;
      }
      d += `${drawing ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)} `;
      drawing = true;
    });
    return d.trim();
  };

  // Band as a filled polygon: upper forward, lower backward. Only over indices where both exist.
  const bandPath = (() => {
    if (!band) return "";
    const idxs = band.upper.map((_, i) => i).filter((i) => band.upper[i] != null && band.lower[i] != null);
    if (idxs.length < 2) return "";
    const up = idxs.map((i) => `${xAt(i).toFixed(1)},${yAt(band.upper[i]!).toFixed(1)}`);
    const down = [...idxs].reverse().map((i) => `${xAt(i).toFixed(1)},${yAt(band.lower[i]!).toFixed(1)}`);
    return `M${up.join(" L")} L${down.join(" L")} Z`;
  })();

  const labelStep = Math.max(1, Math.ceil(n / 7));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const i = Math.round(((relX - PAD.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hoverPct = hover != null ? (xAt(hover) / WIDTH) * 100 : 0;
  const fcX = forecastStartIndex != null && forecastStartIndex >= 0 && forecastStartIndex < n ? xAt(forecastStartIndex) : null;

  return (
    <div className={cn("relative w-full select-none", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Time series: ${series.map((s) => s.name).join(", ")}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* Forecast region shading */}
        {fcX != null && (
          <rect x={fcX} y={PAD.top} width={WIDTH - PAD.right - fcX} height={plotH} fill="var(--muted-foreground)" opacity={0.06} />
        )}

        {/* Y grid + labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 6} y={yAt(t)} textAnchor="end" dominantBaseline="middle" style={{ fontSize: 10, fill: "var(--muted-foreground)" }}>
              {formatValue(t)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {labels.map((l, i) =>
          i % labelStep === 0 || i === n - 1 ? (
            <text key={i} x={xAt(i)} y={height - 7} textAnchor="middle" style={{ fontSize: 9, fill: "var(--muted-foreground)" }}>
              {l}
            </text>
          ) : null
        )}

        {/* Uncertainty band */}
        {bandPath && <path d={bandPath} fill={band!.color} opacity={0.18} stroke="none" />}

        {/* Forecast divider */}
        {fcX != null && <line x1={fcX} x2={fcX} y1={PAD.top} y2={height - PAD.bottom} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" />}

        {/* Hover crosshair */}
        {hover != null && <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={height - PAD.bottom} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="2 2" />}

        {/* Series lines */}
        {series.map((s) => (
          <g key={s.id}>
            <path
              d={linePath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? "5 4" : undefined}
            />
            {s.points.map((v, i) =>
              v != null && (i === hover || (hover == null && i === n - 1)) ? (
                <circle key={i} cx={xAt(i)} cy={yAt(v)} r={3.5} fill={s.color} stroke="var(--card)" strokeWidth={2} />
              ) : null
            )}
          </g>
        ))}
      </svg>

      {hover != null && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-32 rounded-md border border-border bg-popover px-2 py-1.5 text-xs shadow-md"
          style={{ left: `${Math.min(96, Math.max(4, hoverPct))}%`, transform: hoverPct > 55 ? "translateX(-100%)" : undefined }}
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
          {band && band.lower[hover] != null && band.upper[hover] != null && (
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-1 text-muted-foreground">
              <span>Range</span>
              <span className="tabular-nums">
                {formatValue(band.lower[hover]!)}–{formatValue(band.upper[hover]!)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
