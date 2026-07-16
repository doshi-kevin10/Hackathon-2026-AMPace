import { scryptSync, timingSafeEqual } from "node:crypto";
import { DEV_USERS, toSessionUser, type SessionUser } from "./config";

// Node-only (uses node:crypto). Never import this from middleware/edge code.

const DEV_SALT = "ampulse-dev-salt";

/** Constant-time password check against the dev user list. */
export function verifyCredentials(email: string, password: string): SessionUser | null {
  const user = DEV_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return null;
  const a = scryptSync(password, DEV_SALT, 32);
  const b = scryptSync(user.password, DEV_SALT, 32);
  return timingSafeEqual(a, b) ? toSessionUser(user) : null;
}
