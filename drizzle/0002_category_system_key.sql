ALTER TABLE "category" ADD COLUMN "system_key" varchar(40);--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_system_key_unique" UNIQUE("system_key");--> statement-breakpoint
-- Only system rows (user_id IS NULL) may carry a system_key
ALTER TABLE "category" ADD CONSTRAINT "category_system_key_only_system" CHECK ("system_key" IS NULL OR "user_id" IS NULL);--> statement-breakpoint
-- Backfill keys for the seeded system categories (names were stored in English)
UPDATE "category" SET "system_key" = 'salary' WHERE "user_id" IS NULL AND "kind" = 'INCOME' AND "name" = 'Salary';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'freelance' WHERE "user_id" IS NULL AND "kind" = 'INCOME' AND "name" = 'Freelance';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'bonus' WHERE "user_id" IS NULL AND "kind" = 'INCOME' AND "name" = 'Bonus';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'rental' WHERE "user_id" IS NULL AND "kind" = 'INCOME' AND "name" = 'Rental';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'otherIncome' WHERE "user_id" IS NULL AND "kind" = 'INCOME' AND "name" = 'Other';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'housing' WHERE "user_id" IS NULL AND "kind" = 'EXPENSE' AND "name" = 'Housing';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'food' WHERE "user_id" IS NULL AND "kind" = 'EXPENSE' AND "name" = 'Food';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'transport' WHERE "user_id" IS NULL AND "kind" = 'EXPENSE' AND "name" = 'Transport';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'health' WHERE "user_id" IS NULL AND "kind" = 'EXPENSE' AND "name" = 'Health';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'education' WHERE "user_id" IS NULL AND "kind" = 'EXPENSE' AND "name" = 'Education';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'leisure' WHERE "user_id" IS NULL AND "kind" = 'EXPENSE' AND "name" = 'Leisure';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'bills' WHERE "user_id" IS NULL AND "kind" = 'EXPENSE' AND "name" = 'Bills & Utilities';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'shopping' WHERE "user_id" IS NULL AND "kind" = 'EXPENSE' AND "name" = 'Shopping';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'taxes' WHERE "user_id" IS NULL AND "kind" = 'EXPENSE' AND "name" = 'Taxes';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'otherExpense' WHERE "user_id" IS NULL AND "kind" = 'EXPENSE' AND "name" = 'Other';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'fixedIncome' WHERE "user_id" IS NULL AND "kind" = 'INVESTMENT' AND "name" = 'Fixed Income (CDB/Tesouro)';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'stocks' WHERE "user_id" IS NULL AND "kind" = 'INVESTMENT' AND "name" = 'Stocks';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'reits' WHERE "user_id" IS NULL AND "kind" = 'INVESTMENT' AND "name" = 'FIIs';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'crypto' WHERE "user_id" IS NULL AND "kind" = 'INVESTMENT' AND "name" = 'Crypto';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'pension' WHERE "user_id" IS NULL AND "kind" = 'INVESTMENT' AND "name" = 'Pension (PGBL/VGBL)';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'savings' WHERE "user_id" IS NULL AND "kind" = 'INVESTMENT' AND "name" = 'Savings';--> statement-breakpoint
UPDATE "category" SET "system_key" = 'otherInvestment' WHERE "user_id" IS NULL AND "kind" = 'INVESTMENT' AND "name" = 'Other';
