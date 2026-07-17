# AMPulse — Demo Walkthrough

**AMPulse is an AI automation agent for advertising managers.** It watches every ad
account, tells you what needs attention (and why), forecasts what's next, and can act on
your behalf — every number is computed deterministically; the AI only explains and drives.

## Run it (60 seconds)

```bash
cd excel-parser
npm install          # if not already
npm run build && npm run start     # → http://localhost:3000
# (or: npm run dev)
```

- **Mock data is ON by default** — 4 demo companies (Nike, Adidas, Spotify, Airbnb) with
  built-in stories, so the demo never depends on the network. Set `AMPULSE_MOCK=0` in
  `.env.local` to use live Databricks instead.
- **AI**: works out of the box. With `AI_MODE=anthropic` + `ANTHROPIC_API_KEY`, the agent
  uses Claude with live tool-calling. With no key (`AI_MODE` unset), a deterministic mock
  agent gives the same demo. Either way, numbers come from the engine, never the model.
- Login is pre-filled: `analyst@ampulse.dev` / `ampulse` → click **Sign in**.

## The 90-second walkthrough

1. **The watchtower (top-right 🔔).** The bell shows a red count. Open it:
   - 🔴 **Adidas · CPC +41% this week** and 🔴 **ROAS −30% this week** — the account in trouble.
   - 🟢 **Nike · Revenue +19%**, 🟢 **Spotify · Revenue +34%** — the winners.
   - 🔵 info: an *unusual* spike flagged by anomaly detection.
   These are 100% deterministic (ratio-of-sums, robust z-scores) — accurate, not hallucinated.
   Click **Adidas** → it jumps straight to Adidas's analytics.

2. **Ask AMPulse (top-right ✨).** Open the agent and try:
   - *"What needs my attention today?"* → prioritized rundown, worst first, with real numbers,
     and an **Open Adidas →** button that navigates you there.
   - *"Forecast Adidas revenue for the next 14 days."* → "$46,004 (range $44.8k–$47.2k), high
     confidence, backtest error ~1.5% — an estimate, not a guarantee."
   - *"How is Nike doing?"* → 30-day KPIs with week-over-week deltas, then offers to open it.
   The agent calls tools over the real analytics/forecast engine — it never invents a number,
   and it writes in plain English (no markdown clutter).

3. **A company: two things only — Data and Analytics.** From the dashboard card click
   **Analytics →** (or use the **Data / Analytics** toggle at the top of a company page).
   - **Analytics** opens on the last 30 days: direction-aware **KPI comparison** (green =
     favorable, red = unfavorable — an increase is *not* assumed good; rising CPC is red),
     an optional one-click **AI summary**, interactive **time-series** charts, and the
     **Forecast** (pick a metric + 7/14/30-day horizon → point line + shaded uncertainty band,
     the selected model, backtest accuracy, confidence, and **Export CSV**).
   - Everything deeper (drivers, anomalies, baseline stats, correlation) is one click away under
     **Deep dive** — there when you want it, out of the way when you don't.
   - **Data** is the raw daily grid (the "Excel").

## Why it wins

- **Agentic, not a chatbot bolted on.** The agent takes actions (navigates, opens, forecasts)
  and is grounded in a real analytics engine — 214 unit tests, ratio-of-sums correct,
  robust anomaly detection, rolling-backtested forecasts with honest uncertainty.
- **Accurate by construction.** AI phrases the results; deterministic code computes them. No
  "trust me" numbers, no invented forecasts, explicit "not a guarantee" language.
- **Clean.** Two things per company. One notification panel. One agent. Nothing else.

## Under the hood (talking points)

- Notifications: `src/lib/notifications/watchtower.ts` — week-over-week (direction-aware) +
  robust anomalies, cross-company, cached.
- Agent: `src/lib/agent/agent.ts` — Anthropic tool-use loop (`list_companies`,
  `get_company_analytics`, `forecast_metric`, `get_notifications`, `navigate`) with a
  deterministic offline fallback; output stripped of markdown.
- Analytics + forecasting engine: `src/lib/analytics/*`, `src/lib/forecasting/*` (see
  `docs/advanced-analytics/`). Forecast models are rolling-backtested; the lowest-WAPE model wins.
- Mock demo data: `src/lib/databricks/mock-data.ts` (deterministic, story-driven).
