-- Drop the varchar default first: it can't be cast automatically during the type change
ALTER TABLE "expense" ALTER COLUMN "payment_method" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "expense" ALTER COLUMN "payment_method" SET DATA TYPE "public"."pay_method" USING "payment_method"::"public"."pay_method";--> statement-breakpoint
ALTER TABLE "expense" ALTER COLUMN "payment_method" SET DEFAULT 'OTHER'::"public"."pay_method";--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "ck_expense_amount_positive" CHECK ("expense"."amount" > 0);--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "ck_income_amount_positive" CHECK ("income"."amount" > 0);--> statement-breakpoint
ALTER TABLE "investment" ADD CONSTRAINT "ck_investment_amount_positive" CHECK ("investment"."amount" > 0);--> statement-breakpoint
ALTER TABLE "recurrence" ADD CONSTRAINT "ck_recurrence_amount_positive" CHECK ("recurrence"."amount" > 0);--> statement-breakpoint
ALTER TABLE "recurrence" ADD CONSTRAINT "ck_recurrence_day_of_month" CHECK ("recurrence"."day_of_month" BETWEEN 1 AND 28);