import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { userRepo } from "@/db/repositories/users";
import { refreshTokenRepo } from "@/db/repositories/refresh-tokens";
import { signAccessToken, generateToken, hashToken } from "@/lib/auth";
import { setSessionCookies, getSessionCookies } from "@/lib/session";
import { errorResponse, handleRouteError } from "@/lib/api-error";

export async function POST() {
  try {
    const { refreshToken } = await getSessionCookies();
    if (!refreshToken) return errorResponse("UNAUTHORIZED", "No refresh token", 401);

    const hash = hashToken(refreshToken);

    const result = await db.transaction(async (tx) => {
      const token = await refreshTokenRepo.findActiveByHash(tx, hash);
      if (!token) return { code: "INVALID_TOKEN" as const };

      const user = await userRepo.findById(tx, token.userId);
      if (!user || user.status !== "ACTIVE") return { code: "INVALID_TOKEN" as const };

      // Rotate: revoke old token, issue new one
      await refreshTokenRepo.revoke(tx, token.id);
      const { raw, hash: newHash } = generateToken();
      await refreshTokenRepo.create(tx, {
        userId: user.id,
        tokenHash: newHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: token.userAgent ?? undefined,
        ip: token.ip ?? undefined,
      });

      const accessToken = await signAccessToken({ sub: user.id, role: user.role });
      return { code: "OK" as const, accessToken, refreshToken: raw };
    });

    if (result.code === "INVALID_TOKEN") {
      return errorResponse("UNAUTHORIZED", "Invalid or expired refresh token", 401);
    }

    await setSessionCookies(result.accessToken, result.refreshToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
