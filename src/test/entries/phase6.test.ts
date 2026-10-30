// @vitest-environment node
//
// Phase 6 step 8 — fills the gaps left by the per-step tests:
// 1. every route file of every kind is wired to the right kind
// 2. BR-03 month boundaries through the API at midnight in America/Sao_Paulo
// 3. soft-deleted rows excluded from every figure of the month summary
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
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
import * as expenses from "@/app/api/expenses/route";
import * as expenseItem from "@/app/api/expenses/[id]/route";
import * as expenseRestore from "@/app/api/expenses/[id]/restore/route";
import * as expenseDuplicate from "@/app/api/expenses/[id]/duplicate/route";
import * as investments from "@/app/api/investments/route";
import * as investmentItem from "@/app/api/investments/[id]/route";
import * as investmentRestore from "@/app/api/investments/[id]/restore/route";
import * as investmentDuplicate from "@/app/api/investments/[id]/duplicate/route";
import { signAccessToken } from "@/lib/auth";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const USER_SP = crypto.randomUUID(); // America/Sao_Paulo
const USER_TOKYO = crypto.randomUUID(); // Asia/Tokyo
const cat: Record<string, string> = {};

const req = (method: string, url: string, body?: unknown) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const call = async (r: Promise<Response> | Response) => {
  const res = await r;
  return { status: res.status, body: await res.json() };
};
const loginAs = async (userId: string) =>
  jar.set("access_token", await signAccessToken({ sub: userId, role: "USER" }));

beforeAll(async () => {
  await sql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at, timezone)
    VALUES
      (${USER_SP}, 'P6', 'SP', ${`p6_sp_${USER_SP}@test.internal`}, 'x', 'USER', 'ACTIVE', now(), 'America/Sao_Paulo'),
      (${USER_TOKYO}, 'P6', 'Tokyo', ${`p6_tk_${USER_TOKYO}@test.internal`}, 'x', 'USER', 'ACTIVE', now(), 'Asia/Tokyo')
  `;
  for (const key of ["salary", "food", "stocks"]) {
    cat[key] = (await sql`SELECT id FROM category WHERE system_key = ${key}`)[0]!.id;
  }
});

beforeEach(async () => {
  jar.clear();
  await loginAs(USER_SP);
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id IN (${USER_SP}, ${USER_TOKYO})`;
});

// ── 1. Every kind, every route ───────────────────────────────────────────────

const KINDS = [
  {
    slug: "incomes",
    kind: "INCOME",
    routes: [incomes, incomeItem, incomeRestore, incomeDuplicate],
    body: () => ({ categoryId: cat.salary }),
  },
  {
    slug: "expenses",
    kind: "EXPENSE",
    routes: [expenses, expenseItem, expenseRestore, expenseDuplicate],
    body: () => ({ categoryId: cat.food, paymentMethod: "DEBIT" }),
  },
  {
    slug: "investments",
    kind: "INVESTMENT",
    routes: [investments, investmentItem, investmentRestore, investmentDuplicate],
    body: () => ({ categoryId: cat.stocks, institution: "XP" }),
  },
] as const;

describe.each(KINDS)("/api/$slug — full lifecycle", ({ slug, kind, routes, body }) => {
  const [collection, item, restore, duplicate] = routes;

  it(`create → list → read → update → duplicate → delete → restore, all as ${kind}`, async () => {
    const base = `/api/${slug}`;
    const created = await call(
      collection.POST(req("POST", base, { ...body(), amount: "10", entryDate: "2032-05-10" }))
    );
    expect(created.status).toBe(201);
    const id = created.body.entry.id;
    expect(created.body.entry.kind).toBe(kind);

    const listed = await call(collection.GET(req("GET", `${base}?month=2032-05`)));
    expect(listed.body.entries.map((e: { id: string }) => e.id)).toContain(id);

    expect((await call(item.GET(req("GET", `${base}/${id}`), ctx(id)))).body.entry.kind).toBe(kind);
    expect(
      (await call(item.PUT(req("PUT", `${base}/${id}`, { amount: "11" }), ctx(id)))).body.entry
        .amount
    ).toBe("11.00");

    const copy = await call(
      duplicate.POST(req("POST", `${base}/${id}/duplicate`, { entryDate: "2032-06-01" }), ctx(id))
    );
    expect(copy.status).toBe(201);
    expect(copy.body.entry.kind).toBe(kind);

    expect((await call(item.DELETE(req("DELETE", `${base}/${id}`), ctx(id)))).status).toBe(200);
    expect((await call(restore.POST(req("POST", `${base}/${id}/restore`), ctx(id)))).status).toBe(
      200
    );
  });

  it("rejects a category of another kind (each route knows its own kind)", async () => {
    const wrong = kind === "INCOME" ? cat.food : cat.salary;
    const res = await call(
      collection.POST(
        req("POST", `/api/${slug}`, {
          ...body(),
          categoryId: wrong,
          amount: "1",
          entryDate: "2032-05-10",
        })
      )
    );
    expect(res.status).toBe(422);
    expect(res.body.error.fields.categoryId).toEqual(["validation.categoryKind"]);
  });
});

