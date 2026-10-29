// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { refreshSession } = vi.hoisted(() => ({ refreshSession: vi.fn() }));
vi.mock("@/lib/refresh-session", () => ({ refreshSession }));

import { proxy } from "@/proxy";
import { signAccessToken, verifyAccessToken } from "@/lib/auth";

function request(path: string, accessToken?: string, refreshToken?: string) {
  const cookies = [
    accessToken && `access_token=${accessToken}`,
    refreshToken && `refresh_token=${refreshToken}`,
  ].filter(Boolean);
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookies.length ? { cookie: cookies.join("; ") } : {},
  });
}

beforeEach(() => {
  refreshSession.mockReset();
});

describe("proxy (route protection)", () => {
  it("redirects anonymous users to /login with ?next", async () => {
    const res = await proxy(request("/dashboard"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });

  it("treats an invalid token as anonymous", async () => {
    const res = await proxy(request("/dashboard", "bogus"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it.each(["/login", "/register", "/api/auth/login", "/api/health"])(
    "lets anonymous users reach public path %s",
    async (path) => {
      const res = await proxy(request(path));
      expect(res.headers.get("location")).toBeNull();
    }
  );

  it("lets authenticated users through and forwards identity headers", async () => {
    const token = await signAccessToken({ sub: "user-1", role: "USER" });
    const res = await proxy(request("/dashboard", token));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-user-id")).toBe("user-1");
    expect(res.headers.get("x-user-role")).toBe("USER");
  });

  it.each(["/login", "/register", "/forgot-password", "/reset-password"])(
    "redirects authenticated users away from %s",
    async (path) => {
      const token = await signAccessToken({ sub: "user-1", role: "USER" });
      const res = await proxy(request(path, token));
      expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
    }
  );

  it("does not touch the DB when there is no refresh cookie", async () => {
    await proxy(request("/dashboard"));
    expect(refreshSession).not.toHaveBeenCalled();
  });
});

describe("proxy (silent refresh)", () => {
  async function refreshedTo(role: "USER" | "ADMIN", rotate = true) {
    const accessToken = await signAccessToken({ sub: "user-1", role });
    refreshSession.mockResolvedValue({
      ok: true,
      accessToken,
      refreshToken: rotate ? "new-refresh" : undefined,
    });
    return accessToken;
  }

  it("refreshes an expired session and lets the request through", async () => {
    const accessToken = await refreshedTo("USER");
    const res = await proxy(request("/dashboard", "expired", "old-refresh"));

    expect(refreshSession).toHaveBeenCalledWith("old-refresh");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-user-id")).toBe("user-1");
    expect(res.cookies.get("access_token")?.value).toBe(accessToken);
    expect(res.cookies.get("refresh_token")?.value).toBe("new-refresh");
  });

  it("forwards the new access token to the app in the same request", async () => {
    await refreshedTo("USER");
    const res = await proxy(request("/dashboard", undefined, "old-refresh"));
    // Next encodes request-header overrides on the response for the server to apply
    const forwarded = res.headers.get("x-middleware-request-cookie");
    const token = forwarded?.match(/access_token=([^;]+)/)?.[1];
    expect(token && (await verifyAccessToken(token))?.sub).toBe("user-1");
  });

  it("keeps the existing refresh cookie when it lost a rotation race", async () => {
    await refreshedTo("USER", false);
    const res = await proxy(request("/dashboard", undefined, "old-refresh"));
    expect(res.cookies.get("access_token")).toBeDefined();
    expect(res.cookies.get("refresh_token")).toBeUndefined();
  });

  it("redirects to /login and clears cookies when the refresh is rejected", async () => {
    refreshSession.mockResolvedValue({ ok: false });
    const res = await proxy(request("/dashboard", "expired", "revoked"));

    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(res.cookies.get("access_token")?.value).toBe("");
    expect(res.cookies.get("refresh_token")?.value).toBe("");
  });

  it("redirects a refreshable session away from /login to /dashboard", async () => {
    await refreshedTo("USER");
    const res = await proxy(request("/login", undefined, "old-refresh"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
    expect(res.cookies.get("refresh_token")?.value).toBe("new-refresh");
  });

  it("skips refresh on public API routes", async () => {
    await proxy(request("/api/auth/login", undefined, "old-refresh"));
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
