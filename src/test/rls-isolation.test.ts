// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql, isNull } from "drizzle-orm";
import { config } from "dotenv";
import * as schema from "@/db/schema";

config({ path: ".env.local" });

neonConfig.webSocketConstructor = WebSocket;

// Owner connection via HTTP (no transactions needed for setup/teardown)
const rawSql = neon(process.env.DATABASE_URL_UNPOOLED!);

// Owner connection via WebSocket (supports transactions for RLS testing)
const ownerPool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED! });
const ownerDb = drizzle(ownerPool, { schema });

const USER_A = crypto.randomUUID();
const USER_B = crypto.randomUUID();

beforeAll(async () => {
  const categories = await rawSql`
    SELECT id FROM category WHERE user_id IS NULL AND kind = 'INCOME' LIMIT 1
  `;
  const categoryId: string = categories[0].id;

  await rawSql`
    INSERT INTO app_user (id, first_name, last_name, email, password_hash, role, status,
      currency, locale, timezone, accepted_terms_at, email_verified_at, created_at, updated_at)
    VALUES
      (${USER_A}, 'RLS', 'UserA', ${`rls_a_${USER_A}@test.internal`}, 'x', 'USER', 'ACTIVE',
        'BRL', 'pt-BR', 'America/Sao_Paulo', now(), now(), now(), now()),
      (${USER_B}, 'RLS', 'UserB', ${`rls_b_${USER_B}@test.internal`}, 'x', 'USER', 'ACTIVE',
        'BRL', 'pt-BR', 'America/Sao_Paulo', now(), now(), now(), now())
  `;

  await rawSql`
    INSERT INTO income (id, user_id, category_id, amount, entry_date, created_at, updated_at)
    VALUES (gen_random_uuid(), ${USER_A}, ${categoryId}, '99.00', CURRENT_DATE, now(), now())
  `;
});

afterAll(async () => {
  await rawSql`DELETE FROM app_user WHERE id = ${USER_A}`;
  await rawSql`DELETE FROM app_user WHERE id = ${USER_B}`;
  await ownerPool.end();
});

describe("RLS isolation", () => {
  it("user B cannot see user A income when RLS is enforced", async () => {
    // SET LOCAL ROLE app_user_rw enforces RLS (neondb_owner bypasses it by default)
    const rows = await ownerDb.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE app_user_rw`);
      await tx.execute(sql`SELECT set_config('app.user_id', ${USER_B}, true)`);
      return tx.select().from(schema.income).where(isNull(schema.income.deletedAt));
    });

    expect(rows).toHaveLength(0);
  });

  it("user A can see their own income when RLS is enforced", async () => {
    const rows = await ownerDb.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE app_user_rw`);
      await tx.execute(sql`SELECT set_config('app.user_id', ${USER_A}, true)`);
      return tx.select().from(schema.income).where(isNull(schema.income.deletedAt));
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(USER_A);
  });
});
