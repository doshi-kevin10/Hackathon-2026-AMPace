/**
 * The Advisor persona — a scripted "coach" that knows how the user works.
 *
 * For the hackathon demo there's no real usage telemetry, so the persona is a
 * hardcoded habit profile plus canned, company-aware advice. Everything here is
 * deterministic and anchored to the fixed mock stories (Nike healthy/scaling,
 * Adidas CPC blowout, Spotify surge, Airbnb steady whale) so the scripted copy
 * never contradicts the charts. Both AMPace (the chatbot) and the home-screen
 * daily briefing read from this one file.
 *
 * ponytail: fully scripted by product decision — swap for a live model + real
 * usage signals when telemetry exists.
 */

/** The company the briefing points you at (the one "needing attention"). */
export const ATTENTION_COMPANY = { name: "excel_company_adidas", label: "Adidas" };

/** Does this prompt want coaching/advice, rather than "build me a chart"? */
export function isCoachingPrompt(q: string): boolean {
  return /\bimprove\b|make .*better|do better|how am i doing|how are we doing|what should i do|do(ing)?\b.*different|different(ly)?|wasting|where.*(waste|leak|lose|losing)|\badvice\b|advise|recommend|coach|my habits?|how do i work|next move|what would you do|help me (improve|win|grow|do better)/i.test(
    q,
  );
}

const HABIT_SUMMARY =
  "Here's how you tend to work: ROAS is the first thing you check every morning, and you scale spend fast when it looks strong. You're slower to react when CPC creeps up, and you almost never revisit CVR or creative — that's your biggest untapped lever.";

/** Canned, story-anchored advice per known company (keyed by dataset slug). */
const COMPANY_ADVICE: Record<string, string> = {
  excel_company_nike:
    "Nike is your success story — you've pushed its budget all week and ROAS is holding around 3.1×, so the scaling is earning its keep. To go further, stop leaning only on budget: run a creative or landing-page test to lift CVR. That's how you turn a good account into a compounding one.",
  excel_company_adidas:
    "Adidas is where your attention pays off right now. Its CPC has jumped ~50% this week while clicks stayed flat — you're paying more for the same traffic, and it's quietly eating ROAS. Trim the weakest keyword bids or pause them, then redeploy that budget to Nike where it's actually converting.",
  excel_company_spotify:
    "Spotify is having its best week — revenue surged well above its usual run-rate. Don't just celebrate it: figure out what drove the spike (a campaign, a day, a keyword) and see if it's repeatable before it regresses. Lock in the winner while it's hot.",
  excel_company_airbnb:
    "Airbnb is your steady whale — big, flat, dependable. The habit to break here is leaving it on autopilot. Even one structured test (a new audience, or a bid tweak on your top converters) could unlock growth from your largest account.",
};

const PORTFOLIO_ADVICE =
  "Across the portfolio the pattern is clear: you scale winners fast (Nike's a great example) but you're late on rising costs and light on CVR work. Your fastest win today is Adidas — its CPC is up ~50% with flat clicks, so trim those bids and move the budget to Nike where it converts. Then pick one account and run a real CVR/creative test — that's the lever you keep skipping.";

/**
 * Scripted coaching reply. Company-aware when a company is open; portfolio-level
 * otherwise. A "habits/how do I work" question gets the habit profile first.
 */
export function coachingReply(company: string | null, label: string | null, q: string): string {
  if (/habit|how do i work|what.*pattern|how am i (working|doing)/i.test(q)) {
    const tail = company && COMPANY_ADVICE[company] ? ` For ${label} specifically — ${COMPANY_ADVICE[company]}` : "";
    return `${HABIT_SUMMARY}${tail}`;
  }
  if (company && COMPANY_ADVICE[company]) return COMPANY_ADVICE[company];
  if (label)
    return `For ${label}: keep scaling what's converting, watch CPC creep before it eats your ROAS, and don't sleep on CVR — it's the lever you touch least.`;
  return PORTFOLIO_ADVICE;
}

/** Proactive persona greeting shown in AMPace's empty state. */
export function personaIntro(label: string | null): string {
  if (label)
    return `👋 I'm your AMPace advisor for ${label}. I've picked up on how you work — quick to scale when ROAS is strong, slower to catch CPC creep, light on CVR. Ask how to improve ${label}, where you're wasting spend, or what you'd do differently. Or ask for any chart, table, or KPI.`;
  return "👋 I'm your AMPace advisor. I've been watching how you run these accounts — you lead with ROAS and scale fast, but CPC creep and CVR are where money slips. Ask how to improve, where you're wasting spend, or what to do differently — or open a company and ask for any chart.";
}

export type HighlightTone = "up" | "down" | "info";
export interface Highlight {
  tone: HighlightTone;
  text: string;
}

/** The daily-briefing highlights — story-anchored, so they match the charts. */
export const BRIEFING_HIGHLIGHTS: Highlight[] = [
  { tone: "up", text: "Spotify is having its best week — revenue surged well above its usual run-rate." },
  { tone: "down", text: "Adidas needs a look — CPC has climbed ~50% while clicks stayed flat." },
  { tone: "up", text: "Nike keeps compounding — you've scaled it all week and ROAS is holding." },
];

/** The one suggested action in the daily briefing. */
export const BRIEFING_SUGGESTION =
  "Shift a slice of Adidas' budget to Nike, where it's actually converting — and give CVR the attention you usually skip.";

/** Time-of-day greeting for a 0–23 hour. */
export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
