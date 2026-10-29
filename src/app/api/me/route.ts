import { NextRequest, NextResponse } from "next/server";
import { withUserDb } from "@/db/with-user-db";
import { userRepo } from "@/db/repositories/users";
import { requireUser } from "@/lib/guards";
import { profileSchema } from "@/lib/preferences";
import { toProfile } from "@/lib/profile";
import { setLocaleCookie } from "@/lib/session";
import { errorResponse, handleRouteError } from "@/lib/api-error";

export async function GET() {
  try {
    const { userId } = await requireUser();
    const user = await withUserDb(userId, (tx) => userRepo.findById(tx, userId));
    if (!user) return errorResponse("NOT_FOUND", "User not found", 404);
    return NextResponse.json({ user: toProfile(user) });
  } catch (err) {
    return handleRouteError(err);
  }
}

// UC-16 — name, currency, locale, timezone. E-mail change is a separate flow.
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await requireUser();

    const body = profileSchema.safeParse(await req.json());
    if (!body.success) return handleRouteError(body.error);

    const user = await withUserDb(userId, (tx) => userRepo.updateProfile(tx, userId, body.data));
    if (!user) return errorResponse("NOT_FOUND", "User not found", 404);
    await setLocaleCookie(user.locale); // switch the UI language right away
    return NextResponse.json({ user: toProfile(user) });
  } catch (err) {
    return handleRouteError(err);
  }
}
