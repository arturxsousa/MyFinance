import { Suspense } from "react";
import { withUserDb } from "@/db/with-user-db";
import { categoryRepo } from "@/db/repositories/categories";
import { recurrenceRepo } from "@/db/repositories/recurrences";
import { userRepo } from "@/db/repositories/users";
import { requireUserPage } from "@/lib/guards";
import { toCategoryDto } from "@/lib/categories";
import { toRecurrenceDto } from "@/lib/recurrences";
import { todayInTimeZone } from "@/lib/date";
import { getT } from "@/i18n/server";
import { RecurrencesManager } from "./recurrences-manager";

export default async function RecurrencesPage() {
  const t = await getT();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("recurrences.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("recurrences.subtitle")}</p>
      </div>
      <Suspense fallback={<div className="h-96 rounded-xl bg-muted animate-pulse" />}>
        <RecurrencesSection />
      </Suspense>
    </div>
  );
}

async function RecurrencesSection() {
  const { userId } = await requireUserPage();
  const { rows, categories, user } = await withUserDb(userId, async (tx) => ({
    rows: await recurrenceRepo.list(tx),
    categories: (await categoryRepo.list(tx)).map(toCategoryDto),
    user: await userRepo.findById(tx, userId),
  }));
  const today = todayInTimeZone(user?.timezone);
  return (
    <RecurrencesManager
      initial={rows.map((r) => toRecurrenceDto(r, today))}
      categories={categories}
      currency={user?.currency ?? "BRL"}
      today={today}
    />
  );
}
