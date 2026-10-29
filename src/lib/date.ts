import { formatInTimeZone } from "date-fns-tz";

// Two kinds of dates live in this app:
// - Calendar dates ("YYYY-MM-DD": entry_date) have no time and no timezone.
//   They must never be shifted, or "2026-10-01" becomes 30/09 on a UTC server.
// - Instants (timestamps) are shown in the user's timezone.
// The timezone matters for one more thing: what "today" is (BR-03).

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_LOCALE = "pt-BR";

function parseCalendarDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d ?? 1));
}

/** Today's calendar date in the user's timezone, "YYYY-MM-DD". */
export function todayInTimeZone(timezone: string = DEFAULT_TIMEZONE, now = new Date()): string {
  return formatInTimeZone(now, timezone, "yyyy-MM-dd");
}

/** "YYYY-MM" for the current month in the user's timezone. */
export function currentYearMonth(timezone: string = DEFAULT_TIMEZONE, now = new Date()): string {
  return todayInTimeZone(timezone, now).slice(0, 7);
}

/** First and last calendar day of a "YYYY-MM" month, inclusive. */
export function monthDateRange(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { from: `${yearMonth}-01`, to: `${yearMonth}-${String(lastDay).padStart(2, "0")}` };
}

/** "2026-10" + 1 → "2026-11"; "2026-01" − 1 → "2025-12" */
export function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10-31" + 1 → "2026-11-01" */
export function addDays(date: string, days: number): string {
  const d = parseCalendarDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** BR-03: entries dated after today (in the user's timezone) are "scheduled". */
export function isScheduled(
  entryDate: string,
  timezone: string = DEFAULT_TIMEZONE,
  now = new Date()
) {
  return entryDate > todayInTimeZone(timezone, now); // ISO dates compare as strings
}

/**
 * Calendar date → "29/10/2026" (pt-BR) or "10/29/2026" (en-US).
 * A Date instance is treated as an instant and shown in `timezone`.
 */
export function formatDate(
  date: Date | string,
  locale: string = DEFAULT_LOCALE,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const isCalendar = typeof date === "string";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: isCalendar ? "UTC" : timezone,
  }).format(isCalendar ? parseCalendarDate(date) : date);
}

/** "2026-09" → "September" / "setembro" — for inline text like "vs. setembro" */
export function formatMonthName(yearMonth: string, locale: string = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
    parseCalendarDate(yearMonth)
  );
}

/** "2026-10" → "October 2026" / "Outubro de 2026" */
export function formatMonthLabel(yearMonth: string, locale: string = DEFAULT_LOCALE): string {
  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseCalendarDate(yearMonth));
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}
