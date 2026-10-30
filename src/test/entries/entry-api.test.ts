// @vitest-environment node
// /{kind} API (UC-07 to UC-10) against the real DB; `next/headers` cookies mocked.
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
import * as incomeRestore from "@/app/api/incomes/[id]/restore/route";
import * as incomeDuplicate from "@/app/api/incomes/[id]/duplicate/route";
import * as expenseDuplicate from "@/app/api/expenses/[id]/duplicate/route";
import * as expenses from "@/app/api/expenses/route";
import * as expenseItem from "@/app/api/expenses/[id]/route";
import * as investments from "@/app/api/investments/route";
import { signAccessToken } from "@/lib/auth";
import { currentYearMonth, todayInTimeZone } from "@/lib/date";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const USER_A = crypto.randomUUID();
const USER_B = crypto.randomUUID();
const MONTH = "2031-03"; // far from real data and from "today"
const cat = {} as Record<
  "salary" | "bonus" | "food" | "housing" | "stocks" | "archived" | "bOwn",
  string
>;

const as = async (userId: string) =>
  jar.set("access_token", await signAccessToken({ sub: userId, role: "USER" }));

const json = (method: string, url: string, body?: unknown) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function call(res: Promise<Response> | Response) {
  const r = await res;
  return { status: r.status, body: await r.json() };
}

const list = (query = "") => call(incomes.GET(json("GET", `/api/incomes?${query}`)));
const createIncome = (body: Record<string, unknown>) =>
  call(
    incomes.POST(
      json("POST", "/api/incomes", { categoryId: cat.salary, entryDate: `${MONTH}-10`, ...body })
    )
  );

beforeAll(async () => {
  await sql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at, timezone)
    VALUES
      (${USER_A}, 'Api', 'A', ${`api_a_${USER_A}@test.internal`}, 'x', 'USER', 'ACTIVE', now(), 'America/Sao_Paulo'),
      (${USER_B}, 'Api', 'B', ${`api_b_${USER_B}@test.internal`}, 'x', 'USER', 'ACTIVE', now(), 'America/Sao_Paulo')
  `;
  for (const key of ["salary", "bonus", "food", "housing", "stocks"] as const) {
    cat[key] = (await sql`SELECT id FROM category WHERE system_key = ${key}`)[0]!.id;
  }
  const [archived, bOwn] = await sql`
    INSERT INTO category (user_id, kind, name, is_active) VALUES
      (${USER_A}, 'INCOME', 'Old job', false),
      (${USER_B}, 'INCOME', 'B private', true)
    RETURNING id
  `;
  cat.archived = archived!.id;
  cat.bOwn = bOwn!.id;
});

beforeEach(async () => {
  jar.clear();
  await as(USER_A);
  await sql`DELETE FROM income WHERE user_id IN (${USER_A}, ${USER_B})`;
  await sql`DELETE FROM expense WHERE user_id IN (${USER_A}, ${USER_B})`;
  await sql`DELETE FROM investment WHERE user_id IN (${USER_A}, ${USER_B})`;
});

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id IN (${USER_A}, ${USER_B})`;
});

// ── Create ───────────────────────────────────────────────────────────────────

