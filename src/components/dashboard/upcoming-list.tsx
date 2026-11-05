"use client";

import { CalendarClock, PiggyBank, Repeat, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCategoryName } from "@/components/categories/category-label";
import { formatAmount, KIND_ACCENT } from "@/components/entries/format";
import { useLocale, useT } from "@/i18n/client";
import { formatDate } from "@/lib/date";
import type { CategoryDto } from "@/lib/categories";
import type { Dashboard } from "@/lib/dashboard";
import type { EntryKind } from "@/lib/entries";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<EntryKind, React.ElementType> = {
  INCOME: TrendingUp,
  EXPENSE: TrendingDown,
  INVESTMENT: PiggyBank,
};

/** Widget 6: scheduled entries and recurrences still to come, next 30 days */
export function UpcomingList({
  data,
  categories,
  currency,
}: {
  data: Dashboard;
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
        <CardTitle>{t("dashboard.upcoming")}</CardTitle>
        <CardDescription>{t("dashboard.upcomingHint")}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        {data.upcoming.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("dashboard.upcomingEmpty")}
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {data.upcoming.map((u) => {
              const Icon = KIND_ICON[u.kind];
              const category = byId.get(u.categoryId);
              const title = u.description || (category ? nameOf(category) : "");
              return (
                <li key={`${u.kind}-${u.id}`} className="flex items-center gap-3 px-2 py-2.5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted",
                      KIND_ACCENT[u.kind]
                    )}
                    aria-label={t(`kinds.${u.kind}`)}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{title}</span>
                      {u.recurring && (
                        <Repeat
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-label={t("entries.recurring")}
                        />
                      )}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="tabular-nums">{formatDate(u.entryDate, locale)}</span>
                      {u.source === "projected" ? (
                        <Badge
                          variant="outline"
                          className="border-dashed"
                          title={t("entries.projectedHint")}
                        >
                          {t("entries.projected")}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1"
                          title={t("entries.scheduledHint")}
                        >
                          <CalendarClock />
                          {t("entries.scheduled")}
                        </Badge>
                      )}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      KIND_ACCENT[u.kind]
                    )}
                  >
                    {formatAmount(u.amount, currency, locale)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
