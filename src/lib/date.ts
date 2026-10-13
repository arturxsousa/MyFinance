import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ptBR, enUS } from "date-fns/locale";
import type { Locale } from "date-fns";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_LOCALE = "pt-BR";

const LOCALE_MAP: Record<string, Locale> = {
  "pt-BR": ptBR,
  "en-US": enUS,
};

function getLocale(locale: string = DEFAULT_LOCALE): Locale {
  return LOCALE_MAP[locale] ?? ptBR;
}

// Format a date for display (dd/MM/yyyy or MM/dd/yyyy depending on locale).
export function formatDate(
  date: Date | string,
  locale: string = DEFAULT_LOCALE,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  const zoned = toZonedTime(d, timezone);
  const pattern = locale === "en-US" ? "MM/dd/yyyy" : "dd/MM/yyyy";
  return format(zoned, pattern, { locale: getLocale(locale) });
}

// Returns the start and end of a given month string "YYYY-MM" in the user's timezone.
// BR-03: month boundaries are in the user's timezone.
export function getMonthBoundaries(
  yearMonth: string,
  timezone: string = DEFAULT_TIMEZONE
): { start: Date; end: Date } {
  const [year, month] = yearMonth.split("-").map(Number);
  // Build the first day of the month at midnight in the target timezone
  const localMidnight = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const zoned = toZonedTime(localMidnight, timezone);
  return {
    start: startOfMonth(zoned),
    end: endOfMonth(zoned),
  };
}

// Returns "YYYY-MM" for the current month in the user's timezone.
export function currentYearMonth(timezone: string = DEFAULT_TIMEZONE): string {
  const now = toZonedTime(new Date(), timezone);
  return format(now, "yyyy-MM");
}

// Formats a month string "YYYY-MM" as "October 2026" or "Outubro de 2026".
export function formatMonthLabel(
  yearMonth: string,
  locale: string = DEFAULT_LOCALE,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = toZonedTime(new Date(year, month - 1, 1), timezone);
  const pattern = locale === "en-US" ? "MMMM yyyy" : "MMMM 'de' yyyy";
  return format(d, pattern, { locale: getLocale(locale) });
}
