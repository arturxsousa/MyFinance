import { Suspense } from "react";
import { withUserDb } from "@/db/with-user-db";
import { categoryRepo } from "@/db/repositories/categories";
import { userRepo } from "@/db/repositories/users";
import { requireUserPage } from "@/lib/guards";
import { toCategoryDto } from "@/lib/categories";
import { dashboardQuerySchema, getDashboard } from "@/lib/dashboard";
import { currentYearMonth } from "@/lib/date";
import { getT } from "@/i18n/server";
import { DashboardView } from "@/components/dashboard/dashboard-view";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** UC-14 — the home screen after login */
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getT();
  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
      </div>
      <Suspense fallback={<div className="h-96 rounded-xl bg-muted animate-pulse" />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ searchParams }: { searchParams: SearchParams }) {
  const { userId } = await requireUserPage();

  // The URL is user-editable: an invalid month falls back to the current one
  const month = (await searchParams).month;
  const parsed = dashboardQuerySchema.safeParse({
    month: typeof month === "string" ? month : undefined,
  });

  const [data, { categories, user }] = await Promise.all([
    getDashboard(userId, parsed.success ? parsed.data.month : undefined),
    withUserDb(userId, async (tx) => ({
      categories: (await categoryRepo.list(tx)).map(toCategoryDto),
      user: await userRepo.findById(tx, userId),
    })),
  ]);

  return (
    <DashboardView
      data={data}
      categories={categories}
      currency={user?.currency ?? "BRL"}
      currentMonth={currentYearMonth(user?.timezone)}
    />
  );
}
