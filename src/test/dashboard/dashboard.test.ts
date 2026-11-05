// @vitest-environment node
// Phase 9 step 1 — dashboard aggregates (UC-14, BR-04, BR-05). The key check:
// the dashboard's totals equal the list pages' totals for the same month.
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));

import * as dashboard from "@/app/api/dashboard/route";
import * as incomes from "@/app/api/incomes/route";
import * as expenses from "@/app/api/expenses/route";
import * as investments from "@/app/api/investments/route";
import { signAccessToken } from "@/lib/auth";
import { balanceOf, percentChange, savingsRate } from "@/lib/dashboard";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const USER = crypto.randomUUID();
const OTHER = crypto.randomUUID();
const cat: Record<string, string> = {};

const EXPENSE_KEYS = [
  "housing",
  "food",
  "transport",
  "health",
  "education",
  "leisure",
  "bills",
  "shopping",
] as const;

async function at(iso: string, who = USER) {
  vi.setSystemTime(new Date(iso));
  jar.set("access_token", await signAccessToken({ sub: who, role: "USER" }));
}

async function get(month?: string) {
  const res = await dashboard.GET(
    new NextRequest(`http://localhost:3000/api/dashboard${month ? `?month=${month}` : ""}`)
  );
  return { status: res.status, body: await res.json() };
}

const listTotal = async (route: typeof incomes, slug: string, month: string) =>
  (
    await (
      await route.GET(new NextRequest(`http://localhost:3000/api/${slug}?month=${month}`))
    ).json()
  ).total as string;

type Row = { date: string; amount: string; cat: string; desc?: string; deleted?: boolean };

async function add(table: "income" | "expense" | "investment", rows: Row[], user = USER) {
  for (const r of rows) {
    const deletedAt = r.deleted ? new Date().toISOString() : null;
    if (table === "income") {
      await sql`INSERT INTO income (user_id, category_id, amount, entry_date, description, deleted_at)
                VALUES (${user}, ${cat[r.cat]}, ${r.amount}, ${r.date}, ${r.desc ?? null}, ${deletedAt})`;
    } else if (table === "expense") {
      await sql`INSERT INTO expense (user_id, category_id, amount, entry_date, description, deleted_at)
                VALUES (${user}, ${cat[r.cat]}, ${r.amount}, ${r.date}, ${r.desc ?? null}, ${deletedAt})`;
    } else {
      await sql`INSERT INTO investment (user_id, category_id, amount, entry_date, description, deleted_at)
                VALUES (${user}, ${cat[r.cat]}, ${r.amount}, ${r.date}, ${r.desc ?? null}, ${deletedAt})`;
    }
  }
}

