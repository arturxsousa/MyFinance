// @vitest-environment node
// Phase 7 step 5 — editing a generated entry: "only this one" vs "this and future" (UC-09).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));

import * as expenseItem from "@/app/api/expenses/[id]/route";
import * as expenses from "@/app/api/expenses/route";
import { signAccessToken } from "@/lib/auth";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const USER = crypto.randomUUID();
const OTHER = crypto.randomUUID();
const cat: Record<string, string> = {};
let recId = "";
const entry: Record<string, string> = {}; // month → id

const put = (id: string, body: unknown, scope?: string) =>
  expenseItem
    .PUT(
      new NextRequest(`http://localhost:3000/api/expenses/${id}${scope ? `?scope=${scope}` : ""}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) }
    )
    .then(async (r) => ({ status: r.status, body: await r.json() }));

const recurrence = () =>
  sql`SELECT amount::text, category_id, description, payment_method
      FROM recurrence WHERE id = ${recId}`.then((r) => r[0]);
const entries = () =>
  sql`SELECT to_char(entry_date, 'YYYY-MM') AS m, entry_date::text AS d, amount::text,
             category_id, description, payment_method, notes, deleted_at IS NOT NULL AS deleted
      FROM expense WHERE user_id = ${USER} ORDER BY entry_date`;

beforeAll(async () => {
  await sql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at)
    VALUES (${USER}, 'Scope', 'One', ${`scope1_${USER}@test.internal`}, 'x', 'USER', 'ACTIVE', now()),
           (${OTHER}, 'Scope', 'Two', ${`scope2_${OTHER}@test.internal`}, 'x', 'USER', 'ACTIVE', now())
  `;
  for (const k of ["housing", "bills"])
    cat[k] = (await sql`SELECT id FROM category WHERE system_key = ${k}`)[0]!.id;
});

// Rent since August: Aug, Sep, Oct and Nov already created
beforeEach(async () => {
  jar.clear();
  jar.set("access_token", await signAccessToken({ sub: USER, role: "USER" }));
  await sql`DELETE FROM expense WHERE user_id IN (${USER}, ${OTHER})`;
  await sql`DELETE FROM recurrence WHERE user_id IN (${USER}, ${OTHER})`;
  const [r] = await sql`
    INSERT INTO recurrence (user_id, kind, category_id, description, amount, payment_method,
                            day_of_month, start_date, last_generated_on)
    VALUES (${USER}, 'EXPENSE', ${cat.housing}, 'Rent', '2200', 'TRANSFER', 5, '2026-08-05', '2026-11-05')
    RETURNING id`;
  recId = r!.id;
  for (const m of ["08", "09", "10", "11"]) {
    const [e] = await sql`
      INSERT INTO expense (user_id, category_id, description, amount, entry_date, recurrence_id, payment_method)
      VALUES (${USER}, ${cat.housing}, 'Rent', '2200', ${`2026-${m}-05`}, ${recId}, 'TRANSFER')
      RETURNING id`;
    entry[m] = e!.id;
  }
});

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id IN (${USER}, ${OTHER})`;
});

describe("PUT /expenses/{id} on a recurring entry", () => {
  it("default scope changes only this entry", async () => {
    const res = await put(entry["09"]!, { amount: "2400" });
    expect(res.status).toBe(200);
    expect(res.body.updatedFollowing).toBe(0);
    expect((await entries()).map((e) => e.amount)).toEqual([
      "2200.00",
      "2400.00",
      "2200.00",
      "2200.00",
    ]);
    expect((await recurrence())!.amount).toBe("2200.00");
  });

  it("scope=this is the same as the default", async () => {
    expect((await put(entry["09"]!, { amount: "2400" }, "this")).status).toBe(200);
    expect((await recurrence())!.amount).toBe("2200.00");
  });

  it("scope=future updates the recurrence and the later entries, not the earlier ones", async () => {
    const res = await put(
      entry["09"]!,
      {
        amount: "2450",
        categoryId: cat.bills,
        description: "Rent + condo",
        paymentMethod: "PIX",
      },
      "future"
    );
    expect(res.status).toBe(200);
    expect(res.body.updatedFollowing).toBe(2); // Oct, Nov

    const rows = await entries();
    expect(rows[0]).toMatchObject({ m: "2026-08", amount: "2200.00", description: "Rent" });
    for (const r of rows.slice(1)) {
      expect(r).toMatchObject({
        amount: "2450.00",
        category_id: cat.bills,
        description: "Rent + condo",
        payment_method: "PIX",
      });
    }
    expect(await recurrence()).toEqual({
      amount: "2450.00",
      category_id: cat.bills,
      description: "Rent + condo",
      payment_method: "PIX",
    });
  });

  it("future projections use the new values", async () => {
    await put(entry["11"]!, { amount: "2600" }, "future");
    const res = await expenses.GET(
      new NextRequest("http://localhost:3000/api/expenses?month=2026-12")
    );
    const body = await res.json();
    expect(body.projections.map((p: { amount: string }) => p.amount)).toEqual(["2600.00"]);
  });

  it("date and notes stay on this entry only", async () => {
    const res = await put(
      entry["09"]!,
      { entryDate: "2026-09-08", notes: "paid late", amount: "2300" },
      "future"
    );
    expect(res.status).toBe(200);
    const rows = await entries();
    expect(rows.map((r) => r.d)).toEqual(["2026-08-05", "2026-09-08", "2026-10-05", "2026-11-05"]);
    expect(rows.map((r) => r.notes)).toEqual([null, "paid late", null, null]);
    expect(rows.slice(2).every((r) => r.amount === "2300.00")).toBe(true);
  });

  it("leaves deleted entries alone", async () => {
    await sql`UPDATE expense SET deleted_at = now() WHERE id = ${entry["10"]!}`;
    const res = await put(entry["09"]!, { amount: "2500" }, "future");
    expect(res.body.updatedFollowing).toBe(1); // only Nov
    const oct = (await entries()).find((r) => r.m === "2026-10")!;
    expect(oct).toMatchObject({ deleted: true, amount: "2200.00" });
  });

  it("only notes with scope=future doesn't touch the recurrence", async () => {
    const res = await put(entry["09"]!, { notes: "note" }, "future");
    expect(res.body.updatedFollowing).toBe(0);
    expect((await recurrence())!.amount).toBe("2200.00");
  });

  it("rejects scope=future on an entry that isn't recurring (409)", async () => {
    const [plain] = await sql`
      INSERT INTO expense (user_id, category_id, amount, entry_date, payment_method)
      VALUES (${USER}, ${cat.housing}, '10', '2026-10-10', 'PIX') RETURNING id`;
    const res = await put(plain!.id, { amount: "11" }, "future");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NOT_RECURRING");
  });

  it("rejects an unknown scope (422) without changing anything", async () => {
    expect((await put(entry["09"]!, { amount: "1" }, "all")).status).toBe(422);
    expect((await entries()).every((r) => r.amount === "2200.00")).toBe(true);
  });

  it("validates the category before carrying it over", async () => {
    const res = await put(entry["09"]!, { categoryId: crypto.randomUUID() }, "future");
    expect(res.status).toBe(422);
    expect((await recurrence())!.category_id).toBe(cat.housing);
  });

  it("another user can't edit it with either scope (BR-01)", async () => {
    jar.set("access_token", await signAccessToken({ sub: OTHER, role: "USER" }));
    expect((await put(entry["09"]!, { amount: "1" }, "future")).status).toBe(404);
    expect((await recurrence())!.amount).toBe("2200.00");
  });
});
