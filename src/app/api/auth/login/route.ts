import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { verifyCredentials } from "@/lib/auth/credentials";

export const runtime = "nodejs";

const BodySchema = z.object({ email: z.string().min(1), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Email and password required" } }, { status: 400 });
  }

  const user = verifyCredentials(body.data.email, body.data.password);
  if (!user) {
    return NextResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "Incorrect email or password" } }, { status: 401 });
  }

  const token = await createSessionToken(user);
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
