import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  date,
  smallint,
  timestamp,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { appUser } from "./users";
import { category } from "./categories";
import { entryKindEnum, payMethodEnum } from "./enums";

export const recurrence = pgTable(
  "recurrence",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    kind: entryKindEnum("kind").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id),
    description: varchar("description", { length: 120 }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    dayOfMonth: smallint("day_of_month").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    lastGeneratedOn: date("last_generated_on"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    check("ck_recurrence_amount_positive", sql`${t.amount} > 0`),
    // BR-07: days 29–31 aren't offered in v1
    check("ck_recurrence_day_of_month", sql`${t.dayOfMonth} BETWEEN 1 AND 28`),
  ]
);

export const income = pgTable(
  "income",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id),
    description: varchar("description", { length: 120 }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    entryDate: date("entry_date").notNull(),
    recurrenceId: uuid("recurrence_id").references(() => recurrence.id, {
      onDelete: "set null",
    }),
    notes: varchar("notes", { length: 500 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // BR-02: amounts are always positive; the sign comes from the kind
    check("ck_income_amount_positive", sql`${t.amount} > 0`),
    index("ix_income_user_date")
      .on(t.userId, t.entryDate)
      .where(sql`${t.deletedAt} IS NULL`),
    unique("ux_income_recurrence_date").on(t.recurrenceId, t.entryDate),
  ]
);

export const expense = pgTable(
  "expense",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id),
    description: varchar("description", { length: 120 }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    entryDate: date("entry_date").notNull(),
    paymentMethod: payMethodEnum("payment_method").notNull().default("OTHER"),
    recurrenceId: uuid("recurrence_id").references(() => recurrence.id, {
      onDelete: "set null",
    }),
    // Card purchase fields (null for non-card expenses)
    cardPurchaseId: uuid("card_purchase_id"),
    statementId: uuid("statement_id"),
    installmentNumber: smallint("installment_number"),
    notes: varchar("notes", { length: 500 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // BR-02: amounts are always positive; the sign comes from the kind
    check("ck_expense_amount_positive", sql`${t.amount} > 0`),
    index("ix_expense_user_date")
      .on(t.userId, t.entryDate)
      .where(sql`${t.deletedAt} IS NULL`),
    index("ix_expense_statement")
      .on(t.statementId)
      .where(sql`${t.deletedAt} IS NULL`),
    unique("ux_expense_recurrence_date").on(t.recurrenceId, t.entryDate),
    unique("ux_installment").on(t.cardPurchaseId, t.installmentNumber),
  ]
);

export const investment = pgTable(
  "investment",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id),
    description: varchar("description", { length: 120 }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    entryDate: date("entry_date").notNull(),
    institution: varchar("institution", { length: 80 }),
    recurrenceId: uuid("recurrence_id").references(() => recurrence.id, {
      onDelete: "set null",
    }),
    notes: varchar("notes", { length: 500 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // BR-02: amounts are always positive; the sign comes from the kind
    check("ck_investment_amount_positive", sql`${t.amount} > 0`),
    index("ix_investment_user_date")
      .on(t.userId, t.entryDate)
      .where(sql`${t.deletedAt} IS NULL`),
    unique("ux_investment_recurrence_date").on(t.recurrenceId, t.entryDate),
  ]
);
