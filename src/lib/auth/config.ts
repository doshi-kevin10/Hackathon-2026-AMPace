/**
 * DEV-ONLY authentication.
 *
 * Demo users live here in config (no database in this build). Passwords are
 * plaintext demo credentials — this is a development login only and MUST NOT
 * be used in production. Swap for Auth.js/Clerk + a real user store before any
 * real deployment.
 */

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "ANALYST" | "VIEWER";

export interface SessionUser {
  email: string;
  name: string;
  role: UserRole;
}

interface DevUser extends SessionUser {
  password: string;
}

export const DEV_USERS: DevUser[] = [
  { email: "superadmin@ampulse.dev", name: "Super Admin", role: "SUPER_ADMIN", password: "ampulse" },
  { email: "analyst@ampulse.dev", name: "Ana Analyst", role: "ANALYST", password: "ampulse" },
  { email: "viewer@ampulse.dev", name: "Val Viewer", role: "VIEWER", password: "ampulse" },
];

export const toSessionUser = (u: DevUser): SessionUser => ({
  email: u.email,
  name: u.name,
  role: u.role,
});
