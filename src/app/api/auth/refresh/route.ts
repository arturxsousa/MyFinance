import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/refresh-session";
import { setSessionCookies, clearSessionCookies, getSessionCookies } from "@/lib/session";
import { errorResponse, handleRouteError } from "@/lib/api-error";

export async function POST() {
  try {
    const { refreshToken } = await getSessionCookies();
    if (!refreshToken) return errorResponse("UNAUTHORIZED", "No refresh token", 401);

    const result = await refreshSession(refreshToken);

    if (!result.ok) {
      await clearSessionCookies();
      return errorResponse("UNAUTHORIZED", "Session expired. Please log in again.", 401);
    }

    await setSessionCookies(result.accessToken, result.refreshToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
