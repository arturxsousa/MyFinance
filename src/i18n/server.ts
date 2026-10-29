import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./config";
import { messages } from "./messages";
import { createTranslator } from "./translator";

/** Request locale: saved cookie, else the browser's Accept-Language. */
export const getLocale = cache(async (): Promise<Locale> => {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  return resolveLocale(jar.get(LOCALE_COOKIE)?.value, h.get("accept-language"));
});

export async function getT() {
  return createTranslator(messages[await getLocale()]);
}
