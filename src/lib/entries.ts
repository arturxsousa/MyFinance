import { z } from "zod";
import { ENTRY_KINDS, type EntryKind } from "@/lib/categories";

// Shared by the entry forms (client) and the /{kind} API (server).
// Messages are i18n keys, translated by the client.

export const PAYMENT_METHODS = ["PIX", "DEBIT", "CREDIT", "CASH", "TRANSFER", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** URL segment ↔ kind: /api/incomes, /api/expenses, /api/investments */
export const KIND_SLUGS = {
  incomes: "INCOME",
  expenses: "EXPENSE",
  investments: "INVESTMENT",
} as const satisfies Record<string, EntryKind>;
export type KindSlug = keyof typeof KIND_SLUGS;

export const kindFromSlug = (slug: string): EntryKind | undefined => KIND_SLUGS[slug as KindSlug];
export const slugFromKind = (kind: EntryKind): KindSlug =>
  (Object.keys(KIND_SLUGS) as KindSlug[]).find((s) => KIND_SLUGS[s] === kind)!;

export const PAGE_SIZE = 20;

// ── Field schemas ────────────────────────────────────────────────────────────

// numeric(14,2): up to 12 integer digits, at most 2 decimals
const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;

/**
 * BR-02: positive, 2 decimals, never a float. Accepts "1234.5" or 1234.5 and
 * normalises to the string "1234.50" — numbers like 0.1 + 0.2 are rejected
 * rather than silently rounded.
 */
export const amountSchema = z
  .union([z.string(), z.number()], { message: "validation.amountFormat" })
  .transform((v) => (typeof v === "number" ? String(v) : v.trim()))
  .refine((v) => AMOUNT_RE.test(v), "validation.amountFormat")
  .refine((v) => Number(v) > 0, "validation.amountPositive")
  .transform((v) => {
    const [int, dec = ""] = v.split(".");
    return `${BigInt(int!).toString()}.${dec.padEnd(2, "0")}`;
  });

/** A real calendar date "YYYY-MM-DD". Future dates are allowed (BR-03: scheduled). */
export const dateSchema = z.string("validation.date").refine((v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    y >= 1900 &&
    y <= 2100 &&
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}, "validation.date");

/** "YYYY-MM" */
export const monthSchema = z
  .string()
  .regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/, "validation.month");

/** Optional free text: trimmed, empty → null */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "validation.tooLong")
    .nullish()
    .transform((v) => v || null);

const categoryId = z.uuid("validation.categoryRequired");

// ── Entry schemas per kind ───────────────────────────────────────────────────

const base = {
  categoryId,
  amount: amountSchema,
  entryDate: dateSchema,
  description: optionalText(120),
  notes: optionalText(500),
};

const extras = {
  INCOME: {},
  EXPENSE: { paymentMethod: z.enum(PAYMENT_METHODS, "validation.invalidOption").default("OTHER") },
  INVESTMENT: { institution: optionalText(80) },
} as const;

// strictObject: userId, recurrenceId, card fields, deletedAt… can't be set by the client
export const createEntrySchemas = {
  INCOME: z.strictObject({ ...base, ...extras.INCOME }),
  EXPENSE: z.strictObject({ ...base, ...extras.EXPENSE }),
  INVESTMENT: z.strictObject({ ...base, ...extras.INVESTMENT }),
} satisfies Record<EntryKind, z.ZodType>;

const atLeastOne = (v: object) => Object.keys(v).length > 0;

export const updateEntrySchemas = {
  INCOME: createEntrySchemas.INCOME.partial().refine(atLeastOne, "validation.required"),
  // .partial() keeps the paymentMethod default — drop it so an update doesn't reset it
  EXPENSE: z
    .strictObject({
      ...base,
      paymentMethod: z.enum(PAYMENT_METHODS, "validation.invalidOption"),
    })
    .partial()
    .refine(atLeastOne, "validation.required"),
  INVESTMENT: createEntrySchemas.INVESTMENT.partial().refine(atLeastOne, "validation.required"),
} satisfies Record<EntryKind, z.ZodType>;

/** UC-11: copy an entry to another date */
export const duplicateEntrySchema = z.strictObject({ entryDate: dateSchema });

export type CreateEntryInput<K extends EntryKind> = z.infer<(typeof createEntrySchemas)[K]>;
export type UpdateEntryInput<K extends EntryKind> = z.infer<(typeof updateEntrySchemas)[K]>;

// ── List query ───────────────────────────────────────────────────────────────

export const ENTRY_SORTS = ["date_desc", "date_asc", "amount_desc", "amount_asc"] as const;
export type EntrySort = (typeof ENTRY_SORTS)[number];

/** GET /{kind}?month=&category=&q=&sort=&page= — month defaults to the current one */
export const listEntriesQuerySchema = z.object({
  month: monthSchema.optional(),
  category: z.uuid("validation.invalid").optional(),
  q: z
    .string()
    .trim()
    .max(100, "validation.tooLong")
    .optional()
    .transform((v) => v || undefined),
  sort: z.enum(ENTRY_SORTS, "validation.invalidOption").default("date_desc"),
  page: z.coerce.number("validation.invalid").int().min(1).max(10_000).default(1),
});

export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>;

export { ENTRY_KINDS, type EntryKind };
