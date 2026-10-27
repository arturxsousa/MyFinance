import { and, eq, gt, isNull } from "drizzle-orm";
import { authToken } from "../schema/users";
import type { UserTx } from "../with-user-db";

type AuthToken = typeof authToken.$inferSelect;

export const authTokenRepo = {
  async create(
    tx: UserTx,
    data: { userId: string; purpose: string; tokenHash: string; expiresAt: Date }
  ): Promise<AuthToken> {
    const rows = await tx.insert(authToken).values(data).returning();
    return rows[0]!;
  },

  async findActive(tx: UserTx, hash: string, purpose: string): Promise<AuthToken | undefined> {
    const rows = await tx
      .select()
      .from(authToken)
      .where(
        and(
          eq(authToken.tokenHash, hash),
          eq(authToken.purpose, purpose),
          isNull(authToken.usedAt),
          gt(authToken.expiresAt, new Date())
        )
      );
    return rows[0];
  },

  async markUsed(tx: UserTx, id: string): Promise<void> {
    await tx.update(authToken).set({ usedAt: new Date() }).where(eq(authToken.id, id));
  },
};
