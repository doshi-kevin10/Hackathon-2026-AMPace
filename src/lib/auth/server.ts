import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import type { SessionUser } from "./config";

/** Current user from the session cookie, or null. For server components & route handlers. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** Guard for API route handlers: returns the user or a 401 response. */
export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  return user ?? NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } }, { status: 401 });
}
