import { Suspense } from "react";
import { withUserDb } from "@/db/with-user-db";
import { categoryRepo } from "@/db/repositories/categories";
import { requireUserPage } from "@/lib/guards";
import { toCategoryDto } from "@/lib/categories";
import { getT } from "@/i18n/server";
import { CategoriesManager } from "./categories-manager";

export default async function CategoriesPage() {
  const t = await getT();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("categories.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("categories.subtitle")}</p>
      </div>
      <Suspense fallback={<div className="h-96 rounded-xl bg-muted animate-pulse" />}>
        <CategoriesSection />
      </Suspense>
    </div>
  );
}

async function CategoriesSection() {
  const { userId } = await requireUserPage();
  const rows = await withUserDb(userId, (tx) => categoryRepo.list(tx));
  return <CategoriesManager initial={rows.map(toCategoryDto)} />;
}
