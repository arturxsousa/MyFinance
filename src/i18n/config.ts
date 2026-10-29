export const LOCALES = ["pt-BR", "en-US"] as const;
export type Locale = (typeof LOCALES)[number];

/** Used when the browser asks for neither Portuguese nor English */
export const FALLBACK_LOCALE: Locale = "en-US";

export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Picks the best supported locale from an Accept-Language header. */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { lang: tag!.trim().toLowerCase().split("-")[0], q: q ? Number(q.split("=")[1]) : 1 };
    })
    .filter((e) => e.lang && e.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { lang } of ranked) {
    if (lang === "pt") return "pt-BR";
    if (lang === "en") return "en-US";
  }
  return FALLBACK_LOCALE;
}

/** The saved choice (cookie) wins; otherwise the browser's language. */
export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null
): Locale {
  return isLocale(cookieValue) ? cookieValue : matchLocale(acceptLanguage);
}