describe("POST /{kind}", () => {
  it("creates an income with a normalised amount", async () => {
    const { status, body } = await createIncome({ amount: "5000", description: " Salary " });
    expect(status).toBe(201);
    expect(body.entry).toMatchObject({
      kind: "INCOME",
      categoryId: cat.salary,
      amount: "5000.00",
      entryDate: `${MONTH}-10`,
      description: "Salary",
      notes: null,
      isScheduled: true, // 2031 is in the future
    });
    expect(body.entry).not.toHaveProperty("paymentMethod");
  });

  it("creates an expense with a payment method and an investment with an institution", async () => {
    const exp = await call(
      expenses.POST(
        json("POST", "/api/expenses", {
          categoryId: cat.food,
          amount: 42.9,
          entryDate: `${MONTH}-02`,
          paymentMethod: "PIX",
        })
      )
    );
    expect(exp.body.entry).toMatchObject({ amount: "42.90", paymentMethod: "PIX" });

    const inv = await call(
      investments.POST(
        json("POST", "/api/investments", {
          categoryId: cat.stocks,
          amount: "1000",
          entryDate: `${MONTH}-03`,
          institution: "XP",
        })
      )
    );
    expect(inv.body.entry).toMatchObject({ amount: "1000.00", institution: "XP" });
  });

  it.each([
    ["a category of another kind", () => cat.food, "validation.categoryKind"],
    ["another user's category", () => cat.bOwn, "validation.categoryNotFound"],
    ["an archived category", () => cat.archived, "validation.categoryArchived"],
  ])("rejects %s (BR-06)", async (_label, categoryId, error) => {
    const { status, body } = await createIncome({ amount: "1", categoryId: categoryId() });
    expect(status).toBe(422);
    expect(body.error.fields.categoryId).toEqual([error]);
  });

  it("returns field errors as i18n keys", async () => {
    const { status, body } = await createIncome({ amount: "0", entryDate: "2031-02-30" });
    expect(status).toBe(422);
    expect(body.error.fields.amount).toEqual(["validation.amountPositive"]);
    expect(body.error.fields.entryDate).toEqual(["validation.date"]);
  });

  it("requires authentication", async () => {
    jar.clear();
    expect((await createIncome({ amount: "1" })).status).toBe(401);
  });
});

// ── List ─────────────────────────────────────────────────────────────────────

