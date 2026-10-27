import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/refresh", "/api/health"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("access_token")?.value;
  const payload = token ? await verifyAccessToken(token) : null;

  if (!payload) {
    // Expired access token — let the client attempt a silent refresh
    if (token === undefined && req.cookies.has("refresh_token")) {
      const url = req.nextUrl.clone();
      url.pathname = "/api/auth/refresh";
      return NextResponse.rewrite(url);
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const res = NextResponse.next();
  res.headers.set("x-user-id", payload.sub);
  res.headers.set("x-user-role", payload.role);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
