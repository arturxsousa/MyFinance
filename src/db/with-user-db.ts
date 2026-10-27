import { sql } from "drizzle-orm";
import { db } from "./client";

// The transaction-scoped db type (what callers receive inside the callback)
export type UserTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` inside a transaction with `app.user_id` set to `userId`.
 * RLS policies use this setting to restrict every query to the calling user's rows.
 * All statements are batched into a single Neon HTTP request.
 */
export async function withUserDb<T>(userId: string, fn: (tx: UserTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    // set_config with is_local=true is equivalent to SET LOCAL — scoped to this transaction
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}
