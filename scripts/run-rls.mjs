import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL_UNPOOLED);

const script = readFileSync("drizzle/manual/rls.sql", "utf8");

// Split on Neon's statement separator and filter empties
const statements = script
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("--"));

for (const statement of statements) {
  try {
    await sql.query(statement);
    console.log("✓", statement.slice(0, 60).replace(/\n/g, " "));
  } catch (err) {
    console.error("✗", statement.slice(0, 60).replace(/\n/g, " "));
    console.error("  ", err.message);
    process.exit(1);
  }
}

console.log("\nRLS setup complete.");
