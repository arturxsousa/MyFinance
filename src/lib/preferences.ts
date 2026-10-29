import { z } from "zod";

// Shared by the profile form (client) and PATCH /api/me (server).

export const CURRENCIES = [
  { value: "BRL", label: "Real (R$)" },
  { value: "USD", label: "US Dollar (US$)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "Pound Sterling (£)" },
] as const;

export const LOCALES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
] as const;

// Curated for the picker; the API accepts any valid IANA zone.
export const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (São Paulo, Rio, BH, Sul)" },
  { value: "America/Bahia", label: "Bahia (Salvador)" },
  { value: "America/Fortaleza", label: "Fortaleza (Nordeste)" },
  { value: "America/Recife", label: "Recife" },
  { value: "America/Belem", label: "Belém (Pará, Amapá)" },
  { value: "America/Manaus", label: "Manaus (Amazonas)" },
  { value: "America/Cuiaba", label: "Cuiabá (Mato Grosso)" },
  { value: "America/Campo_Grande", label: "Campo Grande (Mato Grosso do Sul)" },
  { value: "America/Porto_Velho", label: "Porto Velho (Rondônia)" },
  { value: "America/Boa_Vista", label: "Boa Vista (Roraima)" },
  { value: "America/Rio_Branco", label: "Rio Branco (Acre)" },
  { value: "America/Noronha", label: "Fernando de Noronha" },
  { value: "Europe/Lisbon", label: "Lisbon" },
  { value: "Europe/London", label: "London" },
  { value: "America/New_York", label: "New York" },
  { value: "UTC", label: "UTC" },
] as const;

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const values = <T extends readonly { value: string }[]>(list: T) =>
  list.map((i) => i.value) as [T[number]["value"], ...T[number]["value"][]];

// strictObject: unknown keys (role, status, email…) are rejected, not ignored — BR-09
export const profileSchema = z.strictObject({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  currency: z.enum(values(CURRENCIES)),
  locale: z.enum(values(LOCALES)),
  timezone: z.string().max(40).refine(isValidTimeZone, "Invalid timezone"),
});

export type ProfileInput = z.infer<typeof profileSchema>;
