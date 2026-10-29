import { cookies } from "next/headers";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const IS_PROD = process.env.NODE_ENV === "production";

const BASE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  path: "/",
};

export const ACCESS_COOKIE_OPTS = { ...BASE_OPTS, maxAge: 60 * 15 }; // 15 min
export const REFRESH_COOKIE_OPTS = { ...BASE_OPTS, maxAge: 60 * 60 * 24 * 30 }; // 30 days

/** Omit refreshToken to keep the existing refresh cookie. */
export async function setSessionCookies(accessToken: string, refreshToken?: string) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, accessToken, ACCESS_COOKIE_OPTS);
  if (refreshToken) jar.set(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
}

export async function clearSessionCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getSessionCookies() {
  const jar = await cookies();
  return {
    accessToken: jar.get(ACCESS_COOKIE)?.value,
    refreshToken: jar.get(REFRESH_COOKIE)?.value,
  };
}
