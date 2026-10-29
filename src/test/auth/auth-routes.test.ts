// @vitest-environment node
//
// Integration tests for the Phase 3 auth routes that work without email.
// Handlers run against the real Neon database; `next/headers` cookies are mocked.
// Forgot/reset password and email verification are not covered here: email
// (Resend) is on standby, so those flows are not live yet.
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import argon2 from "argon2";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as refresh } from "@/app/api/auth/refresh/route";
import { POST as changePassword } from "@/app/api/me/password/route";
import { verifyAccessToken, hashToken } from "@/lib/auth";
import { refreshSession } from "@/lib/refresh-session";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);

// Every user created here gets this prefix so afterAll can clean up precisely
const RUN = crypto.randomUUID().slice(0, 8);
const PASSWORD = "Sup3rSecret!";
let seq = 0;
const newEmail = () => `p3_${RUN}_${++seq}@test.internal`;

function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function registerUser(
  email = newEmail(),
  password = PASSWORD,
  headers: Record<string, string> = {}
) {
  const res = await register(
    post(
      "/api/auth/register",
      { firstName: "Test", lastName: "User", email, password, acceptedTerms: true },
      headers
    )
  );
  expect(res.status).toBe(200);
  return email;
}

async function insertUser(status: "PENDING" | "INACTIVE", email = newEmail()) {
  const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  await sql`
    INSERT INTO app_user (first_name, last_name, email, password_hash, role, status, accepted_terms_at)
    VALUES ('Test', 'User', ${email}, ${hash}, 'USER', ${status}, now())
  `;
  return email;
}

const doLogin = (email: string, password = PASSWORD) =>
  login(post("/api/auth/login", { email, password }));

async function getUser(email: string) {
  const rows = await sql`SELECT * FROM app_user WHERE lower(email) = lower(${email})`;
  return rows[0];
}

async function auditActions(email: string) {
  const rows = await sql`
    SELECT a.action FROM audit_log a JOIN app_user u ON u.id = a.actor_id
    WHERE lower(u.email) = lower(${email}) ORDER BY a.created_at
  `;
  return rows.map((r) => r.action as string);
}

beforeEach(() => {
  jar.clear();
});

afterAll(async () => {
  const pattern = `p3_${RUN}_%`;
  await sql`
    DELETE FROM audit_log WHERE actor_id IN (SELECT id FROM app_user WHERE email LIKE ${pattern})
  `;
  await sql`DELETE FROM app_user WHERE email LIKE ${pattern}`;
});

// ── UC-01 Sign-up ─────────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  it("creates an ACTIVE user with an Argon2id hash and normalised email", async () => {
    const email = newEmail().toUpperCase();
    await registerUser(email);

    const user = await getUser(email);
    expect(user.email).toBe(email.toLowerCase());
    expect(user.status).toBe("ACTIVE"); // email verification on standby
    expect(user.role).toBe("USER");
    expect(user.password_hash).toMatch(/^\$argon2id\$/);
    expect(user.accepted_terms_at).not.toBeNull();
  });

  it.each([
    ["pt-BR,pt;q=0.9,en;q=0.8", "pt-BR"],
    ["en-US,en;q=0.9", "en-US"],
    ["fr-FR", "en-US"],
  ])("saves the browser language %s as locale %s", async (acceptLanguage, locale) => {
    const email = await registerUser(newEmail(), PASSWORD, { "accept-language": acceptLanguage });
    expect((await getUser(email)).locale).toBe(locale);
  });

  it("returns i18n keys, not English text, in field errors", async () => {
    const email = await registerUser();
    const res = await register(
      post("/api/auth/register", {
        firstName: "",
        lastName: "User",
        email,
        password: "short",
        acceptedTerms: true,
      })
    );
    const { fields } = (await res.json()).error;
    expect(fields.firstName[0]).toBe("validation.required");
    expect(fields.password[0]).toMatch(/^validation\./);
  });

  it("rejects a duplicate email case-insensitively with 409", async () => {
    const email = await registerUser();
    const res = await register(
      post("/api/auth/register", {
        firstName: "Dup",
        lastName: "User",
        email: email.toUpperCase(),
        password: PASSWORD,
        acceptedTerms: true,
      })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("EMAIL_TAKEN");
  });

  it.each([
    ["weak password", { password: "abcdefgh" }, "password"],
    ["terms not accepted", { acceptedTerms: false }, "acceptedTerms"],
    ["invalid email", { email: "not-an-email" }, "email"],
    ["missing first name", { firstName: "" }, "firstName"],
  ])("returns 422 for %s", async (_label, override, field) => {
    const res = await register(
      post("/api/auth/register", {
        firstName: "Test",
        lastName: "User",
        email: newEmail(),
        password: PASSWORD,
        acceptedTerms: true,
        ...override,
      })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields[field]).toBeDefined();
  });
});

