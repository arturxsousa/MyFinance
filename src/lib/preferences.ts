import { z } from "zod";
import { LOCALES } from "@/i18n/config";

// Shared by the profile form (client) and PATCH /api/me (server).
// Currency and timezone labels live in the i18n dictionaries.

export const CURRENCIES = ["BRL", "USD", "EUR", "GBP"] as const;

// Language names are shown in their own language, whatever the UI locale
export const LOCALE_NAMES: Record<(typeof LOCALES)[number], string> = {
  "pt-BR": "Português (Brasil)",
  "en-US": "English (US)",
};

// Curated for the picker; the API accepts any valid IANA zone.
export const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Bahia",
  "America/Fortaleza",
  "America/Recife",
  "America/Belem",
  "America/Manaus",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
  "America/Noronha",
  "Europe/Lisbon",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const;

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// strictObject: unknown keys (role, status, email…) are rejected, not ignored — BR-09.
// Messages are i18n keys, translated by the client.
export const profileSchema = z.strictObject({
  firstName: z.string().trim().min(1, "validation.required").max(60, "validation.tooLong"),
  lastName: z.string().trim().min(1, "validation.required").max(80, "validation.tooLong"),
  currency: z.enum(CURRENCIES, { message: "validation.invalidOption" }),
  locale: z.enum(LOCALES, { message: "validation.invalidOption" }),
  timezone: z.string().max(40).refine(isValidTimeZone, "validation.invalidTimezone"),
});

export type ProfileInput = z.infer<typeof profileSchema>;
