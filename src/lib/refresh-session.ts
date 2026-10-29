import { db } from "@/db/client";
import { userRepo } from "@/db/repositories/users";
import { refreshTokenRepo } from "@/db/repositories/refresh-tokens";
import { signAccessToken, generateToken, hashToken } from "@/lib/auth";

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// A page load can fire several requests at once with the same expired access
// token (navigation + link prefetches). The first rotates the refresh token;
// the rest arrive holding the just-revoked one. Within this window that is
// treated as a race, not theft.
const ROTATION_GRACE_MS = 30 * 1000;

export type RefreshResult =
  | { ok: true; accessToken: string; refreshToken: string }
  // Lost a concurrent-rotation race: the browser gets the new refresh token
  // from the winning response, so only a fresh access token is issued here.
  | { ok: true; accessToken: string; refreshToken?: undefined }
  | { ok: false };

export async function refreshSession(rawRefreshToken: string): Promise<RefreshResult> {
  const hash = hashToken(rawRefreshToken);

  return db.transaction(async (tx): Promise<RefreshResult> => {
    const token = await refreshTokenRepo.findByHashForUpdate(tx, hash);
    if (!token) return { ok: false };

    if (token.revokedAt) {
      const withinGrace = Date.now() - token.revokedAt.getTime() < ROTATION_GRACE_MS;
      const successor =
        withinGrace && token.replacedById
          ? await refreshTokenRepo.findActiveById(tx, token.replacedById)
          : undefined;

      if (!successor) {
        // Reuse of a revoked token — likely stolen. Kill every session.
        await refreshTokenRepo.revokeAllForUser(tx, token.userId);
        return { ok: false };
      }

      const user = await userRepo.findById(tx, token.userId);
      if (!user || user.status !== "ACTIVE") return { ok: false };
      return { ok: true, accessToken: await signAccessToken({ sub: user.id, role: user.role }) };
    }

    if (token.expiresAt <= new Date()) return { ok: false };

    const user = await userRepo.findById(tx, token.userId);
    if (!user || user.status !== "ACTIVE") return { ok: false };

    const { raw, hash: newHash } = generateToken();
    const next = await refreshTokenRepo.create(tx, {
      userId: user.id,
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: token.userAgent ?? undefined,
      ip: token.ip ?? undefined,
    });
    await refreshTokenRepo.revoke(tx, token.id, next.id);

    const accessToken = await signAccessToken({ sub: user.id, role: user.role });
    return { ok: true, accessToken, refreshToken: raw };
  });
}
