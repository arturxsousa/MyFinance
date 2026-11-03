// @vitest-environment node
// Phase 7 step 3 — the cron endpoint only runs the generator for the right secret.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { generateDueEntries } = vi.hoisted(() => ({ generateDueEntries: vi.fn() }));
vi.mock("@/lib/recurrence-generator", () => ({ generateDueEntries }));

import { GET } from "@/app/api/cron/recurrences/route";

const SECRET = "test-cron-secret";
const call = (authorization?: string) =>
  GET(
    new NextRequest("http://localhost:3000/api/cron/recurrences", {
      headers: authorization ? { authorization } : {},
    })
  );

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  generateDueEntries.mockReset();
  generateDueEntries.mockResolvedValue({ checked: 3, created: 2, skippedArchived: 1, failed: 0 });
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/recurrences", () => {
  it("runs the generator and returns its result for the right secret", async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checked: 3, created: 2, skippedArchived: 1, failed: 0 });
    expect(generateDueEntries).toHaveBeenCalledOnce();
  });

  it.each([
    ["no header", undefined],
    ["wrong secret", "Bearer nope"],
    ["secret without Bearer", SECRET],
    ["longer secret", `Bearer ${SECRET}x`],
  ])("rejects %s with 401", async (_, header) => {
    const res = await call(header);
    expect(res.status).toBe(401);
    expect(generateDueEntries).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await call("Bearer ");
    expect(res.status).toBe(503);
    expect(generateDueEntries).not.toHaveBeenCalled();
  });
});
