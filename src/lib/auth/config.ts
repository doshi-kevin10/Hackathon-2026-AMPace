/**
 * DEV-ONLY authentication.
 *
 * Demo users live here in config (no database in this build). Passwords are
 * plaintext demo credentials — this is a development login only and MUST NOT
 * be used in production. Swap for Auth.js/Clerk + a real user store before any
 * real deployment.
 */

export const USER_ROLES = ["SUPER_ADMIN", "ADMIN", "ANALYST", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface SessionUser {
  email: string;
  name: string;
  role: UserRole;
}

interface DevUser extends SessionUser {
  password: string;
}

export const DEV_USERS: DevUser[] = [
  { email: "superadmin@ampace.dev", name: "Kevin Doshi", role: "SUPER_ADMIN", password: "ampace" },
  { email: "analyst@ampace.dev", name: "Ana Analyst", role: "ANALYST", password: "ampace" },
  { email: "viewer@ampace.dev", name: "Val Viewer", role: "VIEWER", password: "ampace" },
];

export const toSessionUser = (u: DevUser): SessionUser => ({
  email: u.email,
  name: u.name,
  role: u.role,
});
