import { NextRequest, NextResponse } from "next/server";
import { withUserDb } from "@/db/with-user-db";
import { recurrenceRepo } from "@/db/repositories/recurrences";
import { userRepo } from "@/db/repositories/users";
import { requireUser } from "@/lib/guards";
import { parseId } from "@/lib/ownership";
import { addDays, todayInTimeZone } from "@/lib/date";
import { toRecurrenceDto, updateRecurrenceSchema } from "@/lib/recurrences";
import { errorResponse, handleRouteError } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => errorResponse("NOT_FOUND", "Resource not found", 404);

// UC-13: pause / resume, edit amount, end. Affects entries generated from now
// on — the ones already created keep their values.
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await requireUser();
    const id = parseId((await params).id);

    const body = updateRecurrenceSchema.safeParse(await req.json());
    if (!body.success) return handleRouteError(body.error);

    const result = await withUserDb(userId, async (tx) => {
      // RLS: another user's recurrence is invisible → 404 (BR-01)
      const current = await recurrenceRepo.findById(tx, id);
      if (!current) return "NOT_FOUND" as const;
      if (body.data.endDate && body.data.endDate < current.startDate)
        return "END_BEFORE_START" as const;

      const today = todayInTimeZone((await userRepo.findById(tx, userId))?.timezone);
      const data: Parameters<typeof recurrenceRepo.update>[2] = { ...body.data };
      // Resuming doesn't back-fill the paused months: the generator only
      // catches up from here on (today's occurrence still counts).
      if (body.data.isActive && !current.isActive) {
        const yesterday = addDays(today, -1);
        if (!current.lastGeneratedOn || current.lastGeneratedOn < yesterday) {
          data.lastGeneratedOn = yesterday;
        }
      }
      const updated = await recurrenceRepo.update(tx, id, data);
      return updated ? toRecurrenceDto(updated, today) : ("NOT_FOUND" as const);
    });

    if (result === "NOT_FOUND") return notFound();
    if (result === "END_BEFORE_START") {
      return errorResponse("VALIDATION_ERROR", "End date is before the start date", 422, {
        endDate: ["validation.recurrenceEnd"],
      });
    }
    return NextResponse.json({ recurrence: result });
  } catch (err) {
    return handleRouteError(err);
  }
}

// Stops it for good; the entries it already created stay (unlinked).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await requireUser();
    const id = parseId((await params).id);
    const deleted = await withUserDb(userId, (tx) => recurrenceRepo.delete(tx, id));
    if (!deleted) return notFound();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
