import { ApiError } from "@/lib/api-error";

// BR-01: a resource that doesn't exist and one owned by someone else must be
// indistinguishable — both are 404, never 403.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(): never {
  throw new ApiError("NOT_FOUND", "Resource not found", 404);
}

/** Validates a route id param. A malformed id is a 404, not a DB error / 500. */
export function parseId(id: string | undefined | null): string {
  if (!id || !UUID_RE.test(id)) notFound();
  return id;
}

/**
 * Returns `row` if it exists and belongs to `userId`, otherwise throws 404.
 * Inside `withUserDb` RLS already hides other users' rows; this is the
 * API-layer half of BR-01 so ownership holds even if a query bypasses RLS.
 */
export function requireOwned<T extends { userId: string | null }>(
  row: T | null | undefined,
  userId: string
): T {
  if (!row || row.userId !== userId) notFound();
  return row;
}