beforeAll(async () => {
  for (const [id, tag] of [
    [USER, "u"],
    [OTHER, "o"],
  ]) {
    await sql`
      INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at)
      VALUES (${id}, 'Phase', 'Nine', ${`p9${tag}_${id}@test.internal`}, 'x', 'USER', 'ACTIVE', now())
    `;
  }
  for (const k of [...EXPENSE_KEYS, "salary", "freelance", "stocks"])
    cat[k] = (await sql`SELECT id FROM category WHERE system_key = ${k}`)[0]!.id;
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  for (const id of [USER, OTHER]) {
    for (const t of ["income", "expense", "investment"]) {
      await sql.query(`DELETE FROM ${t} WHERE user_id = $1`, [id]);
    }
    await sql`DELETE FROM recurrence WHERE user_id = ${id}`;
  }
  await at("2026-11-04T15:00:00Z"); // today = 2026-11-04 in São Paulo
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id IN (${USER}, ${OTHER})`;
});

// ── Pure helpers ─────────────────────────────────────────────────────────────

describe("percentChange / savingsRate / balanceOf", () => {
  it.each([
    ["150.00", "100.00", 50],
    ["50.00", "100.00", -50],
    ["100.00", "100.00", 0],
    ["100.00", "300.00", -66.7],
    ["0.00", "100.00", -100],
    ["50.00", "-100.00", 150], // balance going from −100 to +50
    ["-150.00", "-100.00", -50],
  ])("%s vs %s → %s %", (cur, prev, expected) => {
    expect(percentChange(cur, prev)).toBe(expected);
  });

  it("is null without a base to compare with", () => {
    expect(percentChange("100.00", "0.00")).toBeNull();
  });

  it("savings rate (BR-05) only when there are incomes", () => {
    expect(savingsRate("1000.00", "750.00")).toBe(25);
    expect(savingsRate("3000.00", "1000.00")).toBe(66.7);
    expect(savingsRate("1000.00", "1500.00")).toBe(-50);
    expect(savingsRate("0.00", "100.00")).toBeNull();
  });

  it("balance (BR-04) = incomes − expenses − investments, may be negative", () => {
    expect(balanceOf({ INCOME: "1000.00", EXPENSE: "600.10", INVESTMENT: "200.00" })).toBe(
      "199.90"
    );
    expect(balanceOf({ INCOME: "100.00", EXPENSE: "150.00", INVESTMENT: "0.00" })).toBe("-50.00");
  });
});

// ── GET /dashboard ───────────────────────────────────────────────────────────

describe("GET /dashboard (UC-14)", () => {
  it("requires a session and a valid month", async () => {
    expect((await get("2026-13")).status).toBe(422);
    jar.clear();
    expect((await get()).status).toBe(401);
  });

  it("a new user has no data → onboarding, all zeros", async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body).toMatchObject({ month: "2026-11", today: "2026-11-04", hasData: false });
    expect(body.summary.income).toEqual({ total: "0.00", change: null });
    expect(body.summary.savingsRate).toEqual({ rate: null, changePoints: null });
    expect(body.trend).toHaveLength(12);
    expect(body.topExpenses).toEqual([]);
  });

  it("summary totals equal the list pages' totals for the same month", async () => {
    await add("income", [
      { date: "2026-11-05", amount: "8500.00", cat: "salary" },
      { date: "2026-11-20", amount: "1200.50", cat: "freelance" }, // scheduled — still counts
      { date: "2026-11-10", amount: "999.00", cat: "salary", deleted: true }, // never counts
      { date: "2026-10-05", amount: "8000.00", cat: "salary" },
    ]);
    await add("expense", [
      { date: "2026-11-01", amount: "2500.00", cat: "housing" },
      { date: "2026-11-03", amount: "0.10", cat: "food" },
      { date: "2026-11-03", amount: "0.20", cat: "food" },
      { date: "2026-11-30", amount: "149.90", cat: "bills" },
      { date: "2026-12-01", amount: "77.00", cat: "food" }, // next month
      { date: "2026-10-31", amount: "3000.00", cat: "housing" },
    ]);
    await add("investment", [
      { date: "2026-11-06", amount: "1000.00", cat: "stocks" },
      { date: "2026-10-06", amount: "500.00", cat: "stocks" },
    ]);

    const { body } = await get("2026-11");
    expect(body.hasData).toBe(true);
    expect(body.summary.income.total).toBe(await listTotal(incomes, "incomes", "2026-11"));
    expect(body.summary.expense.total).toBe(await listTotal(expenses, "expenses", "2026-11"));
    expect(body.summary.investment.total).toBe(
      await listTotal(investments, "investments", "2026-11")
    );

    expect(body.summary).toEqual({
      income: { total: "9700.50", change: 21.3 }, // vs 8000
      expense: { total: "2650.20", change: -11.7 }, // vs 3000
      investment: { total: "1000.00", change: 100 }, // vs 500
      balance: { total: "6050.30", change: 34.5 }, // vs 8000 − 3000 − 500 = 4500
      savingsRate: { rate: 72.7, changePoints: 10.2 }, // 72.7 vs 62.5
    });
  });

  it("expenses by category: largest first, top 6 + Other", async () => {
    // eight categories with distinct totals: 800, 700, … 100
    await add(
      "expense",
      EXPENSE_KEYS.map((k, i) => ({ date: "2026-11-02", amount: `${(8 - i) * 100}.00`, cat: k }))
    );
    await add("expense", [{ date: "2026-11-02", amount: "50.00", cat: "shopping" }]);
    const { body } = await get("2026-11");
    expect(body.categories.total).toBe("3650.00");
    expect(body.categories.slices.map((s: { categoryId: string }) => s.categoryId)).toEqual(
      EXPENSE_KEYS.slice(0, 6).map((k) => cat[k])
    );
    expect(body.categories.slices[0]).toEqual({
      categoryId: cat.housing,
      total: "800.00",
      count: 1,
    });
    expect(body.categories.other).toEqual({ total: "350.00", count: 3, categories: 2 }); // 200 + 150
  });

  it("no Other slice with six categories or fewer", async () => {
    await add("expense", [{ date: "2026-11-02", amount: "10.00", cat: "food" }]);
    const { body } = await get("2026-11");
    expect(body.categories.slices).toHaveLength(1);
    expect(body.categories.other).toBeNull();
  });

  it("12-month trend ends at the selected month; empty months are zero; investments accumulate", async () => {
    await add("income", [
      { date: "2025-12-05", amount: "1000.00", cat: "salary" },
      { date: "2026-11-05", amount: "2000.00", cat: "salary" },
      { date: "2025-11-05", amount: "9999.00", cat: "salary" }, // 13 months back — outside
    ]);
    await add("expense", [{ date: "2026-06-15", amount: "300.00", cat: "food" }]);
    await add("investment", [
      { date: "2024-01-10", amount: "5000.00", cat: "stocks" }, // before the window
      { date: "2026-01-10", amount: "100.00", cat: "stocks" },
      { date: "2026-11-10", amount: "200.00", cat: "stocks" },
    ]);
    const { body } = await get("2026-11");
    const months = body.trend.map((t: { month: string }) => t.month);
    expect(months[0]).toBe("2025-12");
    expect(months.at(-1)).toBe("2026-11");
    const by = Object.fromEntries(body.trend.map((t: { month: string }) => [t.month, t]));
    expect(by["2025-12"]).toMatchObject({
      income: "1000.00",
      balance: "1000.00",
      investedToDate: "5000.00",
    });
    expect(by["2026-01"]).toMatchObject({
      investment: "100.00",
      investedToDate: "5100.00",
      balance: "-100.00",
    });
    expect(by["2026-06"]).toMatchObject({
      expense: "300.00",
      balance: "-300.00",
      investedToDate: "5100.00",
    });
    expect(by["2026-11"]).toMatchObject({
      income: "2000.00",
      investment: "200.00",
      balance: "1800.00",
      investedToDate: "5300.00",
    });
  });

  it("top 5 expenses of the month, largest first", async () => {
    await add(
      "expense",
      ["10", "500", "30", "250", "75", "1000", "5"].map((a, i) => ({
        date: `2026-11-0${i + 1}`,
        amount: `${a}.00`,
        cat: "food",
        desc: `e${a}`,
      }))
    );
    const { body } = await get("2026-11");
    expect(body.topExpenses.map((e: { amount: string }) => e.amount)).toEqual([
      "1000.00",
      "500.00",
      "250.00",
      "75.00",
      "30.00",
    ]);
  });

  it("upcoming: scheduled entries and recurrences still to come, next 30 days only", async () => {
    await add("expense", [
      { date: "2026-11-04", amount: "1.00", cat: "food", desc: "today" }, // not upcoming
      { date: "2026-11-05", amount: "2.00", cat: "food", desc: "tomorrow" },
      { date: "2026-12-04", amount: "3.00", cat: "food", desc: "day 30" },
      { date: "2026-12-05", amount: "4.00", cat: "food", desc: "day 31" }, // too far
      { date: "2026-11-20", amount: "5.00", cat: "food", desc: "deleted", deleted: true },
    ]);
    // Rent on the 10th, generated through October → Nov 10 is projected
    await sql`INSERT INTO recurrence (user_id, kind, category_id, description, amount, day_of_month,
                                      start_date, last_generated_on)
              VALUES (${USER}, 'EXPENSE', ${cat.housing}, 'Rent', '2500.00', 10, '2026-01-10', '2026-10-10')`;
    // Salary on the 1st: Dec 1 is in the window
    await sql`INSERT INTO recurrence (user_id, kind, category_id, description, amount, day_of_month,
                                      start_date, last_generated_on)
              VALUES (${USER}, 'INCOME', ${cat.salary}, 'Salary', '8500.00', 1, '2026-01-01', '2026-11-01')`;

    const { body } = await get("2026-06"); // the window is relative to today, not the month viewed
    expect(
      body.upcoming.map((u: { description: string; entryDate: string; source: string }) => [
        u.description,
        u.entryDate,
        u.source,
      ])
    ).toEqual([
      ["tomorrow", "2026-11-05", "scheduled"],
      ["Rent", "2026-11-10", "projected"],
      ["Salary", "2026-12-01", "projected"],
      ["day 30", "2026-12-04", "scheduled"],
    ]);
  });

  it("only the caller's data (RLS)", async () => {
    await add("income", [{ date: "2026-11-05", amount: "123.00", cat: "salary" }], OTHER);
    const { body } = await get("2026-11");
    expect(body.hasData).toBe(false);
    expect(body.summary.income.total).toBe("0.00");
  });
});
