const DEFAULT_CURRENCY = "BRL";
const DEFAULT_LOCALE = "pt-BR";

export function formatMoney(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Parses a localised string like "1.234,56" or "1,234.56" into a number.
export function parseMoneyInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

// Rounds to 2 decimal places using banker's truncation (matches BR-13 / numeric(14,2)).
export function toDecimal(value: number): number {
  return Math.trunc(value * 100) / 100;
}

// Splits a total into N installments: truncates each, remainder goes on the first (BR-13).
export function splitInstallments(total: number, n: number): number[] {
  const unit = Math.trunc((total * 100) / n);
  const remainder = Math.round(total * 100) - unit * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? (unit + remainder) / 100 : unit / 100));
}
