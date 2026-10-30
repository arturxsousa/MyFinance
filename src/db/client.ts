import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Node.js 22+ and browsers provide WebSocket globally.
// Vercel's Node.js 22 runtime also has it; no ws polyfill needed.
neonConfig.webSocketConstructor = WebSocket;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

// Neon closes idle WebSocket connections. Without a listener, that surfaces as
// an uncaught "[object ErrorEvent]" that fails the in-flight request (and can
// take the process down). The pool discards the dead client and opens a new one.
pool.on("error", (err: Error) => {
  console.error("[db] idle client error — connection discarded:", err?.message ?? err);
});

export const db = drizzle(pool, { schema });

export type Db = typeof db;
