// @vitest-environment node
// Phase 7 step 4 — managing recurrences (UC-13): list, pause/resume, edit amount, end, delete.
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));

import * as list from "@/app/api/recurrences/route";
import * as item from "@/app/api/recurrences/[id]/route";
import { signAccessToken } from "@/lib/auth";
import { generateDueEntries } from "@/lib/recurrence-generator";
import { nextOccurrence } from "@/lib/recurrence-schedule";
import { updateRecurrenceSchema, type RecurrenceDto } from "@/lib/recurrences";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const USER = crypto.randomUUID();
const OTHER = crypto.randomUUID();
let housing = "";

// 2026-11-10 12:00 in São Paulo — only Date is faked, so network I/O still works
const NOW = new Date("2026-11-10T15:00:00Z");
/** Moves the clock and re-signs the session — access tokens live 15 minutes */
async function travelTo(iso: string) {
  vi.setSystemTime(new Date(iso));
  jar.set("access_token", await signAccessToken({ sub: USER, role: "USER" }));
}
const generate = (iso: string) => generateDueEntries(new Date(iso), { userIds: [USER] });

async function rec(over: Record<string, unknown> = {}) {
  const r = {
    user: USER,
    day: 5,
    start: "2026-10-05",
    end: null as string | null,
    last: "2026-11-05" as string | null,
    active: true,
    ...over,
  };
  const [row] = await sql`
    INSERT INTO recurrence (user_id, kind, category_id, description, amount, payment_method,
                            day_of_month, start_date, end_date, last_generated_on, is_active)
    VALUES (${r.user}, 'EXPENSE', ${housing}, 'Aluguel', '2200', 'TRANSFER',
            ${r.day}, ${r.start}, ${r.end}, ${r.last}, ${r.active})
    RETURNING id`;
  return row!.id as string;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = async (r: Response) => ({ status: r.status, body: await r.json() });

const getAll = () => list.GET().then(json);
const put = (id: string, body: unknown) =>
  item
    .PUT(
      new NextRequest(`http://localhost:3000/api/recurrences/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      ctx(id)
    )
    .then(json);
const del = (id: string) =>
  item.DELETE(new NextRequest(`http://localhost:3000/api/recurrences/${id}`), ctx(id)).then(json);

const row = (id: string) =>
  sql`SELECT amount::text, end_date::text, last_generated_on::text, is_active
      FROM recurrence WHERE id = ${id}`.then((r) => r[0]);
const entriesOf = (id: string) =>
  sql`SELECT entry_date::text AS d, amount::text FROM expense
      WHERE recurrence_id = ${id} ORDER BY entry_date`;

beforeAll(async () => {
  await sql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at)
    VALUES (${USER}, 'Man', 'One', ${`man1_${USER}@test.internal`}, 'x', 'USER', 'ACTIVE', now()),
           (${OTHER}, 'Man', 'Two', ${`man2_${OTHER}@test.internal`}, 'x', 'USER', 'ACTIVE', now())
  `;
  housing = (await sql`SELECT id FROM category WHERE system_key = 'housing'`)[0]!.id;
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  jar.clear();
  jar.set("access_token", await signAccessToken({ sub: USER, role: "USER" }));
  await sql`DELETE FROM expense WHERE user_id IN (${USER}, ${OTHER})`;
  await sql`DELETE FROM recurrence WHERE user_id IN (${USER}, ${OTHER})`;
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id IN (${USER}, ${OTHER})`;
});

describe("nextOccurrence", () => {
  const s = { dayOfMonth: 5, startDate: "2026-10-05", endDate: null };

  it("is this month's date when it hasn't happened yet", () => {
    expect(nextOccurrence(s, "2026-10-05", "2026-11-03")).toBe("2026-11-05");
  });

  it("is today's date when today is the day and it wasn't generated yet", () => {
    expect(nextOccurrence(s, "2026-10-05", "2026-11-05")).toBe("2026-11-05");
  });

  it("moves to next month once this month's entry exists", () => {
    expect(nextOccurrence(s, "2026-11-05", "2026-11-05")).toBe("2026-12-05");
    expect(nextOccurrence(s, "2026-11-05", "2026-11-20")).toBe("2026-12-05");
  });

  it("waits for a start date in the future", () => {
    expect(nextOccurrence({ ...s, startDate: "2027-03-05" }, null, "2026-11-10")).toBe(
      "2027-03-05"
    );
  });

  it("is null once past the end date", () => {
    expect(nextOccurrence({ ...s, endDate: "2026-11-30" }, "2026-11-05", "2026-11-10")).toBeNull();
    expect(nextOccurrence({ ...s, endDate: "2026-12-05" }, "2026-11-05", "2026-11-10")).toBe(
      "2026-12-05"
    );
  });

  it("handles the year boundary", () => {
    expect(nextOccurrence(s, "2026-12-05", "2026-12-20")).toBe("2027-01-05");
  });
});

describe("updateRecurrenceSchema", () => {
  it("rejects fields the client must not change", () => {
    for (const body of [{ kind: "INCOME" }, { userId: OTHER }, { dayOfMonth: 10 }, {}]) {
      expect(updateRecurrenceSchema.safeParse(body).success).toBe(false);
    }
  });

  it("normalises the amount and empty description", () => {
    expect(updateRecurrenceSchema.parse({ amount: "2500", description: "  " })).toEqual({
      amount: "2500.00",
      description: null,
    });
  });
});

describe("GET /api/recurrences", () => {
  it("lists only the caller's recurrences with status and next date", async () => {
    const active = await rec();
    const paused = await rec({ active: false, day: 20 });
    const ended = await rec({ end: "2026-11-05", day: 1, last: "2026-11-01" });
    await rec({ user: OTHER });

    const { status, body } = await getAll();
    expect(status).toBe(200);
    const byId = Object.fromEntries((body.recurrences as RecurrenceDto[]).map((r) => [r.id, r]));
    expect(Object.keys(byId).sort()).toEqual([active, paused, ended].sort());
    expect(byId[active]).toMatchObject({
      status: "ACTIVE",
      nextDate: "2026-12-05",
      amount: "2200.00",
    });
    expect(byId[paused]).toMatchObject({ status: "PAUSED", nextDate: null });
    expect(byId[ended]).toMatchObject({ status: "ENDED", nextDate: null });
  });

  it("requires a session", async () => {
    jar.clear();
    expect((await getAll()).status).toBe(401);
  });
});

describe("PUT /api/recurrences/{id}", () => {
  it("edits the amount for future entries only", async () => {
    const id = await rec();
    await generate("2026-11-06T12:00:00Z"); // nothing new: November already exists
    await sql`INSERT INTO expense (user_id, category_id, amount, entry_date, recurrence_id, payment_method)
              VALUES (${USER}, ${housing}, '2200', '2026-11-05', ${id}, 'TRANSFER')`;

    const { status, body } = await put(id, { amount: "2350.5" });
    expect(status).toBe(200);
    expect(body.recurrence.amount).toBe("2350.50");

    await generate("2026-12-05T12:00:00Z");
    expect(await entriesOf(id)).toEqual([
      { d: "2026-11-05", amount: "2200.00" }, // already created → unchanged
      { d: "2026-12-05", amount: "2350.50" },
    ]);
  });

  it("pausing stops generation; resuming doesn't back-fill the paused months", async () => {
    const id = await rec();
    expect((await put(id, { isActive: false })).body.recurrence).toMatchObject({
      status: "PAUSED",
      nextDate: null,
    });

    await generate("2027-01-06T12:00:00Z"); // December and January pass while paused
    expect(await entriesOf(id)).toEqual([]);

    await travelTo("2027-01-20T15:00:00Z");
    const { body } = await put(id, { isActive: true });
    expect(body.recurrence).toMatchObject({ status: "ACTIVE", nextDate: "2027-02-05" });
    expect((await row(id))!.last_generated_on).toBe("2027-01-19");

    await generate("2027-02-05T12:00:00Z");
    expect((await entriesOf(id)).map((e) => e.d)).toEqual(["2027-02-05"]);
  });

  it("resuming on the recurrence's day still creates that day's entry", async () => {
    const id = await rec({ active: false, last: "2026-10-05" });
    await travelTo("2026-12-05T15:00:00Z");
    const { body } = await put(id, { isActive: true });
    expect(body.recurrence.nextDate).toBe("2026-12-05");

    await generate("2026-12-05T15:00:00Z");
    expect((await entriesOf(id)).map((e) => e.d)).toEqual(["2026-12-05"]);
  });

  it("an end date stops the recurrence after it", async () => {
    const id = await rec();
    const { body } = await put(id, { endDate: "2026-12-31" });
    expect(body.recurrence).toMatchObject({ status: "ACTIVE", nextDate: "2026-12-05" });

    await generate("2027-03-10T12:00:00Z");
    expect((await entriesOf(id)).map((e) => e.d)).toEqual(["2026-12-05"]);
  });

  it("ending today marks it ended", async () => {
    const id = await rec();
    const { body } = await put(id, { endDate: "2026-11-10" });
    expect(body.recurrence).toMatchObject({ status: "ENDED", endDate: "2026-11-10" });
  });

  it("clearing the end date reopens it", async () => {
    const id = await rec({ end: "2026-11-05" });
    const { body } = await put(id, { endDate: null });
    expect(body.recurrence).toMatchObject({ status: "ACTIVE", nextDate: "2026-12-05" });
  });

  it("rejects an end date before the start", async () => {
    const id = await rec();
    const { status, body } = await put(id, { endDate: "2026-09-30" });
    expect(status).toBe(422);
    expect(body.error.fields.endDate).toEqual(["validation.recurrenceEnd"]);
    expect((await row(id))!.end_date).toBeNull();
  });

  it("rejects invalid bodies with 422", async () => {
    const id = await rec();
    for (const body of [{ amount: "0" }, { amount: "-5" }, { kind: "INCOME" }, {}]) {
      expect((await put(id, body)).status).toBe(422);
    }
    expect((await row(id))!.amount).toBe("2200.00");
  });

  it("returns 404 for another user's recurrence and leaves it untouched (BR-01)", async () => {
    const theirs = await rec({ user: OTHER });
    expect((await put(theirs, { amount: "1" })).status).toBe(404);
    expect((await row(theirs))!.amount).toBe("2200.00");
  });

  it("returns 404 for a malformed id", async () => {
    expect((await put("not-a-uuid", { amount: "1" })).status).toBe(404);
  });
});

describe("DELETE /api/recurrences/{id}", () => {
  it("deletes it and keeps the entries it created", async () => {
    const id = await rec({ last: "2026-10-05" });
    await generate("2026-11-06T12:00:00Z");
    const [entry] = await entriesOf(id);
    expect(entry).toBeDefined();

    expect((await del(id)).status).toBe(200);
    expect(await row(id)).toBeUndefined();
    const kept = await sql`SELECT recurrence_id FROM expense
                           WHERE user_id = ${USER} AND entry_date = '2026-11-05'`;
    expect(kept).toEqual([{ recurrence_id: null }]);
  });

  it("returns 404 for another user's recurrence and keeps it", async () => {
    const theirs = await rec({ user: OTHER });
    expect((await del(theirs)).status).toBe(404);
    expect(await row(theirs)).toBeDefined();
  });
});
