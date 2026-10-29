// @vitest-environment node
//
// Phase 4 "done when": a Common user can't reach anything Admin by URL, and
// user A gets 404 on user B's ids.
//
// Admin routes are discovered from the filesystem, so every admin page and
// handler added later (Phase 10) is covered without writing a new test.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

import { proxy } from "@/proxy";
import { signAccessToken } from "@/lib/auth";
import { requireAdmin } from "@/lib/guards";
import { withUserDb } from "@/db/with-user-db";
import { incomeRepo } from "@/db/repositories";
import { parseId, requireOwned } from "@/lib/ownership";
import { ApiError, handleRouteError } from "@/lib/api-error";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const APP_DIR = path.resolve("src/app");
const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

// ── Route discovery ──────────────────────────────────────────────────────────

/** "src/app/(app)/admin/users/[id]/page.tsx" → "/admin/users/<uuid>" */
function toUrlPath(file: string): string {
  const segments = path
    .relative(APP_DIR, path.dirname(file))
    .split(path.sep)
    .filter((s) => s && !(s.startsWith("(") && s.endsWith(")"))) // route groups
    .map((s) => (s.startsWith("[") ? SAMPLE_ID : s));
  return "/" + segments.join("/");
}

function findRouteFiles(name: "page.tsx" | "route.ts") {
  return (readdirSync(APP_DIR, { recursive: true }) as string[])
    .filter((f) => path.basename(f) === name && !f.includes(" 2.")) // skip Finder duplicates
    .map((f) => path.join(APP_DIR, f));
}

const isAdminPath = (p: string) => p === "/admin" || p.startsWith("/admin/");
const isAdminApiPath = (p: string) => p === "/api/admin" || p.startsWith("/api/admin/");

const adminPages = findRouteFiles("page.tsx").filter((f) => isAdminPath(toUrlPath(f)));
const adminHandlers = findRouteFiles("route.ts").filter((f) => isAdminApiPath(toUrlPath(f)));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const RUN = crypto.randomUUID().slice(0, 8);
const COMMON = crypto.randomUUID();
const DEMOTED = crypto.randomUUID(); // was Admin, JWT still says ADMIN
const ADMIN = crypto.randomUUID();
const USER_B = crypto.randomUUID();
let incomeB: string;

const loginAs = async (sub: string, role: "USER" | "ADMIN") =>
  jar.set("access_token", await signAccessToken({ sub, role }));

