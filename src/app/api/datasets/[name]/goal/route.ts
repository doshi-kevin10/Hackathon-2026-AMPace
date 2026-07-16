import { NextResponse } from "next/server";
import { getGoal, setGoal } from "@/lib/goals/goal-store";
import { requireUser } from "@/lib/auth/server";
import { isValidDatasetName } from "@/lib/databricks/analytics";
import { GoalResponseSchema, GoalSchema } from "@/lib/schemas/goal";

export const runtime = "nodejs";

/** Read the ROAS/CPA goal for one dataset (null if not yet set). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { name } = await params;
  if (!isValidDatasetName(name)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown dataset" } }, { status: 404 });
  }

  const goal = await getGoal(name);
  return NextResponse.json(GoalResponseSchema.parse({ goal }));
}

/** Set (or replace) the ROAS/CPA goal for one dataset. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { name } = await params;
  if (!isValidDatasetName(name)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown dataset" } }, { status: 404 });
  }

  const body = GoalSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: { code: "INVALID_GOAL", message: body.error.issues.map((i) => i.message).join("; ") } },
      { status: 400 }
    );
  }

  await setGoal(name, body.data);
  return NextResponse.json(GoalResponseSchema.parse({ goal: body.data }));
}