describe("GET /{kind}", () => {
  async function seed(
    rows: {
      amount: string;
      date: string;
      description?: string;
      notes?: string;
      cat?: string;
      user?: string;
      deleted?: boolean;
    }[]
  ) {
    for (const r of rows) {
      await sql`
        INSERT INTO income (user_id, category_id, amount, entry_date, description, notes, deleted_at)
        VALUES (${r.user ?? USER_A}, ${r.cat ?? cat.salary}, ${r.amount}, ${r.date},
                ${r.description ?? null}, ${r.notes ?? null}, ${r.deleted ? new Date() : null})
      `;
    }
  }

  it("includes the first and last day of the month and nothing outside it (BR-03)", async () => {
    await seed([
      { amount: "1", date: "2031-02-28" },
      { amount: "2", date: "2031-03-01" },
      { amount: "3", date: "2031-03-31" },
      { amount: "4", date: "2031-04-01" },
    ]);
    const { body } = await list(`month=${MONTH}`);
    expect(body.entries.map((e: { entryDate: string }) => e.entryDate)).toEqual([
      "2031-03-31",
      "2031-03-01",
    ]);
    expect(body.total).toBe("5.00");
    expect(body.month).toBe(MONTH);
  });

  it("defaults to the current month in the user's timezone", async () => {
    const today = todayInTimeZone("America/Sao_Paulo");
    await seed([{ amount: "7", date: today }]);
    const { body } = await list();
    expect(body.month).toBe(currentYearMonth("America/Sao_Paulo"));
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].isScheduled).toBe(false); // today is not "scheduled"
  });

  it("excludes soft-deleted rows from the list and the total", async () => {
    await seed([
      { amount: "10", date: `${MONTH}-05` },
      { amount: "99", date: `${MONTH}-06`, deleted: true },
    ]);
    const { body } = await list(`month=${MONTH}`);
    expect(body.entries).toHaveLength(1);
    expect(body.total).toBe("10.00");
    expect(body.totalCount).toBe(1);
  });

  it("never includes another user's entries", async () => {
    await seed([{ amount: "500", date: `${MONTH}-05`, user: USER_B, cat: cat.bOwn }]);
    const { body } = await list(`month=${MONTH}`);
    expect(body.entries).toHaveLength(0);
    expect(body.total).toBe("0.00");
  });

  it("sums cents exactly (no float drift)", async () => {
    await seed([
      { amount: "0.10", date: `${MONTH}-01` },
      { amount: "0.20", date: `${MONTH}-02` },
      { amount: "999999999.99", date: `${MONTH}-03` },
    ]);
    expect((await list(`month=${MONTH}`)).body.total).toBe("1000000000.29");
  });

  it("filters by category and the total follows the filter", async () => {
    await seed([
      { amount: "100", date: `${MONTH}-05`, cat: cat.salary },
      { amount: "30", date: `${MONTH}-06`, cat: cat.bonus },
    ]);
    const { body } = await list(`month=${MONTH}&category=${cat.bonus}`);
    expect(body.entries).toHaveLength(1);
    expect(body.total).toBe("30.00");
  });

  it("searches description and notes, case-insensitively, with wildcards literal", async () => {
    await seed([
      { amount: "1", date: `${MONTH}-01`, description: "Freelance ACME" },
      { amount: "2", date: `${MONTH}-02`, notes: "paid via acme portal" },
      { amount: "3", date: `${MONTH}-03`, description: "100% bonus" },
      { amount: "4", date: `${MONTH}-04`, description: "1000 bonus" },
    ]);
    expect((await list(`month=${MONTH}&q=acme`)).body.totalCount).toBe(2);
    const pct = await list(`month=${MONTH}&q=${encodeURIComponent("100%")}`);
    expect(pct.body.entries.map((e: { description: string }) => e.description)).toEqual([
      "100% bonus",
    ]);
  });

  it("sorts by date or amount", async () => {
    await seed([
      { amount: "30", date: `${MONTH}-01` },
      { amount: "10", date: `${MONTH}-03` },
      { amount: "20", date: `${MONTH}-02` },
    ]);
    const amounts = async (sort: string) =>
      (await list(`month=${MONTH}&sort=${sort}`)).body.entries.map(
        (e: { amount: string }) => e.amount
      );
    expect(await amounts("date_desc")).toEqual(["10.00", "20.00", "30.00"]);
    expect(await amounts("date_asc")).toEqual(["30.00", "20.00", "10.00"]);
    expect(await amounts("amount_desc")).toEqual(["30.00", "20.00", "10.00"]);
    expect(await amounts("amount_asc")).toEqual(["10.00", "20.00", "30.00"]);
  });

  it("paginates by 20 with stable ordering", async () => {
    await sql`
      INSERT INTO income (user_id, category_id, amount, entry_date)
      SELECT ${USER_A}, ${cat.salary}, 1, ${`${MONTH}-15`}::date FROM generate_series(1, 45)
    `;
    const p1 = (await list(`month=${MONTH}&page=1`)).body;
    const p3 = (await list(`month=${MONTH}&page=3`)).body;
    expect(p1).toMatchObject({
      page: 1,
      pageSize: 20,
      totalCount: 45,
      totalPages: 3,
      total: "45.00",
    });
    expect(p1.entries).toHaveLength(20);
    expect(p3.entries).toHaveLength(5);

    const ids = new Set<string>();
    for (const page of [1, 2, 3]) {
      for (const e of (await list(`month=${MONTH}&page=${page}`)).body.entries) ids.add(e.id);
    }
    expect(ids.size).toBe(45); // no row repeated or skipped across pages
  });

  it("returns month stats that follow the same filters", async () => {
    await seed([
      { amount: "100", date: "2031-02-10", description: "Feb salary" },
      { amount: "40", date: "2031-02-11", cat: cat.bonus },
      { amount: "150", date: `${MONTH}-05`, description: "Big one" },
      { amount: "50", date: `${MONTH}-06` },
      { amount: "999", date: `${MONTH}-07`, deleted: true },
    ]);
    const { stats } = (await list(`month=${MONTH}`)).body;
    expect(stats).toMatchObject({
      previousMonth: "2031-02",
      previousTotal: "140.00",
      previousCount: 2,
    });
    expect(stats.largest).toMatchObject({ amount: "150.00", description: "Big one" });
    // 2031 is entirely in the future, so the whole month is scheduled
    expect(stats).toMatchObject({ scheduledTotal: "200.00", scheduledCount: 2 });

    const filtered = (await list(`month=${MONTH}&category=${cat.bonus}`)).body.stats;
    expect(filtered).toMatchObject({ previousTotal: "40.00", largest: null, scheduledCount: 0 });
  });

  it("counts as scheduled only the entries after today", async () => {
    const today = todayInTimeZone("America/Sao_Paulo");
    const month = today.slice(0, 7);
    await seed([{ amount: "10", date: today }]);
    const { stats } = (await list(`month=${month}`)).body;
    expect(stats.scheduledCount).toBe(0);
  });

  it("rejects a bad query with 422", async () => {
    expect((await list("month=2031-13")).status).toBe(422);
    expect((await list("sort=random")).status).toBe(422);
  });
});

