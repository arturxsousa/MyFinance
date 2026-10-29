import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { db } from "@/db/client";
import { userRepo } from "@/db/repositories/users";
import { refreshTokenRepo } from "@/db/repositories/refresh-tokens";
import { signAccessToken, generateToken } from "@/lib/auth";
import { setSessionCookies, setLocaleCookie } from "@/lib/session";
import { isLocale } from "@/i18n/config";
import { writeAuditLog } from "@/lib/audit";
import { errorResponse, handleRouteError } from "@/lib/api-error";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.safeParse(await req.json());
    if (!body.success) return handleRouteError(body.error);

    const { email, password } = body.data;
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const result = await db.transaction(async (tx) => {
      // findByEmail bypasses RLS because we're connecting as neondb_owner here.
      // The login route is intentionally owner-scoped — RLS is for authenticated app queries.
      const user = await userRepo.findByEmail(tx, email);

      if (!user) return { code: "INVALID_CREDENTIALS" as const };

      if (user.status !== "ACTIVE") return { code: "ACCOUNT_INACTIVE" as const };

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return { code: "ACCOUNT_LOCKED" as const, lockedUntil: user.lockedUntil };
      }

      const valid = await argon2.verify(user.passwordHash, password);
      if (!valid) {
        const nextCount = user.failedLoginCount + 1;
        await userRepo.incrementFailedLogin(tx, user.id);
        await writeAuditLog({ tx, actorId: user.id, action: "LOGIN_FAILED", ip });
        if (nextCount >= MAX_FAILED) {
          const until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
          await userRepo.lockAccount(tx, user.id, until);
          return { code: "ACCOUNT_LOCKED" as const, lockedUntil: until };
        }
        return { code: "INVALID_CREDENTIALS" as const };
      }

      await userRepo.updateLastLogin(tx, user.id, ip);
      await writeAuditLog({ tx, actorId: user.id, action: "LOGIN", ip });

      const { raw, hash } = generateToken();
      await refreshTokenRepo.create(tx, {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent,
        ip: ip ?? undefined,
      });

      const accessToken = await signAccessToken({ sub: user.id, role: user.role });
      return { code: "OK" as const, accessToken, refreshToken: raw, user };
    });

    if (result.code === "INVALID_CREDENTIALS") {
      return errorResponse("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }
    if (result.code === "ACCOUNT_INACTIVE") {
      return errorResponse("ACCOUNT_INACTIVE", "Account is not active", 403);
    }
    if (result.code === "ACCOUNT_LOCKED") {
      return errorResponse("ACCOUNT_LOCKED", "Account is temporarily locked", 403);
    }

    await setSessionCookies(result.accessToken, result.refreshToken);
    if (isLocale(result.user.locale)) await setLocaleCookie(result.user.locale);

    return NextResponse.json({
      user: {
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
