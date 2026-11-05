// Money is an exact decimal string ("1234.50") everywhere — never a float (BR-02).
// Arithmetic goes through integer cents as BigInt, so sums and splits are exact.

const HUNDRED = BigInt(100);

/** "1234.5" → 123450n. Expects a non-negative decimal with at most 2 places. */
export function toCents(amount: string): bigint {
  const [int, dec = ""] = amount.split(".");
  return BigInt(int!) * HUNDRED + BigInt(dec.padEnd(2, "0").slice(0, 2));
}

/** 123450n → "1234.50" */
export function fromCents(cents: bigint): string {
  return `${cents / HUNDRED}.${String(cents % HUNDRED).padStart(2, "0")}`;
}

/** Exact sum of decimal strings */
export function sumAmounts(amounts: string[]): string {
  return fromCents(amounts.reduce((acc, a) => acc + toCents(a), BigInt(0)));
}

/**
 * BR-13: splits a total into n installments. Each is the total divided by n,
 * truncated to the cent; the leftover cents go on installment 1, so the parts
 * always add back up to the total exactly.
 *   splitInstallments("100.00", 3) → ["33.34", "33.33", "33.33"]
 */
export function splitInstallments(total: string, n: number): string[] {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`Invalid installment count: ${n}`);
  const cents = toCents(total);
  const count = BigInt(n);
  const unit = cents / count; // BigInt division truncates
  const first = unit + (cents - unit * count);
  return Array.from({ length: n }, (_, i) => fromCents(i === 0 ? first : unit));
}
