// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  amountSchema,
  dateSchema,
  createEntrySchemas,
  updateEntrySchemas,
  duplicateEntrySchema,
  listEntriesQuerySchema,
  kindFromSlug,
  slugFromKind,
} from "@/lib/entries";
import { createTranslator } from "@/i18n/translator";
import { messages } from "@/i18n/messages";

const CAT = "00000000-0000-4000-8000-000000000001";
const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.error?.issues[0]?.message;

describe("amount (BR-02)", () => {
  it.each([
    ["10", "10.00"],
    ["10.5", "10.50"],
    ["10.55", "10.55"],
    [" 1234.56 ", "1234.56"],
    ["0.01", "0.01"],
    ["007", "7.00"],
    [42, "42.00"],
    [42.5, "42.50"],
    ["999999999999.99", "999999999999.99"],
  ])("%j → %s", (input, expected) => {
    expect(amountSchema.parse(input)).toBe(expected);
  });

  it.each([
    ["three decimals", "10.555"],
    ["comma decimal", "10,50"], // the UI converts locale input before sending
    ["negative", "-5"],
    ["letters", "abc"],
    ["empty", ""],
    ["13 integer digits", "1234567890123"],
    ["float noise", 0.1 + 0.2],
    ["exponent", 1e21],
    ["boolean", true],
  ])("rejects %s as a format error", (_label, input) => {
    expect(firstError(amountSchema.safeParse(input))).toBe("validation.amountFormat");
  });

  it.each(["0", "0.00", 0])("rejects zero (%j) as not positive", (input) => {
    expect(firstError(amountSchema.safeParse(input))).toBe("validation.amountPositive");
  });
});

describe("date", () => {
  it.each(["2026-10-29", "2024-02-29", "2027-01-01" /* future: scheduled */])("accepts %s", (d) => {
    expect(dateSchema.safeParse(d).success).toBe(true);
  });

  it.each([
    "2026-02-29",
    "2026-13-01",
    "2026-04-31",
    "29/10/2026",
    "2026-1-5",
    "1899-12-31",
    "2101-01-01",
    "",
  ])("rejects %s", (d) => {
    expect(firstError(dateSchema.safeParse(d))).toBe("validation.date");
  });
});

describe("create schemas", () => {
  const valid = { categoryId: CAT, amount: "50", entryDate: "2026-10-01" };

  it("normalises a minimal income", () => {
    expect(createEntrySchemas.INCOME.parse(valid)).toEqual({
      ...valid,
      amount: "50.00",
      description: null,
      notes: null,
    });
  });

  it("defaults the expense payment method to OTHER", () => {
    expect(createEntrySchemas.EXPENSE.parse(valid).paymentMethod).toBe("OTHER");
  });

  it("accepts a known payment method and rejects others", () => {
    expect(createEntrySchemas.EXPENSE.parse({ ...valid, paymentMethod: "PIX" }).paymentMethod).toBe(
      "PIX"
    );
    expect(
      createEntrySchemas.EXPENSE.safeParse({ ...valid, paymentMethod: "BITCOIN" }).success
    ).toBe(false);
  });

  it("keeps kind-specific fields to their kind", () => {
    expect(createEntrySchemas.INCOME.safeParse({ ...valid, paymentMethod: "PIX" }).success).toBe(
      false
    );
    expect(createEntrySchemas.EXPENSE.safeParse({ ...valid, institution: "XP" }).success).toBe(
      false
    );
    expect(createEntrySchemas.INVESTMENT.parse({ ...valid, institution: " XP " }).institution).toBe(
      "XP"
    );
  });

  it("trims text and turns blanks into null", () => {
    const out = createEntrySchemas.INCOME.parse({
      ...valid,
      description: "  Salary  ",
      notes: "   ",
    });
    expect(out.description).toBe("Salary");
    expect(out.notes).toBeNull();
  });

  it.each([
    ["description over 120", { description: "x".repeat(121) }, "description", "validation.tooLong"],
    ["notes over 500", { notes: "x".repeat(501) }, "notes", "validation.tooLong"],
    ["institution over 80", { institution: "x".repeat(81) }, "institution", "validation.tooLong"],
    ["missing category", { categoryId: undefined }, "categoryId", "validation.categoryRequired"],
    ["bad category id", { categoryId: "abc" }, "categoryId", "validation.categoryRequired"],
    ["missing amount", { amount: undefined }, "amount", "validation.amountFormat"],
    ["missing date", { entryDate: undefined }, "entryDate", "validation.date"],
  ])("reports %s on the right field", (_label, override, field, message) => {
    const r = createEntrySchemas.INVESTMENT.safeParse({ ...valid, ...override });
    expect(r.success).toBe(false);
    const issue = r.error!.issues.find((i) => i.path[0] === field);
    expect(issue?.message).toBe(message);
  });

  it.each(["userId", "recurrenceId", "deletedAt", "cardPurchaseId", "statementId", "id"])(
    "rejects client-supplied %s",
    (key) => {
      expect(createEntrySchemas.EXPENSE.safeParse({ ...valid, [key]: CAT }).success).toBe(false);
    }
  );
});

