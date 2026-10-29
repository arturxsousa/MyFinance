// @vitest-environment node
// BR-06 category rules for entries, through withUserDb (RLS) against the real DB.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { withUserDb } from "@/db/with-user-db";
import { checkEntryCategory } from "@/lib/entry-category";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const USER_A = crypto.randomUUID();
const USER_B = crypto.randomUUID();
const ids = {} as Record<"systemFood" | "systemSalary" | "pets" | "archived" | "othersCat", string>;

beforeAll(async () => {
  await sql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at)
    VALUES
      (${USER_A}, 'Ec', 'A', ${`ec_a_${USER_A}@test.internal`}, 'x', 'USER', 'ACTIVE', now()),
      (${USER_B}, 'Ec', 'B', ${`ec_b_${USER_B}@test.internal`}, 'x', 'USER', 'ACTIVE', now())
  `;
  ids.systemFood = (await sql`SELECT id FROM category WHERE system_key = 'food'`)[0]!.id;
  ids.systemSalary = (await sql`SELECT id FROM category WHERE system_key = 'salary'`)[0]!.id;
  const [pets, archived, theirs] = await sql`
    INSERT INTO category (user_id, kind, name, is_active) VALUES
      (${USER_A}, 'EXPENSE', 'Pets', true),
      (${USER_A}, 'EXPENSE', 'Old', false),
      (${USER_B}, 'EXPENSE', 'B private', true)
    RETURNING id
  `;
  ids.pets = pets!.id;
  ids.archived = archived!.id;
  ids.othersCat = theirs!.id;
});

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id IN (${USER_A}, ${USER_B})`;
});

const check = (categoryId: string, kind: "INCOME" | "EXPENSE", current?: string) =>
  withUserDb(USER_A, (tx) => checkEntryCategory(tx, categoryId, kind, current));

describe("checkEntryCategory", () => {
  it("accepts a system category of the same kind", async () => {
    expect(await check(ids.systemFood, "EXPENSE")).toEqual({ ok: true });
  });

  it("accepts an own active category of the same kind", async () => {
    expect(await check(ids.pets, "EXPENSE")).toEqual({ ok: true });
  });

  it("rejects a category of another kind", async () => {
    expect(await check(ids.systemSalary, "EXPENSE")).toEqual({
      ok: false,
      error: "validation.categoryKind",
    });
  });

  it("rejects another user's category as not found (RLS)", async () => {
    expect(await check(ids.othersCat, "EXPENSE")).toEqual({
      ok: false,
      error: "validation.categoryNotFound",
    });
  });

  it("rejects a non-existent category", async () => {
    expect((await check(crypto.randomUUID(), "EXPENSE")).ok).toBe(false);
  });

  it("rejects switching to an archived category", async () => {
    expect(await check(ids.archived, "EXPENSE")).toEqual({
      ok: false,
      error: "validation.categoryArchived",
    });
  });

  it("lets an entry keep the archived category it already has", async () => {
    expect(await check(ids.archived, "EXPENSE", ids.archived)).toEqual({ ok: true });
  });
});

describe("database constraints (BR-02)", () => {
  it("rejects a zero or negative amount even if the API were bypassed", async () => {
    for (const amount of ["0", "-1"]) {
      await expect(
        sql`INSERT INTO income (user_id, category_id, amount, entry_date)
            VALUES (${USER_A}, ${ids.systemSalary}, ${amount}, CURRENT_DATE)`
      ).rejects.toThrow(/ck_income_amount_positive/);
    }
  });

  it("rejects an unknown payment method", async () => {
    await expect(
      sql`INSERT INTO expense (user_id, category_id, amount, entry_date, payment_method)
          VALUES (${USER_A}, ${ids.systemFood}, '1', CURRENT_DATE, 'BITCOIN')`
    ).rejects.toThrow(/pay_method/);
  });
});