beforeAll(async () => {
  await sql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status, accepted_terms_at)
    VALUES
      (${COMMON},  'Authz', 'Common',  ${`authz_${RUN}_common@test.internal`},  'x', 'USER',  'ACTIVE', now()),
      (${DEMOTED}, 'Authz', 'Demoted', ${`authz_${RUN}_demoted@test.internal`}, 'x', 'USER',  'ACTIVE', now()),
      (${ADMIN},   'Authz', 'Admin',   ${`authz_${RUN}_admin@test.internal`},   'x', 'ADMIN', 'ACTIVE', now()),
      (${USER_B},  'Authz', 'B',       ${`authz_${RUN}_b@test.internal`},       'x', 'USER',  'ACTIVE', now())
  `;
  const [cat] =
    await sql`SELECT id FROM category WHERE user_id IS NULL AND kind = 'INCOME' LIMIT 1`;
  const [row] = await sql`
    INSERT INTO income (user_id, category_id, amount, entry_date)
    VALUES (${USER_B}, ${cat!.id}, '50.00', CURRENT_DATE) RETURNING id
  `;
  incomeB = row!.id;
});

beforeEach(() => jar.clear());

afterAll(async () => {
  await sql`DELETE FROM app_user WHERE id IN (${COMMON}, ${DEMOTED}, ${ADMIN}, ${USER_B})`;
});

// ── Admin area ───────────────────────────────────────────────────────────────

describe("route discovery", () => {
  it("finds the admin area (guards against a vacuous pass)", () => {
    expect(adminPages.map(toUrlPath)).toContain("/admin");
  });
});

describe("Common user cannot reach anything Admin by URL", () => {
  const adminUrls = [
    ...adminPages.map(toUrlPath),
    ...adminHandlers.map(toUrlPath),
    // Paths that don't exist yet must be blocked too, not just 404 by accident
    "/admin/users",
    `/admin/users/${SAMPLE_ID}`,
    "/api/admin/users",
    `/api/admin/users/${SAMPLE_ID}/role`,
  ];

  it.each([...new Set(adminUrls)])("proxy blocks %s", async (url) => {
    const token = await signAccessToken({ sub: COMMON, role: "USER" });
    const res = await proxy(
      new NextRequest(`http://localhost:3000${url}`, {
        headers: { cookie: `access_token=${token}` },
      })
    );
    if (isAdminApiPath(url)) {
      expect(res.status).toBe(403);
    } else {
      expect(res.headers.get("x-middleware-rewrite")).toMatch(/\/404$/);
    }
  });

  it.each(adminPages.map((f) => [toUrlPath(f), f]))(
    "page %s calls requireAdminPage() itself",
    (_url, file) => {
      // A layout check doesn't stop a page rendering, so each page must guard itself
      expect(readFileSync(file, "utf8")).toMatch(/requireAdminPage\(\)/);
    }
  );

  // Defence in depth: even if a request got past the proxy, each handler
  // must answer 403 for a Common user. Empty until Phase 10 adds handlers.
  describe.each(adminHandlers.map((f) => [toUrlPath(f), f]))("handler %s", (url, file) => {
    it("returns 403 for a Common user on every method", async () => {
      const mod = await import(/* @vite-ignore */ file);
      const methods = METHODS.filter((m) => typeof mod[m] === "function");
      expect(methods.length).toBeGreaterThan(0);

      for (const method of methods) {
        await loginAs(COMMON, "USER");
        const req = new NextRequest(`http://localhost:3000${url}`, {
          method,
          headers: { "content-type": "application/json" },
          body: method === "GET" || method === "DELETE" ? undefined : "{}",
        });
        const res = await mod[method](req, { params: Promise.resolve({ id: SAMPLE_ID }) });
        expect(res.status, `${method} ${url}`).toBe(403);
      }
    });
  });
});

describe("requireAdmin re-checks the database", () => {
  async function statusOf() {
    try {
      await requireAdmin();
      return 200;
    } catch (err) {
      return handleRouteError(err).status;
    }
  }

  it("allows an active Admin", async () => {
    await loginAs(ADMIN, "ADMIN");
    expect(await statusOf()).toBe(200);
  });

  it("rejects a demoted Admin whose JWT still says ADMIN", async () => {
    await loginAs(DEMOTED, "ADMIN");
    expect(await statusOf()).toBe(403);
  });

  it("rejects a Common user", async () => {
    await loginAs(COMMON, "USER");
    expect(await statusOf()).toBe(403);
  });
});

// ── BR-01 ownership ──────────────────────────────────────────────────────────

describe("user A gets 404 on user B's ids", () => {
  // The pattern every owner-scoped handler follows (Phase 6+)
  async function getIncome(userId: string, id: string) {
    try {
      const row = await withUserDb(userId, (tx) => incomeRepo.findById(tx, parseId(id)));
      return { status: 200, body: requireOwned(row, userId) as unknown };
    } catch (err) {
      const res = handleRouteError(err);
      return { status: res.status, body: (await res.json()) as unknown };
    }
  }

  it("B can read their own income", async () => {
    expect((await getIncome(USER_B, incomeB)).status).toBe(200);
  });

  it("A gets 404, not 403, for B's income", async () => {
    expect((await getIncome(COMMON, incomeB)).status).toBe(404);
  });

  it("someone else's id and a non-existent id are indistinguishable", async () => {
    const othersId = await getIncome(COMMON, incomeB);
    const missingId = await getIncome(COMMON, crypto.randomUUID());
    const malformedId = await getIncome(COMMON, "not-a-uuid");
    expect(othersId).toEqual(missingId);
    expect(othersId).toEqual(malformedId);
  });

  it("an Admin gets 404 on another user's income too (admins never see user data)", async () => {
    expect((await getIncome(ADMIN, incomeB)).status).toBe(404);
  });

  it("the 404 is an ApiError the route layer renders as NOT_FOUND", () => {
    expect(() => requireOwned(undefined, COMMON)).toThrow(ApiError);
  });
});
