"use client";

import Link from "next/link";
import { ChevronRight, Repeat } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorDot, useCategoryName } from "@/components/categories/category-label";
import { formatAmount, KIND_ACCENT } from "@/components/entries/format";
import { useLocale, useT } from "@/i18n/client";
import { formatDate } from "@/lib/date";
import type { CategoryDto } from "@/lib/categories";
import type { Dashboard } from "@/lib/dashboard";

/** Widget 5: the month's 5 largest expenses */
export function TopExpenses({
  data,
  colors,
  categories,
  currency,
}: {
  data: Dashboard;
  /** categoryId → its colour in the category chart; others are gray */
  colors: Map<string, string>;
  categories: CategoryDto[];
  currency: string;
}) {
  const t = useT();
  const locale = useLocale();
  const nameOf = useCategoryName();
  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <Card className="shadow-lg border-border/60">
      <CardHeader>
        <CardTitle>{t("dashboard.topExpenses")}</CardTitle>
        <CardAction>
          <Link
            href={`/expenses?month=${data.month}&sort=amount_desc`}
            className="inline-flex items-center gap-0.5 text-sm text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {t("dashboard.seeAll")}
            <ChevronRight className="size-4" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        {data.topExpenses.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("dashboard.topExpensesEmpty")}
          </p>
        ) : (
          <ol className="divide-y">
            {data.topExpenses.map((e) => {
              const category = byId.get(e.categoryId);
              const categoryName = category ? nameOf(category) : "";
              return (
                <li key={e.id} className="flex items-center gap-3 px-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <span className="truncate">{e.description || categoryName}</span>
                      {e.recurrenceId && (
                        <Repeat
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-label={t("entries.recurring")}
                        />
                      )}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ColorDot
                        color={colors.get(e.categoryId) ?? "var(--viz-other)"}
                        className="size-2"
                      />
                      {e.description && <span className="truncate">{categoryName}</span>}
                      {e.description && <span aria-hidden>·</span>}
                      <span className="shrink-0 tabular-nums">
                        {formatDate(e.entryDate, locale)}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${KIND_ACCENT.EXPENSE}`}
                  >
                    {formatAmount(e.amount, currency, locale)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