// ── UC-03 Login ───────────────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  it("sets session cookies, returns the user without the hash, and audits LOGIN", async () => {
    const email = await registerUser();
    const res = await doLogin(email.toUpperCase());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(email);
    expect(body.user).not.toHaveProperty("passwordHash");

    const payload = await verifyAccessToken(jar.get("access_token")!);
    expect(payload?.role).toBe("USER");
    expect(jar.get("refresh_token")).toMatch(/^[0-9a-f]{64}$/);
    expect(jar.get("locale")).toBe("en-US"); // remembered for the UI language

    expect((await getUser(email)).last_login_at).not.toBeNull();
    expect(await auditActions(email)).toContain("LOGIN");
  });

  it("returns the same generic 401 for wrong password and unknown email", async () => {
    const email = await registerUser();
    const wrong = await doLogin(email, "Wrong-pass1");
    const unknown = await doLogin(newEmail());

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(jar.size).toBe(0);
  });

  it.each(["PENDING", "INACTIVE"] as const)("refuses a %s account", async (status) => {
    const email = await insertUser(status);
    const res = await doLogin(email);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("ACCOUNT_INACTIVE");
  });

  it("locks the account after 5 failed attempts, even with the right password", async () => {
    const email = await registerUser();

    for (let i = 1; i <= 4; i++) {
      expect((await doLogin(email, "Wrong-pass1")).status).toBe(401);
    }
    const fifth = await doLogin(email, "Wrong-pass1");
    expect(fifth.status).toBe(403);
    expect((await fifth.json()).error.code).toBe("ACCOUNT_LOCKED");

    const correct = await doLogin(email);
    expect(correct.status).toBe(403);
    expect((await correct.json()).error.code).toBe("ACCOUNT_LOCKED");

    const user = await getUser(email);
    expect(user.failed_login_count).toBe(5);
    expect(new Date(user.locked_until).getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect((await auditActions(email)).filter((a) => a === "LOGIN_FAILED")).toHaveLength(5);
  });

  it("allows login once the lock has expired and resets the counter", async () => {
    const email = await registerUser();
    await sql`
      UPDATE app_user SET failed_login_count = 5, locked_until = now() - interval '1 minute'
      WHERE email = ${email}
    `;
    expect((await doLogin(email)).status).toBe(200);
    const user = await getUser(email);
    expect(user.failed_login_count).toBe(0);
    expect(user.locked_until).toBeNull();
  });

  it("resets the failed counter after a successful login", async () => {
    const email = await registerUser();
    await doLogin(email, "Wrong-pass1");
    await doLogin(email, "Wrong-pass1");
    expect((await doLogin(email)).status).toBe(200);
    expect((await getUser(email)).failed_login_count).toBe(0);
  });
});

// ── Refresh-token rotation ────────────────────────────────────────────────────

describe("POST /api/auth/refresh", () => {
  it("returns 401 without a refresh cookie", async () => {
    expect((await refresh()).status).toBe(401);
  });

  it("rotates the refresh token and issues a new access token", async () => {
    const email = await registerUser();
    await doLogin(email);
    const oldRefresh = jar.get("refresh_token");

    const res = await refresh();
    expect(res.status).toBe(200);
    expect(jar.get("refresh_token")).not.toBe(oldRefresh);
    expect(await verifyAccessToken(jar.get("access_token")!)).not.toBeNull();
  });

  it("detects reuse of a rotated token and revokes every session", async () => {
    const email = await registerUser();
    await doLogin(email);
    const stolen = jar.get("refresh_token")!;

    await refresh(); // legitimate rotation
    const current = jar.get("refresh_token")!;

    // Past the concurrent-rotation grace window
    await sql`
      UPDATE refresh_token SET revoked_at = now() - interval '1 minute'
      WHERE token_hash = ${hashToken(stolen)}
    `;

    jar.set("refresh_token", stolen); // attacker replays the old token
    const replay = await refresh();
    expect(replay.status).toBe(401);
    expect(jar.has("refresh_token")).toBe(false);

    jar.set("refresh_token", current); // legitimate user is logged out too
    expect((await refresh()).status).toBe(401);
  });

  it("tolerates concurrent refreshes of the same token (page load + prefetches)", async () => {
    const email = await registerUser();
    await doLogin(email);
    const token = jar.get("refresh_token")!;

    const results = await Promise.all([1, 2, 3].map(() => refreshSession(token)));

    expect(results.every((r) => r.ok)).toBe(true);
    // Exactly one request rotated; the others only got a new access token
    expect(results.filter((r) => r.ok && r.refreshToken)).toHaveLength(1);

    const user = await getUser(email);
    const active = await sql`
      SELECT id FROM refresh_token WHERE user_id = ${user.id} AND revoked_at IS NULL
    `;
    expect(active).toHaveLength(1);
  });

  it("gives no grace once the replacement token has been revoked (e.g. logout)", async () => {
    const email = await registerUser();
    await doLogin(email);
    const old = jar.get("refresh_token")!;

    await refresh();
    await logout(); // revokes the replacement

    jar.set("refresh_token", old);
    expect((await refresh()).status).toBe(401);
  });

  it("a token ended by logout elsewhere is rejected without killing other sessions", async () => {
    const email = await registerUser();
    await doLogin(email); // device A
    const deviceA = jar.get("refresh_token")!;
    await doLogin(email); // device B
    const deviceB = jar.get("refresh_token")!;

    jar.set("refresh_token", deviceA);
    await logout(); // A logs out, but suppose a stale tab still sends A's cookie
    jar.set("refresh_token", deviceA);
    expect((await refresh()).status).toBe(401);

    jar.set("refresh_token", deviceB);
    expect((await refresh()).status).toBe(200);
  });

  it("rejects an expired refresh token", async () => {
    const email = await registerUser();
    await doLogin(email);
    const user = await getUser(email);
    await sql`UPDATE refresh_token SET expires_at = now() - interval '1 second' WHERE user_id = ${user.id}`;
    expect((await refresh()).status).toBe(401);
  });
});

