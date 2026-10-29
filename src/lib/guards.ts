import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db/client";
import { userRepo } from "@/db/repositories/users";
import { verifyAccessToken } from "@/lib/auth";
import { getSessionCookies } from "@/lib/session";
import { ApiError } from "@/lib/api-error";

export interface Session {
  userId: string;
  role: "USER" | "ADMIN";
}

/** Session from the access-token cookie, or null. Deduplicated per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const { accessToken } = await getSessionCookies();
  const payload = accessToken ? await verifyAccessToken(accessToken) : null;
  return payload ? { userId: payload.sub, role: payload.role } : null;
});

// The JWT role can be up to 15 min stale, so Admin access is re-checked
// against the DB — a demotion or deactivation takes effect immediately.
const isActiveAdmin = cache(async (userId: string): Promise<boolean> => {
  const user = await db.transaction((tx) => userRepo.findById(tx, userId));
  return user?.role === "ADMIN" && user.status === "ACTIVE";
});

// ── Route handlers: throw ApiError, rendered by handleRouteError ─────────────

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!(await isActiveAdmin(session.userId))) {
    throw new ApiError("FORBIDDEN", "Admin access required", 403);
  }
  return session;
}

// ── Pages / server components: redirect or 404 ───────────────────────────────

export async function requireUserPage(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Non-admins get a 404 so the admin area's existence isn't revealed. */
export async function requireAdminPage(): Promise<Session> {
  const session = await requireUserPage();
  if (!(await isActiveAdmin(session.userId))) notFound();
  return session;
}
