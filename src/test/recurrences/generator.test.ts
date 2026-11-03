// @vitest-environment node
// Phase 7 step 2 — the generator (BR-07) and projections, against the real DB.
// Every run is scoped to this file's users so real/dev data is never touched.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));

import * as expenses from "@/app/api/expenses/route";
import { signAccessToken } from "@/lib/auth";
import { generateDueEntries } from "@/lib/recurrence-generator";
import { dueOccurrences, occurrenceIn } from "@/lib/recurrence-schedule";
import { sumAmounts } from "@/lib/entry-api";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const USER = crypto.randomUUID(); // America/Sao_Paulo
const TOKYO = crypto.randomUUID(); // Asia/Tokyo
const cat: Record<string, string> = {};
const run = (iso: string) => generateDueEntries(new Date(iso), { userIds: [USER, TOKYO] });

async function rec(over: Record<string, unknown> = {}) {
  const r = {
    user: USER,
    category: cat.housing,
    amount: "2200",
    day: 5,
    start: "2026-10-05",
    end: null as string | null,
    last: "2026-10-05" as string | null,
    active: true,
    desc: "Aluguel",
    ...over,
  };
  const [row] = await sql`
    INSERT INTO recurrence (user_id, kind, category_id, description, amount, payment_method,
                            day_of_month, start_date, end_date, last_generated_on, is_active)
    VALUES (${r.user}, 'EXPENSE', ${r.category}, ${r.desc}, ${r.amount}, 'TRANSFER',
            ${r.day}, ${r.start}, ${r.end}, ${r.last}, ${r.active})
    RETURNING id`;
  return row!.id as string;
}

const entriesOf = (recurrenceId: string) =>
  sql`SELECT entry_date::text AS d, amount::text, payment_method, description, deleted_at
      FROM expense WHERE recurrence_id = ${recurrenceId} ORDER BY entry_date`;

beforeAll(async () => {
  await sql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at, timezone)
    VALUES (${USER}, 'Gen', 'SP', ${`gen_${USER}@test.internal`}, 'x', 'USER', 'ACTIVE', now(), 'America/Sao_Paulo'),
           (${TOKYO}, 'Gen', 'TK', ${`gen_${TOKYO}@test.internal`}, 'x', 'USER', 'ACTIVE', now(), 'Asia/Tokyo')
  `;
  for (const k of ["housing", "food"])
    cat[k] = (await sql`SELECT id FROM category WHERE system_key = ${k}`)[0]!.id;
});

beforeEach(async () => {
  jar.clear();
  jar.set("access_token", await signAccessToken({ sub: USER, role: "USER" }));
  await sql`DELETE FROM expense WHERE user_id IN (${USER}, ${TOKYO})`;
  await sql`DELETE FROM recurrence WHERE user_id IN (${USER}, ${TOKYO})`;
});

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id IN (${USER}, ${TOKYO})`;
});

// ── Pure schedule ────────────────────────────────────────────────────────────

describe("schedule", () => {
  const s = { dayOfMonth: 5, startDate: "2026-10-05", endDate: "2027-01-31" };

  it("occurrenceIn respects the start and end window", () => {
    expect(occurrenceIn("2026-09", s)).toBeNull();
    expect(occurrenceIn("2026-10", s)).toBe("2026-10-05");
    expect(occurrenceIn("2027-01", s)).toBe("2027-01-05");
    expect(occurrenceIn("2027-02", s)).toBeNull();
  });

  it("dueOccurrences catches up, stops at today and at the end date", () => {
    expect(dueOccurrences(s, "2026-10-05", "2026-11-04")).toEqual([]);
    expect(dueOccurrences(s, "2026-10-05", "2026-11-05")).toEqual(["2026-11-05"]);
    expect(dueOccurrences(s, "2026-10-05", "2027-06-30")).toEqual([
      "2026-11-05",
      "2026-12-05",
      "2027-01-05",
    ]);
  });
});

// ── Generator ────────────────────────────────────────────────────────────────