// ── Read / update / delete / restore ─────────────────────────────────────────

describe("/{kind}/{id}", () => {
  async function own(body: Record<string, unknown> = {}) {
    return (await createIncome({ amount: "100", ...body })).body.entry as { id: string };
  }
  const get = (id: string) => call(incomeItem.GET(json("GET", `/api/incomes/${id}`), ctx(id)));
  const put = (id: string, body: unknown) =>
    call(incomeItem.PUT(json("PUT", `/api/incomes/${id}`, body), ctx(id)));
  const del = (id: string) =>
    call(incomeItem.DELETE(json("DELETE", `/api/incomes/${id}`), ctx(id)));
  const restore = (id: string) =>
    call(incomeRestore.POST(json("POST", `/api/incomes/${id}/restore`), ctx(id)));

  it("reads an own entry", async () => {
    const e = await own();
    expect((await get(e.id)).body.entry.id).toBe(e.id);
  });

  it("another user's entry is 404 on every operation (BR-01)", async () => {
    await as(USER_B);
    const theirs = (await createIncome({ amount: "1", categoryId: cat.bOwn })).body.entry;
    await as(USER_A);
    expect((await get(theirs.id)).status).toBe(404);
    expect((await put(theirs.id, { amount: "2" })).status).toBe(404);
    expect((await del(theirs.id)).status).toBe(404);
    expect((await restore(theirs.id)).status).toBe(404);
  });

  it("a malformed id is a 404", async () => {
    expect((await get("nope")).status).toBe(404);
  });

  it("updates only the fields sent", async () => {
    const e = await own({ description: "Keep me" });
    const { body } = await put(e.id, { amount: "250.5" });
    expect(body.entry).toMatchObject({ amount: "250.50", description: "Keep me" });
  });

  it("keeps an expense's payment method when updating something else", async () => {
    const exp = (
      await call(
        expenses.POST(
          json("POST", "/api/expenses", {
            categoryId: cat.food,
            amount: "10",
            entryDate: `${MONTH}-01`,
            paymentMethod: "CASH",
          })
        )
      )
    ).body.entry;
    const updated = await call(
      expenseItem.PUT(json("PUT", `/api/expenses/${exp.id}`, { amount: "11" }), ctx(exp.id))
    );
    expect(updated.body.entry.paymentMethod).toBe("CASH");
  });

  it("rejects switching to a category of another kind", async () => {
    const e = await own();
    const { status, body } = await put(e.id, { categoryId: cat.food });
    expect(status).toBe(422);
    expect(body.error.fields.categoryId).toEqual(["validation.categoryKind"]);
  });

  it("an entry keeps its category after that category is archived (BR-06)", async () => {
    const [mine] = await sql`
      INSERT INTO category (user_id, kind, name) VALUES (${USER_A}, 'INCOME', ${`Temp ${crypto.randomUUID()}`})
      RETURNING id
    `;
    const e = await own({ categoryId: mine!.id });
    await sql`UPDATE category SET is_active = false WHERE id = ${mine!.id}`;
    // Editing other fields still works, and resending the same category is fine
    expect((await put(e.id, { amount: "5", categoryId: mine!.id })).status).toBe(200);
  });

  it("soft-deletes: gone from the API, still in the table, and restorable", async () => {
    const e = await own();
    expect((await del(e.id)).body).toEqual({ ok: true });
    expect((await get(e.id)).status).toBe(404);
    expect((await del(e.id)).status).toBe(404);

    const [row] = await sql`SELECT deleted_at FROM income WHERE id = ${e.id}`;
    expect(row!.deleted_at).not.toBeNull();

    const restored = await restore(e.id);
    expect(restored.status).toBe(200);
    expect((await get(e.id)).status).toBe(200);
  });

  it("restoring an entry that isn't deleted is a 409", async () => {
    const e = await own();
    expect((await restore(e.id)).status).toBe(409);
  });

  it("an updated deleted entry is a 404", async () => {
    const e = await own();
    await del(e.id);
    expect((await put(e.id, { amount: "1" })).status).toBe(404);
  });
});

