import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "crypto";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);

// ── Access token (JWT, 15 min) ────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string; // userId
  role: "USER" | "ADMIN";
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sub !== "string" || !payload.role) return null;
    return { sub: payload.sub, role: payload.role as AccessTokenPayload["role"] };
  } catch {
    return null;
  }
}

// ── Refresh / auth tokens (opaque, stored hashed in DB) ──────────────────────

export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
