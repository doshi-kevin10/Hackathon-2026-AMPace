/**
 * Automatic model selection via rolling backtest. Only *eligible* models
 * (enough history for the model and for at least one backtest window; seasonal
 * models need ≥2 full seasons) are scored. Ranking is by WAPE (primary),
 * tie-broken by RMSE. All candidates and their scores are kept for display.
 */
import { backtest, type BacktestConfig, type BacktestOutcome } from "./backtest";
import type { BacktestMetrics, PointModel } from "./types";

export interface ModelEvaluation {
  name: string;
  eligible: boolean;
  reason?: string;
  metrics: BacktestMetrics | null;
  windows: number;
  outcome?: BacktestOutcome;
}

export interface SelectionResult {
  selected: ModelEvaluation | null;
  candidates: ModelEvaluation[];
}

function eligibility(model: PointModel, n: number, config: BacktestConfig): { ok: boolean; reason?: string } {
  const seasonPeriod = config.seasonPeriod ?? 7;
  if (n < model.minObservations) return { ok: false, reason: `Needs ≥${model.minObservations} observations (have ${n}).` };
  if (config.minTrain + config.horizon > n) return { ok: false, reason: `Not enough data for a backtest window (need ${config.minTrain + config.horizon}).` };
  if (model.seasonal && n < 2 * seasonPeriod) return { ok: false, reason: `Seasonal model needs ≥${2 * seasonPeriod} observations for 2 seasons (have ${n}).` };
  return { ok: true };
}

const rank = (a: ModelEvaluation, b: ModelEvaluation): number => {
  const aw = a.metrics?.wape;
  const bw = b.metrics?.wape;
  if (aw != null && bw != null && aw !== bw) return aw - bw;
  if (aw != null && bw == null) return -1;
  if (aw == null && bw != null) return 1;
  const ar = a.metrics?.rmse ?? Infinity;
  const br = b.metrics?.rmse ?? Infinity;
  return ar - br;
};

export function selectModel(models: PointModel[], values: number[], config: BacktestConfig): SelectionResult {
  const candidates: ModelEvaluation[] = models.map((model) => {
    const el = eligibility(model, values.length, config);
    if (!el.ok) return { name: model.name, eligible: false, reason: el.reason, metrics: null, windows: 0 };
    const outcome = backtest(model, values, config);
    return { name: model.name, eligible: true, metrics: outcome.metrics, windows: outcome.windows, outcome };
  });

  const eligible = candidates.filter((c) => c.eligible && (c.metrics?.wape != null || c.metrics?.rmse != null));
  eligible.sort(rank);
  return { selected: eligible[0] ?? null, candidates };
}
