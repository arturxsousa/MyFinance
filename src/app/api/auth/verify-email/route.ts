import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { authTokenRepo } from "@/db/repositories/auth-tokens";
import { userRepo } from "@/db/repositories/users";
import { hashToken } from "@/lib/auth";
import { errorResponse, handleRouteError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return errorResponse("INVALID_TOKEN", "Missing token", 400);

    const hash = hashToken(token);

    await db.transaction(async (tx) => {
      const record = await authTokenRepo.findActive(tx, hash, "VERIFY_EMAIL");
      if (!record) throw Object.assign(new Error("invalid"), { code: "INVALID_TOKEN" });

      await authTokenRepo.markUsed(tx, record.id);
      await userRepo.activate(tx, record.userId);
    });

    return NextResponse.redirect(new URL("/login?verified=1", req.url));
  } catch (err: unknown) {
    if (err instanceof Error && (err as { code?: string }).code === "INVALID_TOKEN") {
      return NextResponse.redirect(new URL("/login?verify_error=1", req.url));
    }
    return handleRouteError(err);
  }
}
