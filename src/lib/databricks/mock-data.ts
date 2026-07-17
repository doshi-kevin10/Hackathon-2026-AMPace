/**
 * Deterministic MOCK company data for a reliable hackathon demo — no network,
 * no Databricks required. Each company has a baked-in "story" (healthy / CPC
 * blowout / anomaly spike / steady whale) engineered so the analytics, forecast,
 * and notification features all have something compelling to show.
 *
 * Enabled by default; set AMPACE_MOCK=0 to use live Databricks instead.
 */
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";
import type { DailyPoint } from "@/lib/analytics/series";
import type { Dataset } from "./analytics";
import type { DailySeries } from "./history";
import type { LiveTable } from "./sync";
import { DB_COLUMNS } from "./sync";

export const isMockEnabled = (): boolean => process.env.AMPACE_MOCK !== "0";

const MS_DAY = 86_400_000;
const DAYS = 180;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Story {
  name: string;
  label: string;
  seed: number;
  clicksBase: number;
  clickTrend: number; // per day
  cpc0: number;
  cpcTrend: number;
  cvr0: number;
  cvrTrend: number;
  revPerConv: number;
  /** Recent-window events (last N days) that make the 7-day comparison pop. */
  recent?: (t: number, days: number) => { spendMul?: number; revMul?: number; clickMul?: number; spike?: boolean };
}

const STORIES: Story[] = [
  {
    name: "excel_company_nike",
    label: "Nike",
    seed: 11,
    clicksBase: 2400,
    clickTrend: 7,
    cpc0: 1.15,
    cpcTrend: 0.0003,
    cvr0: 0.038,
    cvrTrend: 0.00002,
    revPerConv: 92,
    // Healthy: revenue accelerates in the last week (CVR bump).
    recent: (t, days) => (t >= days - 7 ? { revMul: 1.25, clickMul: 1.05 } : {}),
  },
  {
    name: "excel_company_adidas",
    label: "Adidas",
    seed: 23,
    clicksBase: 1800,
    clickTrend: 3,
    cpc0: 0.95,
    cpcTrend: 0.0016,
    cvr0: 0.034,
    cvrTrend: -0.00006,
    revPerConv: 61,
    // CPC blowout: spend jumps ~50% in the last week while clicks stay flat → CPC + ROAS problem.
    recent: (t, days) => (t >= days - 7 ? { spendMul: 1.5 } : {}),
  },
  {
    name: "excel_company_spotify",
    label: "Spotify",
    seed: 37,
    clicksBase: 3200,
    clickTrend: 5,
    cpc0: 0.72,
    cpcTrend: 0.0005,
    cvr0: 0.052,
    cvrTrend: 0.00001,
    revPerConv: 40,
    // Anomaly: a one-day revenue spike 4 days from the end.
    recent: (t, days) => (t === days - 4 ? { spike: true, revMul: 3.6 } : {}),
  },
  {
    name: "excel_company_airbnb",
    label: "Airbnb",
    seed: 51,
    clicksBase: 5200,
    clickTrend: 2,
    cpc0: 1.45,
    cpcTrend: 0.0001,
    cvr0: 0.028,
    cvrTrend: 0,
    revPerConv: 130,
    // Steady whale — flat, biggest spender.
  },
];

/** ISO date `daysAgo` before a fixed anchor (kept deterministic — no clock). */
const ANCHOR = Date.UTC(2026, 6, 15); // 2026-07-15
const isoAt = (t: number) => new Date(ANCHOR - (DAYS - 1 - t) * MS_DAY).toISOString().slice(0, 10);

function seriesFor(story: Story): DailyPoint[] {
  const rand = mulberry32(story.seed);
  // Uniform multiplicative jitter in [1-s, 1+s]. Each series draws its OWN jitter
  // so clicks, CPC, and revenue don't move in lockstep — that lockstep is what made
  // the old series a textbook sawtooth. Weekly seasonality + trend + story events are
  // the signal underneath; day-to-day jitter is the organic texture on top. Noise is
  // per-day (averages out over the 7-day windows the watchtower/forecast use), so the
  // baked-in stories survive while the daily view looks like real ad data.
  const jitter = (s: number) => 1 + (rand() - 0.5) * 2 * s;
  const out: DailyPoint[] = [];
  for (let t = 0; t < DAYS; t++) {
    const seasonal = 1 + 0.08 * Math.sin((2 * Math.PI * (t % 7)) / 7);
    const ev = story.recent?.(t, DAYS) ?? {};

    let clicks = Math.round((story.clicksBase + story.clickTrend * t) * seasonal * jitter(0.18) * (ev.clickMul ?? 1));
    clicks = Math.max(1, clicks);

    const cpc = Math.max(0.05, (story.cpc0 + story.cpcTrend * t) * jitter(0.12));
    const adspend = clicks * cpc * (ev.spendMul ?? 1);

    const cvr = Math.max(0.005, (story.cvr0 + story.cvrTrend * t) * jitter(0.15));
    const conversions = Math.max(0, Math.round(clicks * cvr));
    // Order value varies day to day — decouples revenue from clicks so ROAS swings realistically.
    const revenue = conversions * story.revPerConv * jitter(0.28) * (ev.revMul ?? 1); // ev.revMul carries the spike

    out.push({
      date: isoAt(t),
      total_adspend: Math.round(adspend * 100) / 100,
      clicks,
      revenue: Math.round(revenue * 100) / 100,
      conversions,
      rowCount: 1,
    });
  }
  return out;
}

