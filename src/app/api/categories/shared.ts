import { categoryRepo } from "@/db/repositories/categories";
import type { UserTx } from "@/db/with-user-db";
import { messages } from "@/i18n/messages";
import { createTranslator } from "@/i18n/translator";
import { normalizeName, type EntryKind } from "@/lib/categories";
import { errorResponse } from "@/lib/api-error";

const translators = Object.values(messages).map(createTranslator);

/**
 * BR-06 unique name per user + kind. The DB index covers the user's own rows;
 * this also stops a user creating "Food"/"Alimentação" next to the system one,
 * in any supported language, which would show two identical entries in pickers.
 */
export async function clashesWithSystemName(tx: UserTx, kind: EntryKind, name: string) {
  const wanted = normalizeName(name);
  const system = (await categoryRepo.list(tx, kind)).filter((c) => c.systemKey);
  return system.some(
    (c) =>
      translators.some(
        (t) =>
          normalizeName(t(`systemCategories.${c.systemKey}` as Parameters<typeof t>[0])) === wanted
      ) || normalizeName(c.name) === wanted
  );
}

export const nameTakenResponse = () =>
  errorResponse("NAME_TAKEN", "A category with this name already exists", 409, {
    name: ["category.nameTaken"],
  });

export const readOnlyResponse = () =>
  errorResponse("CATEGORY_READ_ONLY", "System categories are read-only", 403);
