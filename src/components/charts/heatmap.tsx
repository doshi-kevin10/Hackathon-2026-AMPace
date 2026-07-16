"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { compactNumber } from "./format";

export interface HeatmapDay {
  date: string;
  value: number | null;
  band: "red" | "yellow" | "green" | null;
}

interface HeatmapProps {
  data: HeatmapDay[];
  formatValue?: (n: number) => string;
  className?: string;
}

/** Status colors — reserved roles, never reused as a generic categorical hue. Same hex in both themes. */
const BAND_COLOR: Record<"red" | "yellow" | "green", string> = {
  green: "#0ca30c",
  yellow: "#fab219",
  red: "#d03b3b",
};
const NO_DATA_COLOR = "var(--border)";

const CELL = 13;
const GAP = 3;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** GitHub-style calendar heatmap: one column per week, one row per weekday. */
export function Heatmap({ data, formatValue = compactNumber, className }: HeatmapProps) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No dated rows to plot.</p>;
  }

  const parsed = data.map((d) => ({ ...d, dateObj: new Date(`${d.date}T00:00:00Z`) }));
  const first = parsed[0].dateObj;
  const firstWeekStart = new Date(first);
  firstWeekStart.setUTCDate(first.getUTCDate() - first.getUTCDay());

  const cells = parsed.map((d) => {
    const dayOfWeek = d.dateObj.getUTCDay();
    const weekIndex = Math.floor((d.dateObj.getTime() - firstWeekStart.getTime()) / (7 * 86_400_000));
    return { ...d, dayOfWeek, weekIndex };
  });
  const weekCount = Math.max(...cells.map((c) => c.weekIndex)) + 1;
  const width = 28 + weekCount * (CELL + GAP);
  const height = 16 + 7 * (CELL + GAP);

  const colorFor = (band: HeatmapDay["band"]) => (band == null ? NO_DATA_COLOR : BAND_COLOR[band]);
  const labelFor = (band: HeatmapDay["band"]) =>
    band == null ? "No data" : band === "green" ? "On target" : band === "yellow" ? "Off target" : "Well off target";

  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: Math.min(width, 900), height }} role="img" aria-label="Goal-status heatmap">
        {DAY_LABELS.map((label, i) =>
          i % 2 === 1 ? (
            <text key={label} x={0} y={16 + i * (CELL + GAP) + CELL - 3} style={{ fontSize: 9, fill: "var(--muted-foreground)" }}>
              {label}
            </text>
          ) : null
        )}
        {cells.map((c, i) => (
          <rect
            key={c.date}
            x={28 + c.weekIndex * (CELL + GAP)}
            y={16 + c.dayOfWeek * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx={2}
            fill={colorFor(c.band)}
            opacity={hover === i ? 1 : 0.85}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover((h) => (h === i ? null : h))}
          />
        ))}
      </svg>

      {hover != null && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2 py-1.5 text-xs shadow-md"
          style={{
            left: 28 + cells[hover].weekIndex * (CELL + GAP),
            top: 16 + cells[hover].dayOfWeek * (CELL + GAP) + CELL + 6,
          }}
        >
          <div className="font-medium text-popover-foreground">{cells[hover].date}</div>
          <div className="text-muted-foreground">
            {cells[hover].value == null ? "No data" : formatValue(cells[hover].value)}
            {cells[hover].band != null && <span> — {labelFor(cells[hover].band)}</span>}
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BAND_COLOR.green }} />
          On target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BAND_COLOR.yellow }} />
          Off target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BAND_COLOR.red }} />
          Well off target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: NO_DATA_COLOR }} />
          No data
        </span>
      </div>
    </div>
  );
}
