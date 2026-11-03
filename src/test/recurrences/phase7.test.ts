// @vitest-environment node
// Phase 7 step 6 — "done when": salary and rent appear automatically on their
// day for the new month, through the real path (entry form → cron → list).
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
import * as expenses from "@/app/api/expenses/route";
import * as cron from "@/app/api/cron/recurrences/route";
import { db } from "@/db/client";
import { signAccessToken } from "@/lib/auth";
import { generateDueEntries } from "@/lib/recurrence-generator";
import { MAX_CATCH_UP } from "@/lib/recurrence-schedule";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const USER = crypto.randomUUID();
const SECRET = "phase7-secret";
const cat: Record<string, string> = {};

/** Moves the clock (Date only, so network I/O still works) and re-signs the session */
async function at(iso: string) {
  vi.setSystemTime(new Date(iso));
  jar.set("access_token", await signAccessToken({ sub: USER, role: "USER" }));
}

const create = (route: typeof incomes, slug: string, body: unknown) =>
  route.POST(
    new NextRequest(`http://localhost:3000/api/${slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

const list = (route: typeof incomes, slug: string, month: string) =>
  route
    .GET(new NextRequest(`http://localhost:3000/api/${slug}?month=${month}`))
    .then((r) => r.json());

const runCron = () =>
  cron.GET(
    new NextRequest("http://localhost:3000/api/cron/recurrences", {
      headers: { authorization: `Bearer ${SECRET}` },
    })
  );

beforeAll(async () => {
  await sql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at)
    VALUES (${USER}, 'Phase', 'Seven', ${`p7_${USER}@test.internal`}, 'x', 'USER', 'ACTIVE', now())
  `;
  for (const k of ["salary", "housing"])
    cat[k] = (await sql`SELECT id FROM category WHERE system_key = ${k}`)[0]!.id;
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.spyOn(console, "info").mockImplementation(() => {});
  await sql`DELETE FROM income WHERE user_id = ${USER}`;
  await sql`DELETE FROM expense WHERE user_id = ${USER}`;
  await sql`DELETE FROM recurrence WHERE user_id = ${USER}`;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id = ${USER}`;
});

describe("Phase 7 done-when", () => {
  it("salary and rent appear automatically on their day for the new month", async () => {
    // October: the user adds both with "Repeat every month"
    await at("2026-10-20T15:00:00Z");
    expect(
      (
        await create(incomes, "incomes", {
          categoryId: cat.salary,
          amount: "8500",
          entryDate: "2026-10-05",
          description: "Salary",
          repeat: {},
        })
      ).status
    ).toBe(201);
    expect(
      (
        await create(expenses, "expenses", {
          categoryId: cat.housing,
          amount: "2200",
          entryDate: "2026-10-10",
          description: "Rent",
          paymentMethod: "TRANSFER",
          repeat: {},
        })
      ).status
    ).toBe(201);

    // November, before the days: projected, not real
    await at("2026-11-02T15:00:00Z");
    let inc = await list(incomes, "incomes", "2026-11");
    expect(inc.entries).toEqual([]);
    expect(inc.projections.map((p: { amount: string }) => p.amount)).toEqual(["8500.00"]);

    // The daily cron fires on the 5th (00:15 in São Paulo = 03:15 UTC)
    await at("2026-11-05T03:15:00Z");
    expect(await (await runCron()).json()).toMatchObject({ created: 1 });
    inc = await list(incomes, "incomes", "2026-11");
    expect(inc.entries.map((e: { entryDate: string }) => e.entryDate)).toEqual(["2026-11-05"]);
    expect(inc.projections).toEqual([]);
    expect(inc.total).toBe("8500.00");

    // Rent is still projected until the 10th…
    let exp = await list(expenses, "expenses", "2026-11");
    expect(exp.entries).toEqual([]);
    expect(exp.projections).toHaveLength(1);

    // …and real from the 10th; running again the same day changes nothing
    await at("2026-11-10T03:15:00Z");
    await runCron();
    expect(await (await runCron()).json()).toMatchObject({ created: 0 });
    exp = await list(expenses, "expenses", "2026-11");
    expect(exp.entries).toHaveLength(1);
    expect(exp.entries[0]).toMatchObject({
      entryDate: "2026-11-10",
      amount: "2200.00",
      description: "Rent",
      paymentMethod: "TRANSFER",
    });
    expect(exp.projections).toEqual([]);
  });
});

describe("generator safety", () => {
  async function rec(start: string, last: string | null) {
    const [r] = await sql`
      INSERT INTO recurrence (user_id, kind, category_id, amount, payment_method,
                              day_of_month, start_date, last_generated_on)
      VALUES (${USER}, 'EXPENSE', ${cat.housing}, '100', 'PIX', 1, ${start}, ${last})
      RETURNING id`;
    return r!.id as string;
  }

  it(`catches up at most ${MAX_CATCH_UP} months in one run`, async () => {
    await rec("2020-01-01", null);
    const res = await generateDueEntries(new Date("2026-11-02T15:00:00Z"), { userIds: [USER] });
    expect(res.created).toBe(MAX_CATCH_UP);
    // The next run carries on from where it stopped
    const again = await generateDueEntries(new Date("2026-11-02T15:00:00Z"), { userIds: [USER] });
    expect(again.created).toBeGreaterThan(0);
  });

  it("one failing recurrence doesn't stop the others", async () => {
    await rec("2026-10-01", "2026-10-01");
    await rec("2026-10-01", "2026-10-01");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db, "transaction").mockRejectedValueOnce(new Error("boom"));

    const res = await generateDueEntries(new Date("2026-11-02T15:00:00Z"), { userIds: [USER] });
    expect(res).toMatchObject({ checked: 2, created: 1, failed: 1 });
    // The failed one is retried by the next run
    const retry = await generateDueEntries(new Date("2026-11-02T15:00:00Z"), { userIds: [USER] });
    expect(retry).toMatchObject({ created: 1, failed: 0 });
  });
});
