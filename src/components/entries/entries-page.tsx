import { Suspense } from "react";
import { withUserDb } from "@/db/with-user-db";
import { categoryRepo } from "@/db/repositories/categories";
import { userRepo } from "@/db/repositories/users";
import { requireUserPage } from "@/lib/guards";
import { toCategoryDto } from "@/lib/categories";
import { listEntriesQuerySchema, type EntryKind } from "@/lib/entries";
import { listEntries } from "@/lib/entry-api";
import { currentYearMonth } from "@/lib/date";
import { getT } from "@/i18n/server";
import { EntriesView } from "./entries-view";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Shared list page for /incomes, /expenses, /investments (UC-08). */
export async function EntriesPage({
  kind,
  searchParams,
}: {
  kind: EntryKind;
  searchParams: SearchParams;
}) {
  const t = await getT();
  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t(`entries.title${kind}`)}</h1>
        <p className="text-muted-foreground mt-1">{t(`entries.subtitle${kind}`)}</p>
      </div>
      <Suspense fallback={<div className="h-96 rounded-xl bg-muted animate-pulse" />}>
        <EntriesContent kind={kind} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EntriesContent({
  kind,
  searchParams,
}: {
  kind: EntryKind;
  searchParams: SearchParams;
}) {
  const { userId } = await requireUserPage();

  // The URL is user-editable: ignore invalid params instead of erroring
  const raw = Object.fromEntries(
    Object.entries(await searchParams).filter(([, v]) => typeof v === "string")
  );
  const parsed = listEntriesQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : listEntriesQuerySchema.parse({});

  const [list, { categories, user }] = await Promise.all([
    listEntries(userId, kind, query),
    withUserDb(userId, async (tx) => ({
      categories: (await categoryRepo.list(tx, kind)).map(toCategoryDto),
      user: await userRepo.findById(tx, userId),
    })),
  ]);

  return (
    <EntriesView
      kind={kind}
      list={list}
      query={query}
      categories={categories}
      currency={user?.currency ?? "BRL"}
      currentMonth={currentYearMonth(user?.timezone)}
    />
  );
}
