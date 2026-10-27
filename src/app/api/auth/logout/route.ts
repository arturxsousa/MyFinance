import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { refreshTokenRepo } from "@/db/repositories/refresh-tokens";
import { hashToken } from "@/lib/auth";
import { clearSessionCookies, getSessionCookies } from "@/lib/session";
import { handleRouteError } from "@/lib/api-error";

export async function POST() {
  try {
    const { refreshToken } = await getSessionCookies();

    if (refreshToken) {
      const hash = hashToken(refreshToken);
      await db.transaction(async (tx) => {
        const token = await refreshTokenRepo.findActiveByHash(tx, hash);
        if (token) await refreshTokenRepo.revoke(tx, token.id);
      });
    }

    await clearSessionCookies();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
