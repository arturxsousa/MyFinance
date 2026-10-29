import "@testing-library/jest-dom/vitest";
import { config } from "dotenv";

// Load env before any module (db client, auth secret) reads process.env at import time
config({ path: ".env.local", quiet: true });
