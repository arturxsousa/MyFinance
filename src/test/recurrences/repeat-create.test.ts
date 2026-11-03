// @vitest-environment node
// Phase 7 step 1 — "Repeat monthly" when creating an entry (UC-07, BR-07).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));

import * as incomes from "@/app/api/incomes/route";
import * as incomeItem from "@/app/api/incomes/[id]/route";
import * as expenses from "@/app/api/expenses/route";
import * as investments from "@/app/api/investments/route";
import { signAccessToken } from "@/lib/auth";
import { createEntrySchemas, updateEntrySchemas } from "@/lib/entries";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const USER = crypto.randomUUID();
const cat: Record<string, string> = {};

const post = (route: typeof incomes, slug: string, body: unknown) =>
  route
    .POST(
      new NextRequest(`http://localhost:3000/api/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    )
    .then(async (r) => ({ status: r.status, body: await r.json() }));

const recurrencesOf = () =>
  sql`SELECT kind, category_id, description, amount::text, payment_method, institution,
             day_of_month, start_date::text, end_date::text, last_generated_on::text, is_active
      FROM recurrence WHERE user_id = ${USER} ORDER BY created_at`;

beforeAll(async () => {
  await sql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at)
    VALUES (${USER}, 'Rec', 'One', ${`rec1_${USER}@test.internal`}, 'x', 'USER', 'ACTIVE', now())
  `;
  for (const key of ["salary", "housing", "stocks"]) {
    cat[key] = (await sql`SELECT id FROM category WHERE system_key = ${key}`)[0]!.id;
  }
});

beforeEach(async () => {
  jar.clear();
  jar.set("access_token", await signAccessToken({ sub: USER, role: "USER" }));
  await sql`DELETE FROM income WHERE user_id = ${USER}`;
  await sql`DELETE FROM expense WHERE user_id = ${USER}`;
  await sql`DELETE FROM investment WHERE user_id = ${USER}`;
  await sql`DELETE FROM recurrence WHERE user_id = ${USER}`;
});

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id = ${USER}`;
});

describe("schema", () => {
  const valid = {
    categoryId: cat.salary ?? crypto.randomUUID(),
    amount: "1",
    entryDate: "2026-10-05",
  };

  it("accepts repeat with or without an end date", () => {
    expect(createEntrySchemas.INCOME.parse({ ...valid, repeat: {} }).repeat).toEqual({
      endDate: null,
    });
    expect(
      createEntrySchemas.INCOME.parse({ ...valid, repeat: { endDate: "2027-10-05" } }).repeat
    ).toEqual({ endDate: "2027-10-05" });
  });

  it.each(["2026-10-29", "2026-10-30", "2026-10-31"])(
    "rejects repeating from day %s (BR-07)",
    (entryDate) => {
      const r = createEntrySchemas.INCOME.safeParse({ ...valid, entryDate, repeat: {} });
      expect(r.error?.issues).toEqual([
        expect.objectContaining({ path: ["repeat"], message: "validation.repeatDay" }),
      ]);
    }
  );

  it("accepts day 28", () => {
    expect(
      createEntrySchemas.INCOME.safeParse({ ...valid, entryDate: "2026-02-28", repeat: {} }).success
    ).toBe(true);
  });

  it("rejects an end date before the entry date", () => {
    const r = createEntrySchemas.INCOME.safeParse({ ...valid, repeat: { endDate: "2026-10-04" } });
    expect(r.error?.issues[0]).toMatchObject({
      path: ["repeat", "endDate"],
      message: "validation.repeatEnd",
    });
  });

  it("updates can't set repeat", () => {
    expect(updateEntrySchemas.INCOME.safeParse({ repeat: {} }).success).toBe(false);
  });
});

describe("POST /{kind} with repeat", () => {
  it("creates the entry and its recurrence together, linked", async () => {
    const { status, body } = await post(incomes, "incomes", {
      categoryId: cat.salary,
      amount: "8500",
      entryDate: "2026-10-05",
      description: "Salário",
      repeat: { endDate: "2027-12-31" },
    });
    expect(status).toBe(201);
    expect(body.entry.recurrenceId).toEqual(expect.any(String));

    const [rec] = await recurrencesOf();
    expect(rec).toMatchObject({
      kind: "INCOME",
      category_id: cat.salary,
      description: "Salário",
      amount: "8500.00",
      day_of_month: 5,
      start_date: "2026-10-05",
      end_date: "2027-12-31",
      // The first entry exists already: the generator starts next month
      last_generated_on: "2026-10-05",
      is_active: true,
    });
  });

  it("keeps the expense payment method and the investment institution on the recurrence", async () => {
    await post(expenses as never, "expenses", {
      categoryId: cat.housing,
      amount: "2200",
      entryDate: "2026-10-01",
      paymentMethod: "TRANSFER",
      repeat: {},
    });
    await post(investments as never, "investments", {
      categoryId: cat.stocks,
      amount: "500",
      entryDate: "2026-10-10",
      institution: "XP",
      repeat: {},
    });
    const [rent, invest] = await recurrencesOf();
    expect(rent).toMatchObject({
      kind: "EXPENSE",
      payment_method: "TRANSFER",
      institution: null,
      end_date: null,
    });
    expect(invest).toMatchObject({ kind: "INVESTMENT", payment_method: null, institution: "XP" });
  });

  it("without repeat, no recurrence is created", async () => {
    const { body } = await post(incomes, "incomes", {
      categoryId: cat.salary,
      amount: "1",
      entryDate: "2026-10-05",
    });
    expect(body.entry.recurrenceId).toBeNull();
    expect(await recurrencesOf()).toHaveLength(0);
  });

  it("is atomic: an invalid entry creates no recurrence", async () => {
    const bad = await post(incomes, "incomes", {
      categoryId: cat.housing /* wrong kind */,
      amount: "1",
      entryDate: "2026-10-05",
      repeat: {},
    });
    expect(bad.status).toBe(422);
    expect(await recurrencesOf()).toHaveLength(0);
  });

  it("day 31 is a 422 on the repeat field and creates nothing", async () => {
    const { status, body } = await post(incomes, "incomes", {
      categoryId: cat.salary,
      amount: "1",
      entryDate: "2026-10-31",
      repeat: {},
    });
    expect(status).toBe(422);
    expect(body.error.fields.repeat).toEqual(["validation.repeatDay"]);
    expect(await recurrencesOf()).toHaveLength(0);
  });

  it("editing a recurring entry can't change its recurrence link", async () => {
    const { body } = await post(incomes, "incomes", {
      categoryId: cat.salary,
      amount: "1",
      entryDate: "2026-10-05",
      repeat: {},
    });
    const id = body.entry.id;
    const res = await incomeItem.PUT(
      new NextRequest(`http://localhost:3000/api/incomes/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recurrenceId: null }),
      }),
      { params: Promise.resolve({ id }) }
    );
    expect(res.status).toBe(422);
  });
});
