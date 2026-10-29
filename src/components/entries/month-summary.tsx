"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  PiggyBank,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCategoryName } from "@/components/categories/category-label";
import { useLocale, useT } from "@/i18n/client";
import { formatMonthLabel, formatMonthName } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { EntriesViewProps } from "./entries-view";
import { formatAmount, KIND_ACCENT } from "./format";

const ICON = { INCOME: TrendingUp, EXPENSE: TrendingDown, INVESTMENT: PiggyBank };

/**
 * Side panel on wide screens, a card above the list on smaller ones.
 * Every figure follows the same filters as the list.
 */
export function MonthSummary({ kind, list, categories, currency }: EntriesViewProps) {
  const t = useT();
  const locale = useLocale();
  const nameOf = useCategoryName();
  const { stats } = list;
  const money = (v: string) => formatAmount(v, currency, locale);
  const Icon = ICON[kind];

  const total = Number(list.total);
  const average = list.totalCount ? (total / list.totalCount).toFixed(2) : null;
  const largestCategory =
    stats.largest && categories.find((c) => c.id === stats.largest!.categoryId);

  return (
    <Card className="shadow-lg border-border/60 xl:sticky xl:top-6">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("entries.summaryTitle")} · {formatMonthLabel(list.month, locale)}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center xl:grid-cols-1">
        {/* Total + comparison */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted",
              KIND_ACCENT[kind]
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t(`entries.total${kind}`)}</p>
            <p className={cn("text-2xl font-semibold tabular-nums", KIND_ACCENT[kind])}>
              {money(list.total)}
            </p>
            <Comparison
              kind={kind}
              current={total}
              previous={Number(stats.previousTotal)}
              previousMonth={stats.previousMonth}
            />
          </div>
        </div>

        {/* Stats */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4 xl:grid-cols-1 xl:border-t xl:pt-4">
          <Stat label={t("entries.entriesLabel")} value={String(list.totalCount)} />
          <Stat label={t("entries.average")} value={average ? money(average) : "—"} />
          <Stat
            label={t("entries.largest")}
            value={stats.largest ? money(stats.largest.amount) : "—"}
            hint={
              stats.largest
                ? (stats.largest.description ??
                  (largestCategory ? nameOf(largestCategory) : undefined))
                : undefined
            }
          />
          <Stat
            label={t("entries.scheduledTotal")}
            value={stats.scheduledCount ? money(stats.scheduledTotal) : "—"}
            hint={
              stats.scheduledCount
                ? t(stats.scheduledCount === 1 ? "entries.countOne" : "entries.countOther", {
                    count: stats.scheduledCount,
                  })
                : undefined
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 xl:flex xl:items-baseline xl:justify-between xl:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 xl:text-right">
        <span className="font-medium tabular-nums">{value}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  );
}

/** For expenses spending more is bad; for incomes and investments more is good. */
function Comparison({
  kind,
  current,
  previous,
  previousMonth,
}: {
  kind: EntriesViewProps["kind"];
  current: number;
  previous: number;
  previousMonth: string;
}) {
  const t = useT();
  const locale = useLocale();
  const month = formatMonthName(previousMonth, locale);

  if (previous === 0) {
    return (
      <p className="text-xs text-muted-foreground">{t("entries.nothingInMonth", { month })}</p>
    );
  }
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(Math.abs(change));
  if (rounded === 0) {
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3.5" />
        {t("entries.sameAsMonth", { month })}
      </p>
    );
  }
  const up = change > 0;
  const good = kind === "EXPENSE" ? !up : up;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={cn(
        "flex items-center gap-1 text-xs font-medium",
        good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}
    >
      <Arrow className="size-3.5" />
      {rounded}%{" "}
      <span className="font-normal text-muted-foreground">{t("entries.vsMonth", { month })}</span>
    </p>
  );
}
