import { pgTable, uuid, varchar, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { appUser } from "./users";
import { entryKindEnum } from "./enums";

export const category = pgTable(
  "category",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // null = system default (Admin-managed)
    userId: uuid("user_id").references(() => appUser.id, { onDelete: "cascade" }),
    kind: entryKindEnum("kind").notNull(),
    name: varchar("name", { length: 50 }).notNull(),
    // Stable id for system categories, used to translate their name (null for user rows)
    systemKey: varchar("system_key", { length: 40 }).unique(),
    color: varchar("color", { length: 7 }).notNull().default("#888888"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // Unique per (user_or_system, kind, name) — mirrors spec's partial unique index
    uniqueIndex("ux_category_name").on(
      sql`COALESCE(${t.userId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      t.kind,
      sql`lower(${t.name})`
    ),
  ]
);
