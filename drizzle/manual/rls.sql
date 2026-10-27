-- =============================================================
-- RLS setup — run once per database (dev + production)
-- Must be run as neondb_owner (the migration role), NOT app_user_rw
-- =============================================================

-- 1. App role — no BYPASSRLS, no login (Neon uses connection strings per role)
CREATE ROLE IF NOT EXISTS app_user_rw;

-- Allow neondb_owner to SET LOCAL ROLE app_user_rw in transactions (needed for RLS tests)
GRANT app_user_rw TO neondb_owner;

-- 2. Grant usage on schema
GRANT USAGE ON SCHEMA public TO app_user_rw;

-- 3. Grant table-level access (all current + future tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user_rw;

-- 4. Grant sequence usage (for bigint identity on audit_log)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO app_user_rw;

-- =============================================================
-- 5. Enable RLS + owner policy on every user-owned table
--    The app sets: SET LOCAL app.user_id = '<uuid>' inside each transaction
-- =============================================================

-- app_user (users can read/update their own row)
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_user_owner ON app_user;
CREATE POLICY app_user_owner ON app_user
  USING (id = current_setting('app.user_id')::uuid)
  WITH CHECK (id = current_setting('app.user_id')::uuid);

-- category (system rows have user_id = NULL — readable by all authenticated users)
ALTER TABLE category ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS category_owner ON category;
CREATE POLICY category_owner ON category
  USING (user_id IS NULL OR user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

-- recurrence
ALTER TABLE recurrence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recurrence_owner ON recurrence;
CREATE POLICY recurrence_owner ON recurrence
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

-- income
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS income_owner ON income;
CREATE POLICY income_owner ON income
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

-- expense
ALTER TABLE expense ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expense_owner ON expense;
CREATE POLICY expense_owner ON expense
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

-- investment
ALTER TABLE investment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS investment_owner ON investment;
CREATE POLICY investment_owner ON investment
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

-- credit_card
ALTER TABLE credit_card ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_card_owner ON credit_card;
CREATE POLICY credit_card_owner ON credit_card
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

-- card_statement
ALTER TABLE card_statement ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS card_statement_owner ON card_statement;
CREATE POLICY card_statement_owner ON card_statement
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

-- card_purchase
ALTER TABLE card_purchase ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS card_purchase_owner ON card_purchase;
CREATE POLICY card_purchase_owner ON card_purchase
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

-- refresh_token
ALTER TABLE refresh_token ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refresh_token_owner ON refresh_token;
CREATE POLICY refresh_token_owner ON refresh_token
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

-- auth_token (no RLS — looked up by token_hash before user_id is known)
-- audit_log (no RLS — written by the app role, read only by Admin API, never by users directly)
