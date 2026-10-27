import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { db } from "@/db/client";
import { userRepo } from "@/db/repositories/users";
import { passwordSchema } from "@/lib/password";
import { verifyAccessToken } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { errorResponse, handleRouteError } from "@/lib/api-error";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("access_token")?.value;
    const payload = token ? await verifyAccessToken(token) : null;
    if (!payload) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const body = bodySchema.safeParse(await req.json());
    if (!body.success) return handleRouteError(body.error);

    const { currentPassword, newPassword } = body.data;
    const ip = req.headers.get("x-forwarded-for") ?? null;

    const result = await db.transaction(async (tx) => {
      const user = await userRepo.findById(tx, payload.sub);
      if (!user) return "NOT_FOUND";

      const valid = await argon2.verify(user.passwordHash, currentPassword);
      if (!valid) return "WRONG_PASSWORD";

      const same = await argon2.verify(user.passwordHash, newPassword);
      if (same) return "SAME_PASSWORD";

      const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
      await userRepo.updatePassword(tx, user.id, newHash);
      await writeAuditLog({ tx, actorId: user.id, action: "PASSWORD_CHANGE", ip });
      return "OK";
    });

    if (result === "WRONG_PASSWORD")
      return errorResponse("WRONG_PASSWORD", "Current password is incorrect", 400);
    if (result === "SAME_PASSWORD")
      return errorResponse("SAME_PASSWORD", "New password must differ from current", 400);
    if (result === "NOT_FOUND") return errorResponse("NOT_FOUND", "User not found", 404);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