describe("generateDueEntries (BR-07)", () => {
  it("creates nothing before the day, and the entry on the day", async () => {
    const id = await rec();
    await run("2026-11-04T15:00:00Z");
    expect(await entriesOf(id)).toHaveLength(0);

    const r = await run("2026-11-05T15:00:00Z");
    expect(r.created).toBe(1);
    expect(await entriesOf(id)).toEqual([
      expect.objectContaining({
        d: "2026-11-05",
        amount: "2200.00",
        payment_method: "TRANSFER",
        description: "Aluguel",
      }),
    ]);
  });

  it("running the job twice creates one entry (idempotent)", async () => {
    const id = await rec();
    const first = await run("2026-11-05T15:00:00Z");
    const second = await run("2026-11-05T16:00:00Z");
    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(await entriesOf(id)).toHaveLength(1);
  });

  it("two runs at the same time still create one entry", async () => {
    const id = await rec();
    await Promise.all([run("2026-11-05T15:00:00Z"), run("2026-11-05T15:00:00Z")]);
    expect(await entriesOf(id)).toHaveLength(1);
  });

  it("is idempotent even if last_generated_on was lost", async () => {
    const id = await rec();
    await run("2026-11-05T15:00:00Z");
    await sql`UPDATE recurrence SET last_generated_on = '2026-10-05' WHERE id = ${id}`;
    await run("2026-11-05T15:00:00Z");
    expect(await entriesOf(id)).toHaveLength(1); // UNIQUE (recurrence_id, entry_date)
  });

  it("catches up on missed months", async () => {
    const id = await rec();
    const r = await run("2027-01-10T15:00:00Z");
    expect(r.created).toBe(3);
    expect((await entriesOf(id)).map((e) => e.d)).toEqual([
      "2026-11-05",
      "2026-12-05",
      "2027-01-05",
    ]);
  });

  it("ended recurrences stop", async () => {
    const id = await rec({ end: "2026-12-31" });
    await run("2027-03-10T15:00:00Z");
    expect((await entriesOf(id)).map((e) => e.d)).toEqual(["2026-11-05", "2026-12-05"]);
  });

  it("paused recurrences don't generate", async () => {
    const id = await rec({ active: false });
    await run("2026-12-10T15:00:00Z");
    expect(await entriesOf(id)).toHaveLength(0);
  });

  it("a generated entry the user deleted is not recreated", async () => {
    const id = await rec();
    await run("2026-11-05T15:00:00Z");
    await sql`UPDATE expense SET deleted_at = now() WHERE recurrence_id = ${id}`;
    await sql`UPDATE recurrence SET last_generated_on = '2026-10-05' WHERE id = ${id}`;
    await run("2026-11-06T15:00:00Z");
    const rows = await entriesOf(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.deleted_at).not.toBeNull();
  });

  it("skips a recurrence whose category was archived (BR-06) and catches up once reactivated", async () => {
    const [mine] = await sql`
      INSERT INTO category (user_id, kind, name, is_active) VALUES (${USER}, 'EXPENSE', ${`Gen ${crypto.randomUUID()}`}, false)
      RETURNING id`;
    const id = await rec({ category: mine!.id });
    const r = await run("2026-12-10T15:00:00Z");
    expect(r.skippedArchived).toBe(1);
    expect(await entriesOf(id)).toHaveLength(0);

    await sql`UPDATE category SET is_active = true WHERE id = ${mine!.id}`;
    await run("2026-12-10T15:00:00Z");
    expect((await entriesOf(id)).map((e) => e.d)).toEqual(["2026-11-05", "2026-12-05"]);
  });

  it("uses each user's own day: 23:30 on Nov 4 in São Paulo is Nov 5 in Tokyo", async () => {
    const sp = await rec();
    const tk = await rec({ user: TOKYO });
    await run("2026-11-05T02:30:00Z");
    expect(await entriesOf(sp)).toHaveLength(0);
    expect(await entriesOf(tk)).toHaveLength(1);
  });

  it("never generates for another user's account", async () => {
    const id = await rec({ user: TOKYO });
    await run("2026-11-05T15:00:00Z");
    const [row] = await sql`SELECT user_id FROM expense WHERE recurrence_id = ${id}`;
    expect(row!.user_id).toBe(TOKYO);
  });
});

// ── Projections ──────────────────────────────────────────────────────────────

describe("projections in the list", () => {
  const list = async (month: string, extra = "") =>
    await (
      await expenses.GET(
        new NextRequest(`http://localhost:3000/api/expenses?month=${month}${extra}`)
      )
    ).json();

  it("a future month shows the recurrence as projected, outside the real total", async () => {
    await rec({ start: "2031-01-05", last: "2031-01-05" });
    const body = await list("2031-03");
    expect(body.entries).toHaveLength(0);
    expect(body.total).toBe("0.00");
    expect(body.projections).toEqual([
      expect.objectContaining({
        entryDate: "2031-03-05",
        amount: "2200.00",
        description: "Aluguel",
        paymentMethod: "TRANSFER",
      }),
    ]);
    expect(body.stats).toMatchObject({ projectedTotal: "2200.00", projectedCount: 1 });
  });

  it("a generated month shows the real entry, not a projection", async () => {
    const id = await rec({ start: "2031-01-05", last: "2031-01-05" });
    await sql`INSERT INTO expense (user_id, category_id, amount, entry_date, recurrence_id)
              VALUES (${USER}, ${cat.housing}, '2200', '2031-02-05', ${id})`;
    await sql`UPDATE recurrence SET last_generated_on = '2031-02-05' WHERE id = ${id}`;
    const body = await list("2031-02");
    expect(body.entries).toHaveLength(1);
    expect(body.projections).toHaveLength(0);
  });

  it("no projection before the start, after the end, or while paused", async () => {
    await rec({ start: "2031-01-05", last: "2031-01-05", end: "2031-02-28" });
    await rec({ start: "2031-01-05", last: "2031-01-05", active: false, desc: "Pausada" });
    expect((await list("2030-12")).projections).toHaveLength(0);
    expect((await list("2031-03")).projections).toHaveLength(0);
    expect(
      (await list("2031-02")).projections.map((p: { description: string }) => p.description)
    ).toEqual(["Aluguel"]);
  });

  it("follows the category filter and the search", async () => {
    await rec({ start: "2031-01-05", last: "2031-01-05" });
    expect((await list("2031-03", `&category=${cat.food}`)).projections).toHaveLength(0);
    expect((await list("2031-03", "&q=alug")).projections).toHaveLength(1);
    expect((await list("2031-03", "&q=mercado")).projections).toHaveLength(0);
  });

  it("only appears on the first page", async () => {
    await rec({ start: "2031-01-05", last: "2031-01-05" });
    expect((await list("2031-03", "&page=2")).projections).toHaveLength(1); // API returns them; the page hides them past page 1
  });
});

describe("sumAmounts", () => {
  it("adds decimal strings exactly", () => {
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30");
    expect(sumAmounts(["999999999999.99", "0.01"])).toBe("1000000000000.00");
    expect(sumAmounts([])).toBe("0.00");
  });
});
