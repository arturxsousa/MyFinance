import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { db } from "@/db/client";
import { userRepo } from "@/db/repositories/users";
import { authTokenRepo } from "@/db/repositories/auth-tokens";
import { refreshTokenRepo } from "@/db/repositories/refresh-tokens";
import { passwordSchema } from "@/lib/password";
import { hashToken } from "@/lib/auth";
import { clearSessionCookies } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { errorResponse, handleRouteError } from "@/lib/api-error";

const bodySchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.safeParse(await req.json());
    if (!body.success) return handleRouteError(body.error);

    const { token, password } = body.data;
    const ip = req.headers.get("x-forwarded-for") ?? null;
    const tokenHash = hashToken(token);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const ok = await db.transaction(async (tx) => {
      const record = await authTokenRepo.findActive(tx, tokenHash, "RESET_PASSWORD");
      if (!record) return false;

      await authTokenRepo.markUsed(tx, record.id);
      await userRepo.updatePassword(tx, record.userId, passwordHash);
      await refreshTokenRepo.revokeAllForUser(tx, record.userId);
      await writeAuditLog({ tx, actorId: record.userId, action: "PASSWORD_RESET", ip });
      return true;
    });

    if (!ok) return errorResponse("INVALID_TOKEN", "Link is invalid or has expired", 400);

    await clearSessionCookies();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
