// @vitest-environment node
// UC-16 — GET/PATCH /api/me against the real DB; `next/headers` cookies mocked.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));

import { GET, PATCH } from "@/app/api/me/route";
import { signAccessToken } from "@/lib/auth";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const USER = crypto.randomUUID();
const OTHER = crypto.randomUUID();

const valid = {
  firstName: "Maria",
  lastName: "Silva",
  currency: "USD",
  locale: "en-US",
  timezone: "America/Manaus",
};

const patch = (body: unknown) =>
  PATCH(
    new NextRequest("http://localhost:3000/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

beforeAll(async () => {
  await sql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at)
    VALUES
      (${USER}, 'Before', 'Edit', ${`me_${USER}@test.internal`}, 'secret-hash', 'USER', 'ACTIVE', now()),
      (${OTHER}, 'Other', 'User', ${`me_${OTHER}@test.internal`}, 'x', 'USER', 'ACTIVE', now())
  `;
});

beforeEach(async () => {
  jar.clear();
  jar.set("access_token", await signAccessToken({ sub: USER, role: "USER" }));
});

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id IN (${USER}, ${OTHER})`;
});

describe("GET /api/me", () => {
  it("returns the caller's profile without sensitive fields", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user).toMatchObject({ id: USER, firstName: "Before", currency: "BRL" });
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("failedLoginCount");
  });

  it("requires authentication", async () => {
    jar.clear();
    expect((await GET()).status).toBe(401);
  });
});

describe("PATCH /api/me", () => {
  it("saves name, currency, locale and timezone", async () => {
    const res = await patch({ ...valid, firstName: "  Maria  " });
    expect(res.status).toBe(200);
    expect((await res.json()).user).toMatchObject({ ...valid, firstName: "Maria" });

    const [row] = await sql`SELECT * FROM app_user WHERE id = ${USER}`;
    expect(row).toMatchObject({
      first_name: "Maria",
      last_name: "Silva",
      currency: "USD",
      locale: "en-US",
      timezone: "America/Manaus",
    });
  });

  it("accepts a valid IANA zone outside the curated list", async () => {
    expect((await patch({ ...valid, timezone: "Asia/Tokyo" })).status).toBe(200);
  });

  it.each([
    ["empty first name", { firstName: "   " }, "firstName"],
    ["unsupported currency", { currency: "JPY" }, "currency"],
    ["unsupported locale", { locale: "fr-FR" }, "locale"],
    ["invalid timezone", { timezone: "Mars/Olympus" }, "timezone"],
  ])("rejects %s with 422", async (_label, override, field) => {
    const res = await patch({ ...valid, ...override });
    expect(res.status).toBe(422);
    expect((await res.json()).error.fields[field]).toBeDefined();
  });

  it.each([
    ["role", { role: "ADMIN" }],
    ["status", { status: "ACTIVE" }],
    ["email", { email: "new@test.internal" }],
    ["passwordHash", { passwordHash: "x" }],
  ])("rejects an attempt to set %s (BR-09)", async (_label, extra) => {
    const res = await patch({ ...valid, ...extra });
    expect(res.status).toBe(422);

    const [row] = await sql`SELECT role, email, password_hash FROM app_user WHERE id = ${USER}`;
    expect(row).toMatchObject({
      role: "USER",
      email: `me_${USER}@test.internal`,
      password_hash: "secret-hash",
    });
  });

  it("only ever updates the caller's own row", async () => {
    await patch({ ...valid, firstName: "Changed" });
    const [other] = await sql`SELECT first_name FROM app_user WHERE id = ${OTHER}`;
    expect(other!.first_name).toBe("Other");
  });

  it("requires authentication", async () => {
    jar.clear();
    expect((await patch(valid)).status).toBe(401);
  });
});
