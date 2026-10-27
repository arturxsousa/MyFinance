import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "USER"]);
export const userStatusEnum = pgEnum("user_status", ["PENDING", "ACTIVE", "INACTIVE"]);
export const entryKindEnum = pgEnum("entry_kind", ["INCOME", "EXPENSE", "INVESTMENT"]);
export const payMethodEnum = pgEnum("pay_method", [
  "CASH",
  "PIX",
  "DEBIT",
  "CREDIT",
  "TRANSFER",
  "OTHER",
]);
export const cardBrandEnum = pgEnum("card_brand", [
  "VISA",
  "MASTERCARD",
  "ELO",
  "AMEX",
  "HIPERCARD",
  "OTHER",
]);
export const statementStatusEnum = pgEnum("statement_status", ["OPEN", "CLOSED", "PAID"]);