// ── Duplicate (UC-11) ────────────────────────────────────────────────────────

describe("POST /{kind}/{id}/duplicate", () => {
  const dup = (id: string, body: unknown) =>
    call(incomeDuplicate.POST(json("POST", `/api/incomes/${id}/duplicate`, body), ctx(id)));

  it("copies the entry to the chosen date as a new, independent entry", async () => {
    const src = (await createIncome({ amount: "321.09", description: "Freela", notes: "Client X" }))
      .body.entry;
    const { status, body } = await dup(src.id, { entryDate: "2031-04-15" });
    expect(status).toBe(201);
    expect(body.entry).toMatchObject({
      categoryId: cat.salary,
      amount: "321.09",
      entryDate: "2031-04-15",
      description: "Freela",
      notes: "Client X",
      recurrenceId: null,
    });
    expect(body.entry.id).not.toBe(src.id);
    // The original is untouched
    const [orig] =
      await sql`SELECT entry_date::text AS entry_date FROM income WHERE id = ${src.id}`;
    expect(orig!.entry_date).toBe(`${MONTH}-10`);
  });

  it("copies the payment method of an expense", async () => {
    const src = (
      await call(
        expenses.POST(
          json("POST", "/api/expenses", {
            categoryId: cat.food,
            amount: "15",
            entryDate: `${MONTH}-02`,
            paymentMethod: "CASH",
          })
        )
      )
    ).body.entry;
    const { body } = await call(
      expenseDuplicate.POST(
        json("POST", `/api/expenses/${src.id}/duplicate`, { entryDate: `${MONTH}-20` }),
        ctx(src.id)
      )
    );
    expect(body.entry).toMatchObject({ paymentMethod: "CASH", amount: "15.00" });
  });

  it("refuses when the category was archived since (BR-06: no new entries)", async () => {
    const [mine] = await sql`
      INSERT INTO category (user_id, kind, name) VALUES (${USER_A}, 'INCOME', ${`Dup ${crypto.randomUUID()}`})
      RETURNING id
    `;
    const src = (await createIncome({ amount: "5", categoryId: mine!.id })).body.entry;
    await sql`UPDATE category SET is_active = false WHERE id = ${mine!.id}`;
    const { status, body } = await dup(src.id, { entryDate: `${MONTH}-20` });
    expect(status).toBe(422);
    expect(body.error.fields.categoryId).toEqual(["validation.categoryArchived"]);
  });

  it("only takes a valid date", async () => {
    const src = (await createIncome({ amount: "5" })).body.entry;
    expect((await dup(src.id, { entryDate: "2031-02-30" })).status).toBe(422);
    expect((await dup(src.id, { entryDate: `${MONTH}-20`, amount: "999" })).status).toBe(422);
  });

  it("another user's entry, a deleted one, or a bad id is a 404", async () => {
    await as(USER_B);
    const theirs = (await createIncome({ amount: "1", categoryId: cat.bOwn })).body.entry;
    await as(USER_A);
    expect((await dup(theirs.id, { entryDate: `${MONTH}-20` })).status).toBe(404);

    const mine = (await createIncome({ amount: "1" })).body.entry;
    await call(incomeItem.DELETE(json("DELETE", `/api/incomes/${mine.id}`), ctx(mine.id)));
    expect((await dup(mine.id, { entryDate: `${MONTH}-20` })).status).toBe(404);

    expect((await dup("nope", { entryDate: `${MONTH}-20` })).status).toBe(404);
  });
});
