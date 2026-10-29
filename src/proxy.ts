import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, type AccessTokenPayload } from "@/lib/auth";
import { errorResponse } from "@/lib/api-error";
import { refreshSession, type RefreshResult } from "@/lib/refresh-session";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_COOKIE_OPTS,
  REFRESH_COOKIE_OPTS,
} from "@/lib/session";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/health",
];

const AUTH_ONLY_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

const isUnder = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(base + "/");

interface ResolvedSession {
  payload: AccessTokenPayload | null;
  /** New tokens minted by a silent refresh, to be written back as cookies */
  refreshed?: Extract<RefreshResult, { ok: true }>;
  /** The refresh cookie was rejected and should be cleared */
  clear?: boolean;
}

// Valid access token → use it. Expired/missing but refresh cookie present →
// rotate silently so the user isn't logged out every 15 minutes.
async function resolveSession(req: NextRequest): Promise<ResolvedSession> {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const payload = accessToken ? await verifyAccessToken(accessToken) : null;
  if (payload) return { payload };

  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return { payload: null };

  const result = await refreshSession(refreshToken);
  if (!result.ok) return { payload: null, clear: true };

  return { payload: await verifyAccessToken(result.accessToken), refreshed: result };
}

function applyCookies(res: NextResponse, session: ResolvedSession) {
  if (session.refreshed) {
    res.cookies.set(ACCESS_COOKIE, session.refreshed.accessToken, ACCESS_COOKIE_OPTS);
    if (session.refreshed.refreshToken) {
      res.cookies.set(REFRESH_COOKIE, session.refreshed.refreshToken, REFRESH_COOKIE_OPTS);
    }
  } else if (session.clear) {
    res.cookies.delete(ACCESS_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
  }
  return res;
}

/** Continue to the app; a refreshed access token is also forwarded on the request
 *  so server components and route handlers see it in this same request. */
function next(req: NextRequest, session: ResolvedSession) {
  if (!session.refreshed) return NextResponse.next();
  req.cookies.set(ACCESS_COOKIE, session.refreshed.accessToken);
  return NextResponse.next({ request: { headers: new Headers(req.headers) } });
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAuthOnly = AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p));
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Public API/pages that don't care who is logged in — skip session work
  if (isPublic && !isAuthOnly) return NextResponse.next();

  const session = await resolveSession(req);

  // Logged-in users should not access auth pages
  if (isAuthOnly) {
    const res = session.payload
      ? NextResponse.redirect(new URL("/dashboard", req.url))
      : NextResponse.next();
    return applyCookies(res, session);
  }

  if (!session.payload) {
    // API callers (fetch) need a JSON 401 they can handle, not the login page's HTML
    if (isUnder(pathname, "/api")) {
      return applyCookies(errorResponse("UNAUTHORIZED", "Not authenticated", 401), session);
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return applyCookies(NextResponse.redirect(loginUrl), session);
  }

  // Coarse gate on the JWT role so no /admin route is reachable by a Common
  // user, even one someone forgot to guard. Pages and handlers still call
  // requireAdmin*, which re-checks the DB (a demoted Admin's JWT is stale).
  if (session.payload.role !== "ADMIN") {
    if (isUnder(pathname, "/api/admin")) {
      return applyCookies(errorResponse("FORBIDDEN", "Admin access required", 403), session);
    }
    if (isUnder(pathname, "/admin")) {
      // Rewrite to an unmatched path → Next's not-found page with a 404 status
      return applyCookies(NextResponse.rewrite(new URL("/404", req.url)), session);
    }
  }

  const res = applyCookies(next(req, session), session);
  res.headers.set("x-user-id", session.payload.sub);
  res.headers.set("x-user-role", session.payload.role);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
