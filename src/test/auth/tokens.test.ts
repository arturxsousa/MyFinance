// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { signAccessToken, verifyAccessToken, generateToken, hashToken } from "@/lib/auth";

afterEach(() => {
  vi.useRealTimers();
});

describe("access token (JWT)", () => {
  it("round-trips sub and role", async () => {
    const token = await signAccessToken({ sub: "user-1", role: "ADMIN" });
    expect(await verifyAccessToken(token)).toEqual({ sub: "user-1", role: "ADMIN" });
  });

  it("rejects a tampered token", async () => {
    const token = await signAccessToken({ sub: "user-1", role: "USER" });
    const [header, , sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "user-1", role: "ADMIN" })).toString(
      "base64url"
    );
    expect(await verifyAccessToken(`${header}.${forged}.${sig}`)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifyAccessToken("not-a-jwt")).toBeNull();
  });

  it("expires after 15 minutes", async () => {
    vi.useFakeTimers();
    const token = await signAccessToken({ sub: "user-1", role: "USER" });

    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(await verifyAccessToken(token)).not.toBeNull();

    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(await verifyAccessToken(token)).toBeNull();
  });
});

describe("opaque tokens", () => {
  it("generates a random 64-char hex token whose hash matches hashToken", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.raw).toMatch(/^[0-9a-f]{64}$/);
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).toBe(hashToken(a.raw));
    expect(a.hash).not.toBe(a.raw);
  });
});