describe("update schemas", () => {
  it("accepts a partial update", () => {
    expect(updateEntrySchemas.INCOME.parse({ amount: "12.3" })).toEqual({ amount: "12.30" });
  });

  it("does not reset the payment method when it isn't sent", () => {
    expect(updateEntrySchemas.EXPENSE.parse({ amount: "1" })).not.toHaveProperty("paymentMethod");
  });

  it("rejects an empty update", () => {
    expect(updateEntrySchemas.EXPENSE.safeParse({}).success).toBe(false);
  });

  it("validates the fields it is given", () => {
    expect(updateEntrySchemas.INCOME.safeParse({ amount: "0" }).success).toBe(false);
  });
});

describe("duplicate schema (UC-11)", () => {
  it("only takes a date", () => {
    expect(duplicateEntrySchema.safeParse({ entryDate: "2026-11-01" }).success).toBe(true);
    expect(duplicateEntrySchema.safeParse({ entryDate: "2026-11-01", amount: "5" }).success).toBe(
      false
    );
  });
});

describe("list query", () => {
  it("applies defaults", () => {
    expect(listEntriesQuerySchema.parse({})).toEqual({ sort: "date_desc", page: 1 });
  });

  it("coerces the page from the query string", () => {
    expect(listEntriesQuerySchema.parse({ page: "3" }).page).toBe(3);
  });

  it.each([
    ["bad month", { month: "2026-13" }],
    ["month without dash", { month: "202610" }],
    ["page 0", { page: "0" }],
    ["page not a number", { page: "two" }],
    ["unknown sort", { sort: "random" }],
    ["bad category", { category: "x" }],
  ])("rejects %s", (_label, q) => {
    expect(listEntriesQuerySchema.safeParse(q).success).toBe(false);
  });

  it("treats a blank search as no search", () => {
    expect(listEntriesQuerySchema.parse({ q: "   " }).q).toBeUndefined();
  });
});

describe("kind slugs", () => {
  it("round-trips", () => {
    expect(kindFromSlug("expenses")).toBe("EXPENSE");
    expect(slugFromKind("INVESTMENT")).toBe("investments");
    expect(kindFromSlug("savings")).toBeUndefined();
  });
});

describe("every validation message has a translation", () => {
  it("in both languages", () => {
    const keys = [
      "validation.amountFormat",
      "validation.amountPositive",
      "validation.date",
      "validation.month",
      "validation.categoryRequired",
      "validation.categoryNotFound",
      "validation.categoryKind",
      "validation.categoryArchived",
    ];
    for (const dict of Object.values(messages)) {
      const t = createTranslator(dict);
      for (const k of keys) expect(t.has(k), k).toBe(true);
    }
  });
});
