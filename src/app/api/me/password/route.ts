import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { withUserDb } from "@/db/with-user-db";
import { userRepo } from "@/db/repositories/users";
import { refreshTokenRepo } from "@/db/repositories/refresh-tokens";
import { requireUser } from "@/lib/guards";
import { passwordSchema } from "@/lib/password";
import { hashToken } from "@/lib/auth";
import { getSessionCookies } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { errorResponse, handleRouteError } from "@/lib/api-error";

const bodySchema = z.object({
  currentPassword: z.string().min(1, "validation.required"),
  newPassword: passwordSchema,
});

// UC-06 — requires the current password; BR-08 policy on the new one.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireUser();

    const body = bodySchema.safeParse(await req.json());
    if (!body.success) return handleRouteError(body.error);

    const { currentPassword, newPassword } = body.data;
    const ip = req.headers.get("x-forwarded-for") ?? null;
    const { refreshToken } = await getSessionCookies();

    const result = await withUserDb(userId, async (tx) => {
      const user = await userRepo.findById(tx, userId);
      if (!user) return "NOT_FOUND";

      if (!(await argon2.verify(user.passwordHash, currentPassword))) return "WRONG_PASSWORD";
      if (await argon2.verify(user.passwordHash, newPassword)) return "SAME_PASSWORD";

      const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
      await userRepo.updatePassword(tx, user.id, newHash);
      // Log out every other device; this one stays signed in
      await refreshTokenRepo.revokeAllForUser(
        tx,
        user.id,
        refreshToken ? hashToken(refreshToken) : undefined
      );
      await writeAuditLog({ tx, actorId: user.id, action: "PASSWORD_CHANGE", ip });
      return "OK";
    });

    if (result === "WRONG_PASSWORD")
      return errorResponse("WRONG_PASSWORD", "Current password is incorrect", 400, {
        currentPassword: ["password.wrongCurrent"],
      });
    if (result === "SAME_PASSWORD")
      return errorResponse("SAME_PASSWORD", "New password must differ from current", 400, {
        newPassword: ["password.sameAsCurrent"],
      });
    if (result === "NOT_FOUND") return errorResponse("NOT_FOUND", "User not found", 404);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
