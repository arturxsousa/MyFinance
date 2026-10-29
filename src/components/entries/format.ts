import type { EntryKind } from "@/lib/entries";

/** Amounts are exact decimal strings; Number() is only for display formatting. */
export function formatAmount(amount: string, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amount));
}

/** Accent per kind — matches the sidebar icons: in, out, saved */
export const KIND_ACCENT: Record<EntryKind, string> = {
  INCOME: "text-emerald-600 dark:text-emerald-400",
  EXPENSE: "text-rose-600 dark:text-rose-400",
  INVESTMENT: "text-sky-600 dark:text-sky-400",
};
