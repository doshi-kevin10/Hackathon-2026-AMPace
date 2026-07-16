import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "./config";

// Edge-safe: this module is imported by middleware, so it must NOT pull in
// node:crypto. Password verification lives in ./credentials (node-only).

export const SESSION_COOKIE = "ampulse_session";
const MAX_AGE_SEC = 8 * 60 * 60; // 8h

// Dev fallback lets the app run out-of-the-box; set AUTH_SECRET in any real use.
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "ampulse-dev-insecure-secret-change-me"
);

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.email)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(SECRET);
}

/** Verify a session JWT. Edge- and node-safe (used by middleware and route handlers). */
export async function verifySessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.sub || !payload.role) return null;
    return { email: payload.sub, name: String(payload.name ?? ""), role: payload.role as SessionUser["role"] };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SEC,
};
