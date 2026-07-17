import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { fetchCompanyNews } from "@/lib/news/google-news";

export const runtime = "nodejs";

/** Latest company news for the News drawer — keyless Google News RSS, best-effort (returns [] on failure). */
export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const company = new URL(req.url).searchParams.get("company")?.trim();
  if (!company) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "company is required" } }, { status: 400 });
  }

  const items = await fetchCompanyNews(company, 30);
  return NextResponse.json({ items });
}
