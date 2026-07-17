import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { getNotifications } from "@/lib/notifications/service";

export const runtime = "nodejs";

/** Cross-company notification watchtower (deterministic). Auth-guarded. */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    return NextResponse.json({ notifications: await getNotifications() });
  } catch {
    return NextResponse.json({ notifications: [] });
  }
}
