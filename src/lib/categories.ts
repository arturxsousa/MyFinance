import { z } from "zod";
import type { category } from "@/db/schema/categories";

export const ENTRY_KINDS = ["INCOME", "EXPENSE", "INVESTMENT"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// Messages are i18n keys, translated by the client
const name = z.string().trim().min(1, "validation.required").max(50, "validation.tooLong");
const color = z
  .string()
  .regex(HEX_COLOR, "validation.invalidColor")
  .transform((c) => c.toLowerCase());

export const kindSchema = z.enum(ENTRY_KINDS, { message: "validation.invalidOption" });

export const createCategorySchema = z.strictObject({ kind: kindSchema, name, color });

// Kind is immutable: existing entries would end up with a category of another kind (BR-06)
export const updateCategorySchema = z
  .strictObject({ name, color, isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "validation.required");

export type Category = typeof category.$inferSelect;

/** Client-facing shape. System names are translated on screen via systemKey. */
export function toCategoryDto(c: Category) {
  return {
    id: c.id,
    kind: c.kind,
    name: c.name,
    systemKey: c.systemKey,
    color: c.color,
    isActive: c.isActive,
    isSystem: c.userId === null,
  };
}

export type CategoryDto = ReturnType<typeof toCategoryDto>;

/** Case- and space-insensitive comparison for name clashes */
export const normalizeName = (n: string) => n.trim().toLocaleLowerCase();