// ── 2. BR-03 month boundaries through the API ────────────────────────────────

describe("BR-03 — the month at midnight, in the user's timezone", () => {
  // 02:30 UTC on Nov 1st = 23:30 Oct 31st in São Paulo = 11:30 Nov 1st in Tokyo
  const LATE_OCT_31_SP = new Date("2026-11-01T02:30:00Z");

  beforeEach(async () => {
    await sql`DELETE FROM income WHERE user_id IN (${USER_SP}, ${USER_TOKYO})`;
    for (const user of [USER_SP, USER_TOKYO]) {
      await sql`
        INSERT INTO income (user_id, category_id, amount, entry_date, description)
        VALUES (${user}, ${cat.salary}, '100', '2026-10-31', 'Oct 31'),
               (${user}, ${cat.salary}, '200', '2026-11-01', 'Nov 1')
      `;
    }
  });

  async function defaultMonth(user: string) {
    vi.useFakeTimers({ toFake: ["Date"] }); // only the clock: DB I/O keeps running
    vi.setSystemTime(LATE_OCT_31_SP);
    await loginAs(user);
    return (await call(incomes.GET(req("GET", "/api/incomes")))).body;
  }

  it("São Paulo at 23:30 on Oct 31 still sees October; Nov 1st is scheduled", async () => {
    const body = await defaultMonth(USER_SP);
    expect(body.month).toBe("2026-10");
    expect(body.entries.map((e: { description: string }) => e.description)).toEqual(["Oct 31"]);
    expect(body.entries[0].isScheduled).toBe(false);

    const nov = (await call(incomes.GET(req("GET", "/api/incomes?month=2026-11")))).body;
    expect(nov.entries[0].isScheduled).toBe(true); // tomorrow, on the user's clock
  });

  it("the same instant in Tokyo is already November; Nov 1st is today", async () => {
    const body = await defaultMonth(USER_TOKYO);
    expect(body.month).toBe("2026-11");
    expect(body.entries.map((e: { description: string }) => e.description)).toEqual(["Nov 1"]);
    expect(body.entries[0].isScheduled).toBe(false);
  });

  it("an entry dated the 31st never leaks into the next month (no timezone shift on dates)", async () => {
    const nov = (await call(incomes.GET(req("GET", "/api/incomes?month=2026-11")))).body;
    expect(nov.entries.map((e: { description: string }) => e.description)).toEqual(["Nov 1"]);
    expect(nov.total).toBe("200.00");
  });
});

// ── 3. Soft-deleted rows excluded from every figure ──────────────────────────

describe("soft-deleted rows are excluded everywhere", () => {
  it("from the list, the total, the count and every summary figure", async () => {
    await sql`DELETE FROM expense WHERE user_id = ${USER_SP}`;
    await sql`
      INSERT INTO expense (user_id, category_id, amount, entry_date, description, deleted_at) VALUES
        (${USER_SP}, ${cat.food}, '10', '2032-08-05', 'kept', NULL),
        (${USER_SP}, ${cat.food}, '5000', '2032-08-06', 'deleted biggest', now()),
        (${USER_SP}, ${cat.food}, '7', '2032-07-05', 'kept prev', NULL),
        (${USER_SP}, ${cat.food}, '900', '2032-07-06', 'deleted prev', now())
    `;
    const body = (await call(expenses.GET(req("GET", "/api/expenses?month=2032-08")))).body;

    expect(body.entries.map((e: { description: string }) => e.description)).toEqual(["kept"]);
    expect(body.total).toBe("10.00");
    expect(body.totalCount).toBe(1);
    expect(body.stats.largest.description).toBe("kept");
    expect(body.stats.previousTotal).toBe("7.00");
    expect(body.stats.previousCount).toBe(1);
    expect(body.stats.scheduledTotal).toBe("10.00"); // 2032: all future, deleted one not counted
  });

  it("a deleted entry can't be read, edited or duplicated until restored", async () => {
    const e = (
      await call(
        expenses.POST(
          req("POST", "/api/expenses", {
            categoryId: cat.food,
            amount: "3",
            entryDate: "2032-08-01",
          })
        )
      )
    ).body.entry;
    await call(expenseItem.DELETE(req("DELETE", `/api/expenses/${e.id}`), ctx(e.id)));

    expect(
      (await call(expenseItem.GET(req("GET", `/api/expenses/${e.id}`), ctx(e.id)))).status
    ).toBe(404);
    expect(
      (await call(expenseItem.PUT(req("PUT", `/api/expenses/${e.id}`, { amount: "4" }), ctx(e.id))))
        .status
    ).toBe(404);
    expect(
      (
        await call(
          expenseDuplicate.POST(
            req("POST", `/api/expenses/${e.id}/duplicate`, { entryDate: "2032-08-02" }),
            ctx(e.id)
          )
        )
      ).status
    ).toBe(404);

    await call(expenseRestore.POST(req("POST", `/api/expenses/${e.id}/restore`), ctx(e.id)));
    expect(
      (await call(expenseItem.GET(req("GET", `/api/expenses/${e.id}`), ctx(e.id)))).status
    ).toBe(200);
  });
});
