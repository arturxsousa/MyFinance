import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL_UNPOOLED);

const script = readFileSync("drizzle/manual/rls.sql", "utf8");

// Drop comment lines first: a statement preceded by a comment must still run.
const statements = script
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

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
