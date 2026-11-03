import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { appUser } from "@/db/schema/users";
import { category } from "@/db/schema/categories";
import { expense, income, investment, recurrence } from "@/db/schema/entries";
import { todayInTimeZone } from "@/lib/date";
import { dueOccurrences } from "@/lib/recurrence-schedule";

const TABLES = { INCOME: income, EXPENSE: expense, INVESTMENT: investment } as const;

export interface GeneratorResult {
  /** Active recurrences looked at */
  checked: number;
  /** Entries actually inserted */
  created: number;
  /** Recurrences skipped because their category is archived (BR-06) */
  skippedArchived: number;
  /** Recurrences whose generation failed — logged; the others still run */
  failed: number;
}

/**
 * BR-07: creates each month's entry on day_of_month, for every active
 * recurrence of every active user, catching up on missed days.
 *
 * Idempotent: the UNIQUE (recurrence_id, entry_date) constraint plus
 * ON CONFLICT DO NOTHING means running twice — or two runs at once — never
 * creates a duplicate. A generated entry the user soft-deleted still holds its
 * slot, so it isn't recreated.
 *
 * Runs as the database owner (a system job across all users, like migrations),
 * so RLS doesn't apply; every insert sets user_id from the recurrence.
 */
export async function generateDueEntries(
  now = new Date(),
  /** Limit the run to these users (tests, support tooling). Default: everyone. */
  opts: { userIds?: string[] } = {}
): Promise<GeneratorResult> {
  const rows = await db
    .select({ rec: recurrence, timezone: appUser.timezone, categoryActive: category.isActive })
    .from(recurrence)
    .innerJoin(appUser, eq(appUser.id, recurrence.userId))
    .innerJoin(category, eq(category.id, recurrence.categoryId))
    .where(
      and(
        eq(recurrence.isActive, true),
        eq(appUser.status, "ACTIVE"),
        opts.userIds ? inArray(recurrence.userId, opts.userIds) : undefined
      )
    );

  const result: GeneratorResult = {
    checked: rows.length,
    created: 0,
    skippedArchived: 0,
    failed: 0,
  };

  for (const { rec, timezone, categoryActive } of rows) {
    const today = todayInTimeZone(timezone, now); // the user's day, not the server's
    const dates = dueOccurrences(rec, rec.lastGeneratedOn, today);
    if (dates.length === 0) continue;

    // BR-06: archived categories can't receive new entries. Leave last_generated_on
    // alone so the missed months are caught up if the category is reactivated.
    if (!categoryActive) {
      result.skippedArchived++;
      continue;
    }

    const table = TABLES[rec.kind];
    try {
      await generateFor(rec, table, dates, result);
    } catch (err) {
      // One bad recurrence must not stop everyone else's salary from appearing
      result.failed++;
      console.error(`[recurrences] generation failed for ${rec.id}:`, err);
    }
  }

  return result;
}

async function generateFor(
  rec: typeof recurrence.$inferSelect,
  table: (typeof TABLES)[keyof typeof TABLES],
  dates: string[],
  result: GeneratorResult
) {
  const created = await db.transaction(async (tx) => {
    let count = 0;
    for (const entryDate of dates) {
      const inserted = await tx
        .insert(table)
        .values({
          userId: rec.userId,
          categoryId: rec.categoryId,
          amount: rec.amount,
          entryDate,
          description: rec.description,
          recurrenceId: rec.id,
          ...(rec.kind === "EXPENSE" && { paymentMethod: rec.paymentMethod ?? "OTHER" }),
          ...(rec.kind === "INVESTMENT" && { institution: rec.institution }),
        } as never)
        .onConflictDoNothing({ target: [table.recurrenceId, table.entryDate] })
        .returning({ id: table.id });
      count += inserted.length;
    }
    await tx
      .update(recurrence)
      .set({ lastGeneratedOn: dates.at(-1)!, updatedAt: new Date() })
      .where(eq(recurrence.id, rec.id));
    return count;
  });
  result.created += created; // only after the commit succeeded
}
