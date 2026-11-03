import { z } from "zod";
import type { RecurrenceRow } from "@/db/repositories/recurrences";
import { amountSchema, dateSchema } from "@/lib/entries";
import { nextOccurrence } from "@/lib/recurrence-schedule";

// UC-13 — shared by the recurrences page (client) and /api/recurrences (server).
// Messages are i18n keys, translated by the client.

/**
 * PUT /recurrences/{id}: pause/resume, change the amount, set or clear the end.
 * Changes apply to entries generated from now on; existing ones stay as they are.
 */
export const updateRecurrenceSchema = z
  .strictObject({
    amount: amountSchema,
    description: z
      .string()
      .trim()
      .max(120, "validation.tooLong")
      .nullable()
      .transform((v) => v || null),
    endDate: dateSchema.nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "validation.required");

export type UpdateRecurrenceInput = z.infer<typeof updateRecurrenceSchema>;

export type RecurrenceStatus = "ACTIVE" | "PAUSED" | "ENDED";

/** Client-facing shape; `today` is the user's calendar date (BR-03). */
export function toRecurrenceDto(r: RecurrenceRow, today: string) {
  const next = nextOccurrence(r, r.lastGeneratedOn, today);
  const status: RecurrenceStatus = !next ? "ENDED" : r.isActive ? "ACTIVE" : "PAUSED";
  return {
    id: r.id,
    kind: r.kind,
    categoryId: r.categoryId,
    description: r.description,
    amount: r.amount,
    paymentMethod: r.paymentMethod,
    institution: r.institution,
    dayOfMonth: r.dayOfMonth,
    startDate: r.startDate,
    endDate: r.endDate,
    isActive: r.isActive,
    status,
    /** Next entry it will create; null when paused or ended */
    nextDate: status === "ACTIVE" ? next : null,
  };
}

export type RecurrenceDto = ReturnType<typeof toRecurrenceDto>;
