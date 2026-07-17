/**
 * Dataset ownership for alerts — "who owns this table". Config-driven to match
 * the app's no-DB, DEV_USERS-in-code grain. Seeded for the demo companies;
 * unmapped datasets fall back to `ALERTS_DEFAULT_OWNER`. A `slackId` turns the
 * owner into a real Slack @-mention (so the alert pings them), otherwise the
 * name is shown as plain text.
 */

export interface AlertOwner {
  name: string;
  email?: string;
  /** Slack member ID (e.g. "U012ABC"). When set, the owner is @-mentioned. */
  slackId?: string;
}

/** dataset name → owner. Extend as datasets get real owners. */
const OWNERS: Record<string, AlertOwner> = {
  excel_company_nike: { name: "Ana Analyst", email: "analyst@ampace.dev" },
  excel_company_adidas: { name: "Ana Analyst", email: "analyst@ampace.dev" },
  excel_company_spotify: { name: "Super Admin", email: "superadmin@ampace.dev" },
  excel_company_airbnb: { name: "Val Viewer", email: "viewer@ampace.dev" },
};

/** Parse `ALERTS_DEFAULT_OWNER` — either "Name" or "Name <email>". */
function defaultOwner(): AlertOwner {
  const raw = process.env.ALERTS_DEFAULT_OWNER?.trim();
  const slackId = process.env.ALERTS_DEFAULT_OWNER_SLACK_ID?.trim() || undefined;
  if (!raw) return { name: "AMPace Team", slackId };
  const m = raw.match(/^(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim(), email: m[2].trim(), slackId } : { name: raw, slackId };
}

/** The owner for a dataset, or the configured default if unassigned. */
export function ownerFor(dataset: string): AlertOwner {
  return OWNERS[dataset] ?? defaultOwner();
}

/** Slack-ready owner string: an @-mention when a Slack ID is known, else the name. */
export function ownerMention(owner: AlertOwner): string {
  return owner.slackId ? `<@${owner.slackId}>` : owner.name;
}
