import { categoryRepo } from "@/db/repositories/categories";
import type { UserTx } from "@/db/with-user-db";
import type { EntryKind } from "@/lib/categories";

export type CategoryCheck =
  | { ok: true }
  | {
      ok: false;
      error:
        "validation.categoryNotFound" | "validation.categoryKind" | "validation.categoryArchived";
    };

/**
 * BR-06 for entries. Must run inside withUserDb: foreign keys don't check
 * ownership, so without this a user could attach another user's category id.
 * RLS makes another user's category invisible → "not found".
 *
 * `currentCategoryId`: when editing, an entry may keep the archived category
 * it already has ("archived categories stay on old ones"), but can't switch to one.
 */
export async function checkEntryCategory(
  tx: UserTx,
  categoryId: string,
  kind: EntryKind,
  currentCategoryId?: string
): Promise<CategoryCheck> {
  const category = await categoryRepo.findById(tx, categoryId);
  if (!category) return { ok: false, error: "validation.categoryNotFound" };
  if (category.kind !== kind) return { ok: false, error: "validation.categoryKind" };
  if (!category.isActive && category.id !== currentCategoryId) {
    return { ok: false, error: "validation.categoryArchived" };
  }
  return { ok: true };
}
