import { shiftMonth } from "@/lib/date";

// Pure date logic shared by the generator (creates real entries) and the
// projections (shows "Projected" rows), so both always agree on the dates.
// All dates are calendar strings "YYYY-MM-DD"; ISO strings compare correctly.

export interface Schedule {
  dayOfMonth: number; // 1–28 (BR-07), so every month has the day
  startDate: string;
  endDate: string | null;
}

/** The recurrence's date in `month` ("YYYY-MM"), or null if outside its start/end window. */
export function occurrenceIn(month: string, s: Schedule): string | null {
  const date = `${month}-${String(s.dayOfMonth).padStart(2, "0")}`;
  if (date < s.startDate) return null;
  if (s.endDate && date > s.endDate) return null;
  return date;
}

/** Safety cap on catch-up: never create more than this many entries in one run */
export const MAX_CATCH_UP = 36;

/**
 * Occurrence dates strictly after `after` (the last one generated) up to and
 * including `until` (today in the user's timezone). Catches up on missed runs.
 */
export function dueOccurrences(s: Schedule, after: string | null, until: string): string[] {
  const dates: string[] = [];
  let month = (after ?? s.startDate).slice(0, 7);
  const lastMonth = until.slice(0, 7);
  while (month <= lastMonth && dates.length < MAX_CATCH_UP) {
    const date = occurrenceIn(month, s);
    if (date && date <= until && (!after || date > after)) dates.push(date);
    month = shiftMonth(month, 1);
  }
  return dates;
}
