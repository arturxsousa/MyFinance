import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import argon2 from "argon2";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL_UNPOOLED);

// ── System categories from spec ──────────────────────────────────────────────

const SYSTEM_CATEGORIES = [
  // Income
  { kind: "INCOME", name: "Salary", systemKey: "salary", color: "#22c55e" },
  { kind: "INCOME", name: "Freelance", systemKey: "freelance", color: "#16a34a" },
  { kind: "INCOME", name: "Bonus", systemKey: "bonus", color: "#15803d" },
  { kind: "INCOME", name: "Rental", systemKey: "rental", color: "#166534" },
  { kind: "INCOME", name: "Other", systemKey: "otherIncome", color: "#86efac" },
  // Expense
  { kind: "EXPENSE", name: "Housing", systemKey: "housing", color: "#f97316" },
  { kind: "EXPENSE", name: "Food", systemKey: "food", color: "#ea580c" },
  { kind: "EXPENSE", name: "Transport", systemKey: "transport", color: "#dc2626" },
  { kind: "EXPENSE", name: "Health", systemKey: "health", color: "#e11d48" },
  { kind: "EXPENSE", name: "Education", systemKey: "education", color: "#9333ea" },
  { kind: "EXPENSE", name: "Leisure", systemKey: "leisure", color: "#7c3aed" },
  { kind: "EXPENSE", name: "Bills & Utilities", systemKey: "bills", color: "#4f46e5" },
  { kind: "EXPENSE", name: "Shopping", systemKey: "shopping", color: "#2563eb" },
  { kind: "EXPENSE", name: "Taxes", systemKey: "taxes", color: "#0891b2" },
  { kind: "EXPENSE", name: "Other", systemKey: "otherExpense", color: "#64748b" },
  // Investment
  {
    kind: "INVESTMENT",
    name: "Fixed Income (CDB/Tesouro)",
    systemKey: "fixedIncome",
    color: "#0d9488",
  },
  { kind: "INVESTMENT", name: "Stocks", systemKey: "stocks", color: "#059669" },
  { kind: "INVESTMENT", name: "FIIs", systemKey: "reits", color: "#0284c7" },
  { kind: "INVESTMENT", name: "Crypto", systemKey: "crypto", color: "#7c3aed" },
  { kind: "INVESTMENT", name: "Pension (PGBL/VGBL)", systemKey: "pension", color: "#b45309" },
  { kind: "INVESTMENT", name: "Savings", systemKey: "savings", color: "#15803d" },
  { kind: "INVESTMENT", name: "Other", systemKey: "otherInvestment", color: "#64748b" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function genUuid() {
  return crypto.randomUUID();
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Seeding system categories...");

  for (const cat of SYSTEM_CATEGORIES) {
    const existing = await sql`
      SELECT id FROM category
      WHERE user_id IS NULL AND kind = ${cat.kind} AND lower(name) = lower(${cat.name})
    `;
    if (existing.length > 0) {
      console.log(`  – [${cat.kind}] ${cat.name} (already exists)`);
      continue;
    }
    const id = genUuid();
    await sql`
      INSERT INTO category (id, user_id, kind, name, system_key, color, is_active, created_at, updated_at)
      VALUES (${id}, NULL, ${cat.kind}, ${cat.name}, ${cat.systemKey}, ${cat.color}, true, now(), now())
    `;
    console.log(`  ✓ [${cat.kind}] ${cat.name}`);
  }

  console.log("\nSeeding first Admin user...");

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const firstName = process.env.SEED_ADMIN_FIRST_NAME ?? "Admin";
  const lastName = process.env.SEED_ADMIN_LAST_NAME ?? "User";

  if (!email || !password) {
    console.error("✗ SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required in .env.local");
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const userId = genUuid();

  await sql`
    INSERT INTO app_user (
      id, first_name, last_name, email, password_hash,
      role, status, currency, locale, timezone,
      accepted_terms_at, email_verified_at, created_at, updated_at
    )
    VALUES (
      ${userId}, ${firstName}, ${lastName}, lower(${email}), ${passwordHash},
      'ADMIN', 'ACTIVE', 'BRL', 'pt-BR', 'America/Sao_Paulo',
      now(), now(), now(), now()
    )
    ON CONFLICT (email) DO NOTHING
  `;

  console.log(`  ✓ Admin: ${email}`);
  console.log("\nSeed complete.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
