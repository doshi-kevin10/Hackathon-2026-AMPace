import { SignJWT, jwtVerify } from "jose";
import { USER_ROLES, type SessionUser } from "./config";

// Edge-safe: this module is imported by middleware, so it must NOT pull in
// node:crypto. Password verification lives in ./credentials (node-only).

export const SESSION_COOKIE = "ampulse_session";
const MAX_AGE_SEC = 8 * 60 * 60; // 8h

// Fail closed: a missing secret in production is a hard error (otherwise a known
// fallback would let anyone forge sessions). Dev keeps a fallback with a warning.
const rawSecret = process.env.AUTH_SECRET;
if (!rawSecret && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET must be set in production");
}
if (!rawSecret) {
  console.warn("[auth] AUTH_SECRET is not set — using an insecure dev fallback. Do not use in production.");
}
const SECRET = new TextEncoder().encode(rawSecret ?? "ampulse-dev-insecure-secret-change-me");

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
    // Validate claims at this trust boundary — never trust the role blindly.
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") return null;
    if (!(USER_ROLES as readonly string[]).includes(payload.role)) return null;
    return {
      email: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "",
      role: payload.role as SessionUser["role"],
    };
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
