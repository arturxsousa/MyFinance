import { eq, sql } from "drizzle-orm";
import { appUser } from "../schema/users";
import type { UserTx } from "../with-user-db";

type AppUser = typeof appUser.$inferSelect;
type NewAppUser = typeof appUser.$inferInsert;

export const userRepo = {
  async findByEmail(tx: UserTx, email: string): Promise<AppUser | undefined> {
    const rows = await tx
      .select()
      .from(appUser)
      .where(eq(sql`lower(${appUser.email})`, email.toLowerCase()));
    return rows[0];
  },

  async findById(tx: UserTx, id: string): Promise<AppUser | undefined> {
    const rows = await tx.select().from(appUser).where(eq(appUser.id, id));
    return rows[0];
  },

  async create(tx: UserTx, data: NewAppUser): Promise<AppUser> {
    const rows = await tx.insert(appUser).values(data).returning();
    return rows[0]!;
  },

  async updateLastLogin(tx: UserTx, id: string, ip: string | null): Promise<void> {
    await tx
      .update(appUser)
      .set({
        lastLoginAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(appUser.id, id));
    void ip; // reserved for audit log
  },

  async incrementFailedLogin(tx: UserTx, id: string): Promise<void> {
    await tx
      .update(appUser)
      .set({
        failedLoginCount: sql`${appUser.failedLoginCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(appUser.id, id));
  },

  async lockAccount(tx: UserTx, id: string, until: Date): Promise<void> {
    await tx
      .update(appUser)
      .set({ lockedUntil: until, updatedAt: new Date() })
      .where(eq(appUser.id, id));
  },

  async activate(tx: UserTx, id: string): Promise<void> {
    await tx
      .update(appUser)
      .set({ status: "ACTIVE", emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(appUser.id, id));
  },

  async updatePassword(tx: UserTx, id: string, passwordHash: string): Promise<void> {
    await tx.update(appUser).set({ passwordHash, updatedAt: new Date() }).where(eq(appUser.id, id));
  },
};
