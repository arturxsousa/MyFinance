import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Node.js 22+ and browsers provide WebSocket globally.
// Vercel's Node.js 22 runtime also has it; no ws polyfill needed.
neonConfig.webSocketConstructor = WebSocket;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export const db = drizzle(pool, { schema });

export type Db = typeof db;
