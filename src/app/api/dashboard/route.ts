import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/guards";
import { dashboardQuerySchema, getDashboard } from "@/lib/dashboard";
import { handleRouteError } from "@/lib/api-error";

// UC-14: all widgets for ?month=YYYY-MM (default: the current month) in one response
export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireUser();
    const query = dashboardQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!query.success) return handleRouteError(query.error);
    return NextResponse.json(await getDashboard(userId, query.data.month));
  } catch (err) {
    return handleRouteError(err);
  }
}
