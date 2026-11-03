import { NextResponse } from "next/server";
import { withUserDb } from "@/db/with-user-db";
import { recurrenceRepo } from "@/db/repositories/recurrences";
import { userRepo } from "@/db/repositories/users";
import { requireUser } from "@/lib/guards";
import { todayInTimeZone } from "@/lib/date";
import { toRecurrenceDto } from "@/lib/recurrences";
import { handleRouteError } from "@/lib/api-error";

// UC-13 — the caller's recurrences, paused and ended included. They are
// created from the entry form ("Repeat monthly", POST /{kind}).
export async function GET() {
  try {
    const { userId } = await requireUser();
    const { rows, timezone } = await withUserDb(userId, async (tx) => ({
      rows: await recurrenceRepo.list(tx),
      timezone: (await userRepo.findById(tx, userId))?.timezone,
    }));
    const today = todayInTimeZone(timezone);
    return NextResponse.json({ recurrences: rows.map((r) => toRecurrenceDto(r, today)) });
  } catch (err) {
    return handleRouteError(err);
  }
}
