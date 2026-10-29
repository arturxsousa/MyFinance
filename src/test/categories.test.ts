// @vitest-environment node
// UC-12 / BR-06 — category API against the real DB; `next/headers` cookies mocked.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));

import { GET, POST } from "@/app/api/categories/route";
import { PUT, DELETE } from "@/app/api/categories/[id]/route";
import { signAccessToken } from "@/lib/auth";
import { withUserDb } from "@/db/with-user-db";
import { category } from "@/db/schema/categories";
import { messages } from "@/i18n/messages";
import type { CategoryDto } from "@/lib/categories";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const USER_A = crypto.randomUUID();
const USER_B = crypto.randomUUID();
let systemFoodId: string;

async function as(userId: string) {
  jar.set("access_token", await signAccessToken({ sub: userId, role: "USER" }));
}

const req = (method: string, url: string, body?: unknown) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function list(kind?: string): Promise<CategoryDto[]> {
  const res = await GET(req("GET", `/api/categories${kind ? `?kind=${kind}` : ""}`));
  expect(res.status).toBe(200);
  return (await res.json()).categories;
}

async function create(body: Record<string, unknown>) {
  const res = await POST(req("POST", "/api/categories", body));
  return { status: res.status, body: await res.json() };
}

const put = async (id: string, body: unknown) => {
  const res = await PUT(req("PUT", `/api/categories/${id}`, body), ctx(id));
  return { status: res.status, body: await res.json() };
};

const del = async (id: string) => {
  const res = await DELETE(req("DELETE", `/api/categories/${id}`), ctx(id));
  return { status: res.status, body: await res.json() };
};

beforeAll(async () => {
  await sql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at)
    VALUES
      (${USER_A}, 'Cat', 'A', ${`cat_a_${USER_A}@test.internal`}, 'x', 'USER', 'ACTIVE', now()),
      (${USER_B}, 'Cat', 'B', ${`cat_b_${USER_B}@test.internal`}, 'x', 'USER', 'ACTIVE', now())
  `;
  const [food] = await sql`SELECT id FROM category WHERE system_key = 'food'`;
  systemFoodId = food!.id;
});

beforeEach(async () => {
  jar.clear();
  await as(USER_A);
});

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id IN (${USER_A}, ${USER_B})`;
});

// ── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/categories", () => {
  it("returns system categories first, marked read-only, with a translation key", async () => {
    const cats = await list("EXPENSE");
    const systemCount = cats.filter((c) => c.isSystem).length;
    expect(systemCount).toBeGreaterThan(0);
    expect(cats.slice(0, systemCount).every((c) => c.isSystem && c.systemKey)).toBe(true);
  });

  it("filters by kind", async () => {
    const cats = await list("INCOME");
    expect(cats.every((c) => c.kind === "INCOME")).toBe(true);
  });

  it("includes own categories but never another user's", async () => {
    await as(USER_B);
    await create({ kind: "EXPENSE", name: "B secret", color: "#111111" });
    await as(USER_A);
    const mine = await create({ kind: "EXPENSE", name: "A visible", color: "#222222" });

    const names = (await list("EXPENSE")).map((c) => c.name);
    expect(names).toContain("A visible");
    expect(names).not.toContain("B secret");
    expect(mine.body.category.isSystem).toBe(false);
  });

  it("rejects an unknown kind with 422", async () => {
    expect((await GET(req("GET", "/api/categories?kind=FOO"))).status).toBe(422);
  });

  it("requires authentication", async () => {
    jar.clear();
    expect((await GET(req("GET", "/api/categories"))).status).toBe(401);
  });
});

// ── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/categories", () => {
  it('creates "Pets" as an expense category (Phase 5 done-when)', async () => {
    const { status, body } = await create({ kind: "EXPENSE", name: "  Pets ", color: "#F59E0B" });
    expect(status).toBe(201);
    expect(body.category).toMatchObject({
      kind: "EXPENSE",
      name: "Pets",
      color: "#f59e0b",
      isActive: true,
      isSystem: false,
      systemKey: null,
    });
    expect((await list("EXPENSE")).map((c) => c.name)).toContain("Pets");
  });

  it("rejects a duplicate name for the same kind, case-insensitively", async () => {
    await create({ kind: "INCOME", name: "Side gig", color: "#123456" });
    const dup = await create({ kind: "INCOME", name: "SIDE GIG", color: "#654321" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.fields.name).toEqual(["category.nameTaken"]);
  });

  it("allows the same name under a different kind", async () => {
    await create({ kind: "INCOME", name: "Gifts", color: "#123456" });
    expect((await create({ kind: "EXPENSE", name: "Gifts", color: "#123456" })).status).toBe(201);
  });

  it("allows two users to have the same name", async () => {
    await create({ kind: "EXPENSE", name: "Gym", color: "#123456" });
    await as(USER_B);
    expect((await create({ kind: "EXPENSE", name: "Gym", color: "#123456" })).status).toBe(201);
  });

  it.each(["Food", "food", "Alimentação", " ALIMENTAÇÃO "])(
    "rejects %s — it clashes with a system category in some language",
    async (name) => {
      expect((await create({ kind: "EXPENSE", name, color: "#123456" })).status).toBe(409);
    }
  );

  it.each([
    ["empty name", { name: "  " }, "name"],
    ["name over 50 chars", { name: "x".repeat(51) }, "name"],
    ["bad color", { color: "red" }, "color"],
    ["unknown kind", { kind: "SAVINGS" }, "kind"],
  ])("rejects %s with 422", async (_label, override, field) => {
    const { status, body } = await create({
      kind: "EXPENSE",
      name: "Valid",
      color: "#123456",
      ...override,
    });
    expect(status).toBe(422);
    expect(body.error.fields[field]).toBeDefined();
  });

  it.each([["userId"], ["systemKey"], ["isActive"]])(
    "rejects an attempt to set %s",
    async (key) => {
      const value = key === "userId" ? USER_B : key === "systemKey" ? "food" : false;
      const { status } = await create({
        kind: "EXPENSE",
        name: `Sneaky ${key}`,
        color: "#123456",
        [key]: value,
      });
      expect(status).toBe(422);
    }
  );
});

