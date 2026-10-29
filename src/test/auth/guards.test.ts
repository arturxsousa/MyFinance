// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

const { jar, findById } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  findById: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));

vi.mock("@/db/client", () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) },
}));

vi.mock("@/db/repositories/users", () => ({
  userRepo: { findById: (_tx: unknown, id: string) => findById(id) },
}));

import { requireUser, requireAdmin, requireUserPage, requireAdminPage } from "@/lib/guards";
import { signAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-error";

async function loginAs(role: "USER" | "ADMIN", userId = "user-1") {
  jar.set("access_token", await signAccessToken({ sub: userId, role }));
}

// next/navigation's redirect()/notFound() throw errors tagged via `digest`
async function digestOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    return (err as { digest?: string }).digest ?? String(err);
  }
  throw new Error("expected to throw");
}

async function apiErrorOf(fn: () => Promise<unknown>): Promise<ApiError> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error("expected to throw");
}

beforeEach(() => {
  jar.clear();
  findById.mockReset();
});

describe("requireUser (route handlers)", () => {
  it("returns the session for a valid token", async () => {
    await loginAs("USER");
    expect(await requireUser()).toEqual({ userId: "user-1", role: "USER" });
  });

  it.each([
    ["no cookie", undefined],
    ["invalid token", "garbage"],
  ])("throws 401 with %s", async (_label, token) => {
    if (token) jar.set("access_token", token);
    const err = await apiErrorOf(requireUser);
    expect(err.status).toBe(401);
  });
});

describe("requireAdmin (route handlers)", () => {
  it("allows an active Admin", async () => {
    await loginAs("ADMIN");
    findById.mockResolvedValue({ role: "ADMIN", status: "ACTIVE" });
    expect((await requireAdmin()).role).toBe("ADMIN");
  });

  it("throws 403 for a Common user", async () => {
    await loginAs("USER");
    findById.mockResolvedValue({ role: "USER", status: "ACTIVE" });
    expect((await apiErrorOf(requireAdmin)).status).toBe(403);
  });

  it("throws 403 when the JWT says ADMIN but the user was demoted", async () => {
    await loginAs("ADMIN");
    findById.mockResolvedValue({ role: "USER", status: "ACTIVE" });
    expect((await apiErrorOf(requireAdmin)).status).toBe(403);
  });

  it("throws 403 for a deactivated Admin", async () => {
    await loginAs("ADMIN");
    findById.mockResolvedValue({ role: "ADMIN", status: "INACTIVE" });
    expect((await apiErrorOf(requireAdmin)).status).toBe(403);
  });

  it("throws 401 (not 403) when not logged in, without touching the DB", async () => {
    expect((await apiErrorOf(requireAdmin)).status).toBe(401);
    expect(findById).not.toHaveBeenCalled();
  });
});

describe("page guards", () => {
  it("requireUserPage redirects anonymous users to /login", async () => {
    expect(await digestOf(requireUserPage)).toMatch(/^NEXT_REDIRECT;.*;\/login;/);
  });

  it("requireAdminPage returns the session for an active Admin", async () => {
    await loginAs("ADMIN");
    findById.mockResolvedValue({ role: "ADMIN", status: "ACTIVE" });
    expect((await requireAdminPage()).userId).toBe("user-1");
  });

  it("requireAdminPage 404s for a Common user", async () => {
    await loginAs("USER");
    findById.mockResolvedValue({ role: "USER", status: "ACTIVE" });
    expect(await digestOf(requireAdminPage)).toMatch(/404/);
  });
});
