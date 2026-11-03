import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { generateDueEntries } from "@/lib/recurrence-generator";

// A catch-up run can insert many entries; give it room beyond the default
export const maxDuration = 60;

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>` (sent by Vercel Cron) */
function isAuthorized(req: NextRequest, secret: string) {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily job (BR-07): creates the entries of every recurrence that is due.
 * Safe to call any number of times — the generator is idempotent.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: without a secret configured, nobody may trigger the job
  if (!secret) return errorResponse("CRON_DISABLED", "CRON_SECRET is not configured", 503);
  if (!isAuthorized(req, secret)) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const result = await generateDueEntries();
  console.info("[cron] recurrences", result);
  return NextResponse.json(result);
}