// ── PUT ──────────────────────────────────────────────────────────────────────

describe("PUT /api/categories/[id]", () => {
  async function ownCategory(name: string) {
    return (await create({ kind: "EXPENSE", name, color: "#123456" })).body.category as CategoryDto;
  }

  it("renames, recolors, archives and unarchives", async () => {
    const cat = await ownCategory("Rename me");

    const renamed = await put(cat.id, { name: "Renamed", color: "#ABCDEF" });
    expect(renamed.body.category).toMatchObject({ name: "Renamed", color: "#abcdef" });

    expect((await put(cat.id, { isActive: false })).body.category.isActive).toBe(false);
    expect((await put(cat.id, { isActive: true })).body.category.isActive).toBe(true);
  });

  it("rejects renaming to a name already in use", async () => {
    await ownCategory("Taken name");
    const cat = await ownCategory("Other name");
    expect((await put(cat.id, { name: "taken NAME" })).status).toBe(409);
    expect((await put(cat.id, { name: "Housing" })).status).toBe(409); // system
  });

  it("keeps the kind immutable", async () => {
    const cat = await ownCategory("Fixed kind");
    expect((await put(cat.id, { kind: "INCOME" })).status).toBe(422);
  });

  it("rejects an empty update", async () => {
    const cat = await ownCategory("Empty update");
    expect((await put(cat.id, {})).status).toBe(422);
  });

  it("system categories are read-only (403)", async () => {
    const res = await put(systemFoodId, { name: "Hacked" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CATEGORY_READ_ONLY");
  });

  it("another user's category is a 404 (BR-01)", async () => {
    await as(USER_B);
    const theirs = await ownCategory("B only");
    await as(USER_A);
    expect((await put(theirs.id, { name: "Mine now" })).status).toBe(404);
  });

  it("a malformed id is a 404", async () => {
    expect((await put("not-a-uuid", { name: "X" })).status).toBe(404);
  });
});

// ── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/categories/[id]", () => {
  async function ownCategory(kind: "INCOME" | "EXPENSE", name: string) {
    return (await create({ kind, name, color: "#123456" })).body.category as CategoryDto;
  }

  it("hard-deletes an unused category", async () => {
    const cat = await ownCategory("EXPENSE", "Unused");
    expect((await del(cat.id)).body).toEqual({ result: "deleted" });
    const rows = await sql`SELECT id FROM category WHERE id = ${cat.id}`;
    expect(rows).toHaveLength(0);
  });

  it("archives a category in use instead of deleting it (BR-06)", async () => {
    const cat = await ownCategory("INCOME", "In use");
    await sql`
      INSERT INTO income (user_id, category_id, amount, entry_date)
      VALUES (${USER_A}, ${cat.id}, '10.00', CURRENT_DATE)
    `;
    expect((await del(cat.id)).body).toEqual({ result: "archived" });
    const [row] = await sql`SELECT is_active FROM category WHERE id = ${cat.id}`;
    expect(row!.is_active).toBe(false);
  });

  it("a soft-deleted entry still counts as in use (it can be restored)", async () => {
    const cat = await ownCategory("INCOME", "Soft used");
    await sql`
      INSERT INTO income (user_id, category_id, amount, entry_date, deleted_at)
      VALUES (${USER_A}, ${cat.id}, '10.00', CURRENT_DATE, now())
    `;
    expect((await del(cat.id)).body.result).toBe("archived");
  });

  it("system categories can't be deleted (403)", async () => {
    expect((await del(systemFoodId)).status).toBe(403);
  });

  it("another user's category is a 404", async () => {
    await as(USER_B);
    const theirs = await ownCategory("EXPENSE", "B keeps");
    await as(USER_A);
    expect((await del(theirs.id)).status).toBe(404);
    const rows = await sql`SELECT id FROM category WHERE id = ${theirs.id}`;
    expect(rows).toHaveLength(1);
  });
});

// ── RLS (defence in depth, bypassing the API) ────────────────────────────────

describe("category RLS", () => {
  it("a user cannot delete or modify a system category even with a raw query", async () => {
    const deleted = await withUserDb(USER_A, (tx) =>
      tx.delete(category).where(eq(category.id, systemFoodId)).returning()
    );
    expect(deleted).toHaveLength(0);

    const updated = await withUserDb(USER_A, (tx) =>
      tx.update(category).set({ name: "Hacked" }).where(eq(category.id, systemFoodId)).returning()
    );
    expect(updated).toHaveLength(0);

    const [row] = await sql`SELECT name FROM category WHERE id = ${systemFoodId}`;
    expect(row!.name).toBe("Food");
  });

  it("a user cannot create a system category (user_id NULL)", async () => {
    await expect(
      withUserDb(USER_A, (tx) =>
        tx.insert(category).values({ userId: null, kind: "EXPENSE", name: "Fake system" })
      )
    ).rejects.toThrow();
  });
});

describe("system category translations", () => {
  it("every system category has a name in every language", async () => {
    const rows = await sql`SELECT system_key FROM category WHERE user_id IS NULL`;
    for (const dict of Object.values(messages)) {
      for (const { system_key } of rows) {
        expect(dict.systemCategories, system_key).toHaveProperty(system_key);
      }
    }
  });
});
