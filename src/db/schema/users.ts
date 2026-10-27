import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  inet,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { userRoleEnum, userStatusEnum } from "./enums";

export const appUser = pgTable("app_user", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  firstName: varchar("first_name", { length: 60 }).notNull(),
  lastName: varchar("last_name", { length: 80 }).notNull(),
  // citext extension handles case-insensitive uniqueness at DB level
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("USER"),
  status: userStatusEnum("status").notNull().default("PENDING"),
  currency: varchar("currency", { length: 3 }).notNull().default("BRL"),
  locale: varchar("locale", { length: 10 }).notNull().default("pt-BR"),
  timezone: varchar("timezone", { length: 40 }).notNull().default("America/Sao_Paulo"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const refreshToken = pgTable(
  "refresh_token",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ip: inet("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("ix_refresh_token_user").on(t.userId)]
);

export const authToken = pgTable("auth_token", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => appUser.id, { onDelete: "cascade" }),
  purpose: varchar("purpose", { length: 20 }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actorId: uuid("actor_id").references(() => appUser.id, { onDelete: "set null" }),
    action: varchar("action", { length: 40 }).notNull(),
    targetType: varchar("target_type", { length: 30 }),
    targetId: uuid("target_id"),
    metadata: text("metadata"), // stored as JSON string; jsonb mapped via .$type<object>()
    ip: inet("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("ix_audit_log_actor").on(t.actorId), index("ix_audit_log_created").on(t.createdAt)]
);

// Separate index for case-insensitive email lookups (mirrors citext behaviour)
export const ixUserEmail = uniqueIndex("ux_user_email").on(sql`lower(${appUser.email})`);
