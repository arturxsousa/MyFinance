import { sql } from "drizzle-orm";
import { db } from "./client";

// The transaction-scoped db type (what callers receive inside the callback)
export type UserTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` inside a transaction as the RLS-restricted `app_user_rw` role with
 * `app.user_id` set to `userId`, so every query only sees the caller's rows.
 *
 * The connection itself is `neondb_owner`, which bypasses RLS — without the
 * role switch the policies would not apply at all.
 */
export async function withUserDb<T>(userId: string, fn: (tx: UserTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    // Both are transaction-scoped (is_local = true) and reset on commit.
    // set_config('role', …, true) is SET LOCAL ROLE; one statement saves a round trip.
    await tx.execute(
      sql`SELECT set_config('role', 'app_user_rw', true), set_config('app.user_id', ${userId}, true)`
    );
    return fn(tx);
  });
}