// ── UC-04 Logout ──────────────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  it("revokes the refresh token server-side and clears cookies", async () => {
    const email = await registerUser();
    await doLogin(email);
    const refreshToken = jar.get("refresh_token")!;

    expect((await logout()).status).toBe(200);
    expect(jar.has("access_token")).toBe(false);
    expect(jar.has("refresh_token")).toBe(false);
    expect(jar.has("locale")).toBe(true); // UI language survives logout

    jar.set("refresh_token", refreshToken);
    expect((await refresh()).status).toBe(401);
  });

  it("succeeds even without a session", async () => {
    expect((await logout()).status).toBe(200);
  });
});

// ── UC-06 Change password ─────────────────────────────────────────────────────

describe("POST /api/me/password", () => {
  async function loggedIn() {
    const email = await registerUser();
    await doLogin(email);
    // Session comes from the mocked cookie jar, filled by doLogin
    const change = (body: unknown) => changePassword(post("/api/me/password", body));
    return { email, change };
  }

  it("requires authentication", async () => {
    const res = await changePassword(
      post("/api/me/password", { currentPassword: PASSWORD, newPassword: "Br4ndNewPass" })
    );
    expect(res.status).toBe(401);
  });

  it("changes the password when the current one is correct", async () => {
    const { email, change } = await loggedIn();
    const res = await change({ currentPassword: PASSWORD, newPassword: "Br4ndNewPass" });
    expect(res.status).toBe(200);
    expect((await doLogin(email)).status).toBe(401);
    expect((await doLogin(email, "Br4ndNewPass")).status).toBe(200);
    expect(await auditActions(email)).toContain("PASSWORD_CHANGE");
  });

  it("signs out other devices but keeps the current session", async () => {
    const email = await registerUser();
    await doLogin(email); // device A
    const deviceA = jar.get("refresh_token")!;
    await doLogin(email); // device B — the one changing the password
    const deviceB = jar.get("refresh_token")!;

    const res = await changePassword(
      post("/api/me/password", { currentPassword: PASSWORD, newPassword: "Br4ndNewPass" })
    );
    expect(res.status).toBe(200);

    jar.set("refresh_token", deviceA);
    expect((await refresh()).status).toBe(401);

    jar.set("refresh_token", deviceB);
    expect((await refresh()).status).toBe(200);
  });

  it("returns translatable field errors", async () => {
    const { change } = await loggedIn();
    const wrong = await (
      await change({ currentPassword: "Wrong-pass1", newPassword: "Br4ndNewPass" })
    ).json();
    expect(wrong.error.fields.currentPassword).toEqual(["password.wrongCurrent"]);
    const same = await (await change({ currentPassword: PASSWORD, newPassword: PASSWORD })).json();
    expect(same.error.fields.newPassword).toEqual(["password.sameAsCurrent"]);
  });

  it("rejects a wrong current password", async () => {
    const { change } = await loggedIn();
    const res = await change({ currentPassword: "Wrong-pass1", newPassword: "Br4ndNewPass" });
    expect((await res.json()).error.code).toBe("WRONG_PASSWORD");
  });

  it("rejects reusing the current password", async () => {
    const { change } = await loggedIn();
    const res = await change({ currentPassword: PASSWORD, newPassword: PASSWORD });
    expect((await res.json()).error.code).toBe("SAME_PASSWORD");
  });

  it("enforces the password policy on the new password", async () => {
    const { change } = await loggedIn();
    const res = await change({ currentPassword: PASSWORD, newPassword: "password123" });
    expect(res.status).toBe(422);
  });
});
