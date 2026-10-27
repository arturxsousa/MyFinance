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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { appUser } from "./users";
import { category } from "./categories";
import { cardBrandEnum, statementStatusEnum } from "./enums";

export const creditCard = pgTable(
  "credit_card",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    brand: cardBrandEnum("brand").notNull().default("OTHER"),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
    closingDay: smallint("closing_day").notNull(),
    dueDay: smallint("due_day").notNull(),
    color: varchar("color", { length: 7 }).notNull().default("#888888"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [unique("ux_credit_card_name").on(t.userId, t.name)]
);

export const cardStatement = pgTable(
  "card_statement",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => creditCard.id, { onDelete: "cascade" }),
    // First day of the due month (e.g. 2026-11-01)
    referenceMonth: date("reference_month").notNull(),
    closingDate: date("closing_date").notNull(),
    dueDate: date("due_date").notNull(),
    status: statementStatusEnum("status").notNull().default("OPEN"),
    paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }),
    paidAt: date("paid_at"),
  },
  (t) => [
    unique("ux_statement_card_month").on(t.cardId, t.referenceMonth),
    index("ix_statement_user").on(t.userId),
  ]
);

export const cardPurchase = pgTable(
  "card_purchase",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => creditCard.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id),
    description: varchar("description", { length: 120 }),
    purchaseDate: date("purchase_date").notNull(),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    installments: smallint("installments").notNull().default(1),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("ix_card_purchase_user").on(t.userId)]
);
