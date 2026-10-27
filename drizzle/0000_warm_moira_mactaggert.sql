CREATE TYPE "public"."card_brand" AS ENUM('VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."entry_kind" AS ENUM('INCOME', 'EXPENSE', 'INVESTMENT');--> statement-breakpoint
CREATE TYPE "public"."pay_method" AS ENUM('CASH', 'PIX', 'DEBIT', 'CREDIT', 'TRANSFER', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."statement_status" AS ENUM('OPEN', 'CLOSED', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'USER');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('PENDING', 'ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(60) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"status" "user_status" DEFAULT 'PENDING' NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"locale" varchar(10) DEFAULT 'pt-BR' NOT NULL,
	"timezone" varchar(40) DEFAULT 'America/Sao_Paulo' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"accepted_terms_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(40) NOT NULL,
	"target_type" varchar(30),
	"target_id" uuid,
	"metadata" text,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" varchar(20) NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "auth_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "refresh_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" "entry_kind" NOT NULL,
	"name" varchar(50) NOT NULL,
	"color" varchar(7) DEFAULT '#888888' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"description" varchar(120),
	"amount" numeric(14, 2) NOT NULL,
	"entry_date" date NOT NULL,
	"payment_method" varchar(20) DEFAULT 'OTHER' NOT NULL,
	"recurrence_id" uuid,
	"card_purchase_id" uuid,
	"statement_id" uuid,
	"installment_number" smallint,
	"notes" varchar(500),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_expense_recurrence_date" UNIQUE("recurrence_id","entry_date"),
	CONSTRAINT "ux_installment" UNIQUE("card_purchase_id","installment_number")
);
--> statement-breakpoint
CREATE TABLE "income" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"description" varchar(120),
	"amount" numeric(14, 2) NOT NULL,
	"entry_date" date NOT NULL,
	"recurrence_id" uuid,
	"notes" varchar(500),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_income_recurrence_date" UNIQUE("recurrence_id","entry_date")
);
--> statement-breakpoint
CREATE TABLE "investment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"description" varchar(120),
	"amount" numeric(14, 2) NOT NULL,
	"entry_date" date NOT NULL,
	"institution" varchar(80),
	"recurrence_id" uuid,
	"notes" varchar(500),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_investment_recurrence_date" UNIQUE("recurrence_id","entry_date")
);
--> statement-breakpoint
CREATE TABLE "recurrence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "entry_kind" NOT NULL,
	"category_id" uuid NOT NULL,
	"description" varchar(120),
	"amount" numeric(14, 2) NOT NULL,
	"day_of_month" smallint NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"last_generated_on" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"description" varchar(120),
	"purchase_date" date NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"installments" smallint DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_statement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"reference_month" date NOT NULL,
	"closing_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" "statement_status" DEFAULT 'OPEN' NOT NULL,
	"paid_amount" numeric(14, 2),
	"paid_at" date,
	CONSTRAINT "ux_statement_card_month" UNIQUE("card_id","reference_month")
);
--> statement-breakpoint
CREATE TABLE "credit_card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"brand" "card_brand" DEFAULT 'OTHER' NOT NULL,
	"credit_limit" numeric(14, 2),
	"closing_day" smallint NOT NULL,
	"due_day" smallint NOT NULL,
	"color" varchar(7) DEFAULT '#888888' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_credit_card_name" UNIQUE("user_id","name")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_token" ADD CONSTRAINT "auth_token_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_recurrence_id_recurrence_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."recurrence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_recurrence_id_recurrence_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."recurrence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment" ADD CONSTRAINT "investment_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment" ADD CONSTRAINT "investment_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment" ADD CONSTRAINT "investment_recurrence_id_recurrence_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."recurrence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence" ADD CONSTRAINT "recurrence_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence" ADD CONSTRAINT "recurrence_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_purchase" ADD CONSTRAINT "card_purchase_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_purchase" ADD CONSTRAINT "card_purchase_card_id_credit_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."credit_card"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_purchase" ADD CONSTRAINT "card_purchase_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_statement" ADD CONSTRAINT "card_statement_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_statement" ADD CONSTRAINT "card_statement_card_id_credit_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."credit_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card" ADD CONSTRAINT "credit_card_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_audit_log_actor" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "ix_audit_log_created" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ix_refresh_token_user" ON "refresh_token" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_category_name" ON "category" USING btree (COALESCE("user_id", '00000000-0000-0000-0000-000000000000'::uuid),"kind",lower("name"));--> statement-breakpoint
CREATE INDEX "ix_expense_user_date" ON "expense" USING btree ("user_id","entry_date") WHERE "expense"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ix_expense_statement" ON "expense" USING btree ("statement_id") WHERE "expense"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ix_income_user_date" ON "income" USING btree ("user_id","entry_date") WHERE "income"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ix_investment_user_date" ON "investment" USING btree ("user_id","entry_date") WHERE "investment"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ix_card_purchase_user" ON "card_purchase" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_statement_user" ON "card_statement" USING btree ("user_id");