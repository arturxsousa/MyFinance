// @vitest-environment node
// Exact money helpers (BR-02) and the installment split (BR-13).
import { describe, it, expect } from "vitest";
import { fromCents, splitInstallments, sumAmounts, toCents } from "@/lib/money";

describe("toCents / fromCents", () => {
  it.each([
    ["0.01", BigInt(1)],
    ["1", BigInt(100)],
    ["1.5", BigInt(150)],
    ["1234.56", BigInt(123456)],
    ["999999999999.99", BigInt("99999999999999")],
  ])("%s ↔ %s cents", (amount, cents) => {
    expect(toCents(amount)).toBe(cents);
  });

  it("formats back with two decimals", () => {
    expect(fromCents(BigInt(5))).toBe("0.05");
    expect(fromCents(BigInt(0))).toBe("0.00");
    expect(fromCents(BigInt(123450))).toBe("1234.50");
    expect(fromCents(BigInt("99999999999999"))).toBe("999999999999.99");
  });
});

describe("sumAmounts", () => {
  it("adds decimal strings exactly", () => {
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30");
    expect(sumAmounts(["999999999999.99", "0.01"])).toBe("1000000000000.00");
    expect(sumAmounts([])).toBe("0.00");
  });
});

describe("splitInstallments (BR-13)", () => {
  it("truncates each part and puts the leftover cents on installment 1", () => {
    expect(splitInstallments("100.00", 3)).toEqual(["33.34", "33.33", "33.33"]);
    expect(splitInstallments("10.00", 3)).toEqual(["3.34", "3.33", "3.33"]);
    expect(splitInstallments("0.05", 3)).toEqual(["0.03", "0.01", "0.01"]);
  });

  it("returns equal parts when the total divides evenly", () => {
    expect(splitInstallments("1200.00", 12)).toEqual(Array(12).fill("100.00"));
  });

  it("a single installment is the total", () => {
    expect(splitInstallments("1234.56", 1)).toEqual(["1234.56"]);
  });

  it("works where floats go wrong", () => {
    // 0.1 + 0.2 territory, and a total whose float * 100 isn't an integer
    expect(splitInstallments("0.30", 2)).toEqual(["0.15", "0.15"]);
    expect(splitInstallments("1.15", 2)).toEqual(["0.58", "0.57"]);
    expect(splitInstallments("999999999999.99", 48)[0]).toBe("20833333333.48");
  });

  it.each([
    ["100.00", 3],
    ["4999.90", 10],
    ["1.15", 2],
    ["0.48", 48],
    ["123456.78", 7],
    ["999999999999.99", 48],
  ])("parts of %s in %i always add back up to the total", (total, n) => {
    const parts = splitInstallments(total, n);
    expect(parts).toHaveLength(n);
    expect(sumAmounts(parts)).toBe(total);
    // installment 1 is never smaller, and the rest are identical
    expect(toCents(parts[0]!)).toBeGreaterThanOrEqual(toCents(parts[1] ?? parts[0]!));
    expect(new Set(parts.slice(1)).size).toBeLessThanOrEqual(1);
  });

  it.each([0, -1, 1.5, NaN])("rejects an installment count of %s", (n) => {
    expect(() => splitInstallments("10.00", n)).toThrow(RangeError);
  });
});