const seriesCache = new Map<string, DailyPoint[]>();
const getSeries = (name: string): DailyPoint[] | null => {
  const story = STORIES.find((s) => s.name === name);
  if (!story) return null;
  if (!seriesCache.has(name)) seriesCache.set(name, seriesFor(story));
  return seriesCache.get(name)!;
};

export const isMockName = (name: string): boolean => STORIES.some((s) => s.name === name);

const sum = (pts: DailyPoint[], k: keyof DailyPoint) => pts.reduce((s, p) => s + (Number(p[k]) || 0), 0);

export function mockDatasets(): Dataset[] {
  return STORIES.map((s) => {
    const pts = getSeries(s.name)!;
    const spend = sum(pts, "total_adspend");
    const rev = sum(pts, "revenue");
    return {
      name: s.name,
      label: s.label,
      fqn: `mock.${s.name}`,
      rowCount: pts.length,
      latestDate: pts[pts.length - 1].date,
      avgRoas: Math.round((rev / spend) * 100) / 100,
      avgCpa: null,
      usesCpa: false,
      totalAdspend: Math.round(spend),
    };
  });
}

export function mockDailySeries(name: string): DailySeries {
  const pts = getSeries(name);
  if (!pts) throw new Error(`Unknown mock dataset "${name}"`);
  return { name, points: pts, duplicateDates: [], latestDate: pts[pts.length - 1].date, rowCount: pts.length };
}

const cell = (v: string | number | null, type: ParsedColumn["inferredType"], display: string | null): CellValue => ({
  raw: v,
  normalized: v,
  display,
  formula: null,
  type: v == null ? "empty" : type,
});

/** Mock LiveTable for the Data grid (mirrors pullLiveTable's 9-column shape). */
export function mockLiveTable(name: string): LiveTable & { label: string } {
  const story = STORIES.find((s) => s.name === name);
  const pts = getSeries(name);
  if (!story || !pts) throw new Error(`Unknown mock dataset "${name}"`);

  const columns: ParsedColumn[] = DB_COLUMNS.map((c, i) => ({
    id: `col_${i + 1}`,
    name: c.canonical,
    originalHeader: null,
    sheetColumn: -1,
    inferredType: c.sqlType === "DATE" ? "date" : c.sqlType === "BIGINT" ? "integer" : c.sqlType === "DOUBLE" ? "decimal" : "string",
    typeOverride: null,
    formula: null,
  }));

  const rows = pts.map((p) => {
    const cpc = p.clicks ? (p.total_adspend ?? 0) / p.clicks : null;
    const roas = p.total_adspend ? (p.revenue ?? 0) / p.total_adspend : null;
    const cvr = p.clicks ? (p.conversions ?? 0) / p.clicks : null;
    const day = WEEKDAYS[new Date(`${p.date}T00:00:00Z`).getUTCDay()];
    const usd = (n: number | null) => (n == null ? null : `$${n.toLocaleString("en", { maximumFractionDigits: 2 })}`);
    const num = (n: number | null, d = 2) => (n == null ? null : n.toLocaleString("en", { maximumFractionDigits: d }));
    return {
      col_1: cell(p.date, "date", p.date),
      col_2: cell(day, "string", day),
      col_3: cell(p.total_adspend, "currency", usd(p.total_adspend)),
      col_4: cell(p.clicks, "integer", num(p.clicks, 0)),
      col_5: cell(cpc, "currency", usd(cpc)),
      col_6: cell(p.revenue, "currency", usd(p.revenue)),
      col_7: cell(p.conversions, "integer", num(p.conversions, 0)),
      col_8: cell(roas, "decimal", num(roas)),
      col_9: cell(cvr, "decimal", cvr == null ? null : `${(cvr * 100).toFixed(2)}%`),
    } as Record<string, CellValue>;
  });

  return { columns, rows, databricksTable: `mock.${name}`, fetchedAt: new Date().toISOString(), label: story.label };
}
