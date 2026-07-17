# AMPace — 4-Minute Demo Script

> Teleprompter-style. **SAY** = read aloud. **[DO]** = click/type exactly as written.
> Total run time ≈ 4:00. Read at a calm pace — don't rush.

---

## ⛑️ PRE-FLIGHT (do this 5 min before, off-screen)

- [ ] App is running and open at **http://localhost:3000**, sitting on the **login screen**.
- [ ] A second window/tab has the **Slack channel** open and visible (you'll send a live alert to it).
- [ ] You have internet — the app pulls **live** data, news, and AI.
- [ ] **Do NOT click "Clear all"** on any Analytics dashboard.
- [ ] Use the **exact prompts** written below. They're chosen to work every time.
- [ ] Company you'll demo throughout: **American Airlines** (best data + cleanest news).

**If anything is slow to load:** pause, say *"this is pulling live from our warehouse,"* wait 3 seconds, continue. Never refresh mid-demo.

---

## 🎬 THE WALKTHROUGH

### ▸ 0:00 — Open & the portfolio  *(~25 sec)*

**[DO]** On the login screen, just click **Sign in** (email + password are already filled in).

**SAY:**
> "This is **AMPace** — an AI copilot for advertising managers. It watches every ad account, tells you what needs your attention, forecasts what's coming next, and pushes alerts straight to your team.
>
> Here's my portfolio. Every account is **live**, streaming straight from our data warehouse. At a glance I get each one's ROAS, total ad spend, and how many days we're tracking."

---

### ▸ 0:25 — A company: the Data view  *(~30 sec)*

**[DO]** On the **American Airlines** card, click **Open →**.

**SAY:**
> "Let's open American Airlines. Every account has just two things — **Data** and **Analytics**. No clutter.
>
> This is **Data** — the raw daily numbers, like a live spreadsheet. It's organized by month, I can add my own formula columns, leave notes on any cell, and export straight to Excel. Anything I touch here stays on my screen — the real data in the warehouse is never changed."

---

### ▸ 0:55 — Analytics builds itself + ask AMPace  *(~55 sec)*

**[DO]** Click the **Analytics** tab. (A full dashboard appears on its own.)

**SAY:**
> "Now **Analytics** — and notice it built itself. The moment I open it, AMPace lays out a full dashboard: headline KPIs, revenue and spend trends, day-of-week patterns, and momentum.
>
> But here's the real trick — I can just **ask** for anything."

**[DO]** Click **AMPace** (top-right). In the box type exactly:
`Forecast revenue for the next 2 weeks` → press **Enter**.

**SAY** *(while the "Building your analytics…" animation plays):*
> "I'll ask it to forecast revenue for the next two weeks. It builds the chart and drops it right onto the dashboard."

**SAY** *(when the forecast appears):*
> "There it is — the solid line is our actual history, and the projection carries it forward.
>
> Today the forecast learns from our recent weeks of data. **The more history each account builds up, the sharper this gets** — it'll start catching seasonality, holidays, and campaign spikes, with a confidence range around every prediction."

---

### ▸ 1:50 — One more ask (shows breadth)  *(~20 sec)*

**[DO]** In **AMPace**, type exactly:
`How does ROAS compare across companies?` → press **Enter**.

**SAY:**
> "I can keep going — compare ROAS across all my accounts, break things down by day of week, pull a KPI scorecard. Plain English in, real charts out — every number computed for real, never made up."

---

### ▸ 2:10 — News: the outside world  *(~25 sec)*

**[DO]** Click **News** (top-right). It opens on American Airlines.

**SAY:**
> "AMPace also watches the outside world. **News** pulls the latest live headlines about whatever account I'm on — so when a number moves, I can check whether something in the real world moved it.
>
> The next step here is having it **connect a headline to a spike in the data automatically** and tell me, 'this is why your numbers jumped.'"

**[DO]** Close the News panel (X or click outside).

---

### ▸ 2:35 — Slack: alerts that come to you  *(~30 sec)*

**[DO]** Click **Slack** (top-right). Type exactly:
`Alert me when ROAS drops below target` → press **Enter**.
*(Fire it only ONCE.)* Then switch to your Slack window.

**SAY:**
> "And it doesn't just live in this app. I describe the alert I want — 'let me know if ROAS drops below target' — and it fires a clean, ready-to-act alert straight into our **Slack**."

**[DO]** Point to the message that just landed in Slack.

**SAY:**
> "There it is — the metric, what changed, and a recommended next step, with the account owner tagged. Right now I trigger it on demand; **next, it'll fire on its own the instant the data crosses a threshold I set** — and send scheduled digests too."

---

### ▸ 3:05 — It's watching the whole time  *(~35 sec)*

**[DO]** Point to the **nudge in the bottom-right corner** ("AMPace noticed…"). If it's collapsed to a pill, click it. Then click the **AMPace logo** (top-left) to go Home and show the **"Your activity summary"** card.

**SAY:**
> "And it's paying attention the whole time. See this — AMPace **noticed on its own** that I've been deep in American Airlines and haven't looked at my other accounts, so it nudges me. And back on the home screen, my activity summary tells me what's worth a second look.
>
> I don't go hunting for problems — the problems come to me. Today it learns from what I click; next it'll learn across the whole team and every device."

---

### ▸ 3:40 — Close  *(~20 sec)*

**SAY:**
> "That's **AMPace**. It watches every account, explains what's happening in plain English, forecasts what's next, and tells you what actually matters — right inside your day, and right inside Slack. Less digging, more deciding. Thank you."

---

## 🧭 SAFE PROMPT MENU (if you need to improvise in AMPace)

Any of these build a clean chart every time — company must be open first:

| Type this | You get |
|---|---|
| `Forecast revenue for the next 2 weeks` | Forecast chart |
| `How does ROAS compare across companies?` | Cross-account comparison |
| `Break down revenue by day of week` | Day-of-week chart |
| `Give me a KPI summary` | KPI tiles + trend lines |
| `Chart spend vs conversions` | Trend line |

For **Slack**, any phrasing works but **fire it just once** — e.g. `Send me a daily performance digest`.

---

## 🔭 FUTURE SCOPE (speaker backup — if asked "what's next?")

Honest, confident framing for each area. Only use if someone asks.

- **Forecasting** — Today it projects from recent history. With more data per account it will learn **seasonality, holidays, and campaign cycles**, add **confidence ranges**, and auto-pick the best model per metric. (The accurate forecasting engine is already built underneath — this is about feeding it more history.)
- **News → data** — Today News shows live headlines. Next it will **automatically link a headline to a metric spike** ("your CPC jumped the day this launched") and rank headlines by real relevance.
- **Alerts** — Today you fire an alert on demand. Next: **automatic, threshold-based triggers** and **scheduled digests**, fully configurable per account.
- **Automation** — The roadmap is for the agent to **act**, not just advise — pause weak keywords, shift budget to winners — with approval.
- **Activity intelligence** — Today the "it noticed" nudges learn from what you click in this browser. Next: **team-wide, cross-device memory** on the server.
- **Analytics chat** — Today AMPace maps your request to the right chart reliably. Next: **deeper open-ended questions** answered directly in the chart.

---

## ⚠️ PRESENTER NOTES — do not say these out loud

- **Fire the Slack alert only once.** It sends the same polished alert each time by design; sending it twice with different wording could look repetitive.
- **Stick to American Airlines** for News — other accounts return noisier headlines.
- **Don't click "Clear all"** on Analytics — it wipes the auto-built charts.
- If AMPace ever seems empty, make sure a **company is open first** (you must be on a company page, not the home screen).
- Everything is live (warehouse, AI, news, Slack) — needs internet. A brief pause while things load is normal; narrate it, don't refresh.
