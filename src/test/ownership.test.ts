// @vitest-environment node
//
// BR-01 through the real app path: withUserDb + repositories + requireOwned.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { sql as dsql } from "drizzle-orm";
import { withUserDb } from "@/db/with-user-db";
import { incomeRepo, categoryRepo, userRepo } from "@/db/repositories";
import { parseId, requireOwned } from "@/lib/ownership";
import { ApiError } from "@/lib/api-error";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);

const USER_A = crypto.randomUUID();
const USER_B = crypto.randomUUID();
let incomeA: string;
let systemCategoryId: string;

function statusOf(fn: () => unknown): number | undefined {
  try {
    fn();
  } catch (err) {
    if (err instanceof ApiError) return err.status;
    throw err;
  }
}

beforeAll(async () => {
  const [cat] = await sql`
    SELECT id FROM category WHERE user_id IS NULL AND kind = 'INCOME' LIMIT 1
  `;
  systemCategoryId = cat!.id;

  await sql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at)
    VALUES
      (${USER_A}, 'Own', 'A', ${`own_a_${USER_A}@test.internal`}, 'x', 'USER', 'ACTIVE', now()),
      (${USER_B}, 'Own', 'B', ${`own_b_${USER_B}@test.internal`}, 'x', 'USER', 'ACTIVE', now())
  `;
  const [row] = await sql`
    INSERT INTO income (user_id, category_id, amount, entry_date)
    VALUES (${USER_A}, ${systemCategoryId}, '100.00', CURRENT_DATE)
    RETURNING id
  `;
  incomeA = row!.id;
});

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id IN (${USER_A}, ${USER_B})`;
});

describe("withUserDb", () => {
  it("runs as the RLS-restricted role, not the owner", async () => {
    const role = await withUserDb(USER_A, async (tx) => {
      const res = await tx.execute(dsql`SELECT current_user AS role`);
      return res.rows[0]!.role;
    });
    expect(role).toBe("app_user_rw");
  });

  it("does not leak the role or user id outside the transaction", async () => {
    await withUserDb(USER_A, async () => undefined);
    const [row] = await sql`SELECT current_user AS role`;
    expect(row!.role).not.toBe("app_user_rw");
  });
});

describe("BR-01: user B cannot touch user A's data", () => {
  it("owner can read their own income", async () => {
    const row = await withUserDb(USER_A, (tx) => incomeRepo.findById(tx, incomeA));
    expect(requireOwned(row, USER_A).id).toBe(incomeA);
  });

  it("B reading A's income gets 404", async () => {
    const row = await withUserDb(USER_B, (tx) => incomeRepo.findById(tx, incomeA));
    expect(row).toBeUndefined();
    expect(statusOf(() => requireOwned(row, USER_B))).toBe(404);
  });

  it("B's monthly list does not include A's income", async () => {
    const now = new Date();
    const rows = await withUserDb(USER_B, (tx) =>
      incomeRepo.listByMonth(tx, now.getFullYear(), now.getMonth() + 1)
    );
    expect(rows.find((r) => r.id === incomeA)).toBeUndefined();
  });

  it("B cannot update or delete A's income", async () => {
    const updated = await withUserDb(USER_B, (tx) =>
      incomeRepo.update(tx, incomeA, { amount: "1.00" })
    );
    const deleted = await withUserDb(USER_B, (tx) => incomeRepo.softDelete(tx, incomeA));
    expect(updated).toBeUndefined();
    expect(deleted).toBe(false);

    const [row] = await sql`SELECT amount, deleted_at FROM income WHERE id = ${incomeA}`;
    expect(row!.amount).toBe("100.00");
    expect(row!.deleted_at).toBeNull();
  });

  it("B cannot create an income on A's behalf", async () => {
    await expect(
      withUserDb(USER_B, (tx) =>
        incomeRepo.create(tx, {
          userId: USER_A,
          categoryId: systemCategoryId,
          amount: "5.00",
          entryDate: "2026-01-01",
        })
      )
    ).rejects.toThrow();
  });

  it("B cannot read A's user row", async () => {
    const row = await withUserDb(USER_B, (tx) => userRepo.findById(tx, USER_A));
    expect(row).toBeUndefined();
  });

  it("system categories stay visible to every user", async () => {
    const cat = await withUserDb(USER_B, (tx) => categoryRepo.findById(tx, systemCategoryId));
    expect(cat?.id).toBe(systemCategoryId);
  });
});

describe("requireOwned", () => {
  it("404s on a row owned by someone else even if it was returned", () => {
    // e.g. a query that ran outside withUserDb
    expect(statusOf(() => requireOwned({ userId: USER_A }, USER_B))).toBe(404);
  });

  it("404s on system rows (userId null) — they are not the caller's", () => {
    expect(statusOf(() => requireOwned({ userId: null }, USER_B))).toBe(404);
  });
});

describe("parseId", () => {
  it("accepts a UUID", () => {
    expect(parseId(incomeA)).toBe(incomeA);
  });

  it.each(["", "123", "not-a-uuid", "'; DROP TABLE income; --", undefined])(
    "404s on malformed id %s",
    (id) => {
      expect(statusOf(() => parseId(id))).toBe(404);
    }
  );
});
