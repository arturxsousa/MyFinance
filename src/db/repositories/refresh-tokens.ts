import { and, eq, gt, isNull } from "drizzle-orm";
import { refreshToken } from "../schema/users";
import type { UserTx } from "../with-user-db";

type RefreshToken = typeof refreshToken.$inferSelect;
type NewRefreshToken = typeof refreshToken.$inferInsert;

export const refreshTokenRepo = {
  async create(tx: UserTx, data: NewRefreshToken): Promise<RefreshToken> {
    const rows = await tx.insert(refreshToken).values(data).returning();
    return rows[0]!;
  },

  /** Locks the row so concurrent refreshes of the same token run one at a time. */
  async findByHashForUpdate(tx: UserTx, hash: string): Promise<RefreshToken | undefined> {
    const rows = await tx
      .select()
      .from(refreshToken)
      .where(eq(refreshToken.tokenHash, hash))
      .for("update");
    return rows[0];
  },

  async findActiveById(tx: UserTx, id: string): Promise<RefreshToken | undefined> {
    const rows = await tx
      .select()
      .from(refreshToken)
      .where(
        and(
          eq(refreshToken.id, id),
          isNull(refreshToken.revokedAt),
          gt(refreshToken.expiresAt, new Date())
        )
      );
    return rows[0];
  },

  async findActiveByHash(tx: UserTx, hash: string): Promise<RefreshToken | undefined> {
    const rows = await tx
      .select()
      .from(refreshToken)
      .where(
        and(
          eq(refreshToken.tokenHash, hash),
          isNull(refreshToken.revokedAt),
          gt(refreshToken.expiresAt, new Date())
        )
      );
    return rows[0];
  },

  async revoke(tx: UserTx, id: string, replacedById?: string): Promise<void> {
    await tx
      .update(refreshToken)
      .set({ revokedAt: new Date(), replacedById: replacedById ?? null })
      .where(eq(refreshToken.id, id));
  },

  async revokeAllForUser(tx: UserTx, userId: string): Promise<void> {
    await tx
      .update(refreshToken)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshToken.userId, userId), isNull(refreshToken.revokedAt)));
  },
};
