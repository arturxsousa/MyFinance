// @vitest-environment node
// BR-03 month boundaries. Runs under several server timezones: Vercel is UTC,
// your laptop is São Paulo — results must not depend on it.
import { describe, it, expect, afterAll } from "vitest";
import {
  todayInTimeZone,
  currentYearMonth,
  monthDateRange,
  shiftMonth,
  isScheduled,
  formatDate,
  formatMonthLabel,
} from "@/lib/date";

const ORIGINAL_TZ = process.env.TZ;
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

const SP = "America/Sao_Paulo";

describe.each(["UTC", "America/Sao_Paulo", "Asia/Tokyo", "Pacific/Kiritimati"])(
  "with the server in %s",
  (serverTz) => {
    process.env.TZ = serverTz;

    it("today in São Paulo follows São Paulo's clock, not the server's", () => {
      process.env.TZ = serverTz;
      // 02:30 UTC on Nov 1st is still 23:30 on Oct 31st in São Paulo (UTC−3)
      const now = new Date("2026-11-01T02:30:00Z");
      expect(todayInTimeZone(SP, now)).toBe("2026-10-31");
      expect(currentYearMonth(SP, now)).toBe("2026-10");
      // …and 03:00 UTC is midnight in São Paulo: November has started
      expect(currentYearMonth(SP, new Date("2026-11-01T03:00:00Z"))).toBe("2026-11");
    });

    it("calendar dates are never shifted", () => {
      process.env.TZ = serverTz;
      expect(formatDate("2026-10-01", "pt-BR", SP)).toBe("01/10/2026");
      expect(formatDate("2026-10-31", "en-US", SP)).toBe("10/31/2026");
      expect(formatMonthLabel("2026-10", "en-US")).toBe("October 2026");
      expect(formatMonthLabel("2026-10", "pt-BR")).toBe("Outubro de 2026");
    });
  }
);

describe("month ranges", () => {
  it.each([
    ["2026-10", "2026-10-01", "2026-10-31"],
    ["2026-11", "2026-11-01", "2026-11-30"],
    ["2026-02", "2026-02-01", "2026-02-28"],
    ["2028-02", "2028-02-01", "2028-02-29"],
    ["2026-12", "2026-12-01", "2026-12-31"],
  ])("%s → %s … %s", (ym, from, to) => {
    expect(monthDateRange(ym)).toEqual({ from, to });
  });

  it.each([
    ["2026-10", 1, "2026-11"],
    ["2026-12", 1, "2027-01"],
    ["2026-01", -1, "2025-12"],
    ["2026-10", -12, "2025-10"],
  ])("shiftMonth(%s, %i) → %s", (ym, delta, expected) => {
    expect(shiftMonth(ym, delta)).toBe(expected);
  });
});

describe("isScheduled (BR-03)", () => {
  const lateOct31 = new Date("2026-11-01T02:30:00Z"); // 23:30 Oct 31 in São Paulo

  it("tomorrow is scheduled, today is not", () => {
    expect(isScheduled("2026-11-01", SP, lateOct31)).toBe(true);
    expect(isScheduled("2026-10-31", SP, lateOct31)).toBe(false);
    expect(isScheduled("2026-10-01", SP, lateOct31)).toBe(false);
  });

  it("depends on the user's timezone", () => {
    // Same instant: already Nov 1st in Tokyo
    expect(isScheduled("2026-11-01", "Asia/Tokyo", lateOct31)).toBe(false);
  });
});
