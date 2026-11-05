"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  PiggyBank,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatAmount, KIND_ACCENT } from "@/components/entries/format";
import { useLocale, useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translator";
import { formatMonthName, shiftMonth } from "@/lib/date";
import type { Dashboard } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

/** Whether going up is good news: spending more isn't */
type Polarity = "up-good" | "up-bad";

/** Widget 1: income, expenses, invested, balance (BR-04), savings rate (BR-05) */
export function SummaryCards({ data, currency }: { data: Dashboard; currency: string }) {
  const t = useT();
  const locale = useLocale();
  const money = (v: string) => formatAmount(v, currency, locale);
  const { summary } = data;
  const previousMonth = formatMonthName(shiftMonth(data.month, -1), locale);
  const negativeBalance = summary.balance.total.startsWith("-");

  const percent = (v: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(v)}%`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <SummaryCard
        label="dashboard.income"
        icon={TrendingUp}
        accent={KIND_ACCENT.INCOME}
        value={money(summary.income.total)}
        change={summary.income.change}
        polarity="up-good"
        format={percent}
        previousMonth={previousMonth}
      />
      <SummaryCard
        label="dashboard.expense"
        icon={TrendingDown}
        accent={KIND_ACCENT.EXPENSE}
        value={money(summary.expense.total)}
        change={summary.expense.change}
        polarity="up-bad"
        format={percent}
        previousMonth={previousMonth}
      />
      <SummaryCard
        label="dashboard.investment"
        icon={PiggyBank}
        accent={KIND_ACCENT.INVESTMENT}
        value={money(summary.investment.total)}
        change={summary.investment.change}
        polarity="up-good"
        format={percent}
        previousMonth={previousMonth}
      />
      <SummaryCard
        label="dashboard.balance"
        icon={Scale}
        accent={negativeBalance ? "text-rose-600 dark:text-rose-400" : "text-foreground"}
        value={money(summary.balance.total)}
        change={summary.balance.change}
        polarity="up-good"
        format={percent}
        previousMonth={previousMonth}
      />
      <SummaryCard
        label="dashboard.savingsRate"
        icon={Target}
        accent="text-emerald-600 dark:text-emerald-400"
        value={
          summary.savingsRate.rate === null
            ? "—"
            : percent(summary.savingsRate.rate).replace("+", "")
        }
        hint={
          summary.savingsRate.rate === null
            ? t("dashboard.noIncome")
            : t("dashboard.savingsRateHint")
        }
        change={summary.savingsRate.changePoints}
        polarity="up-good"
        format={(v) =>
          t("dashboard.points", {
            value: new Intl.NumberFormat(locale, {
              maximumFractionDigits: 1,
              signDisplay: "exceptZero",
            }).format(v),
          })
        }
        previousMonth={previousMonth}
      />
    </div>
  );
}

function SummaryCard({
  label,
  icon: Icon,
  accent,
  value,
  hint,
  change,
  polarity,
  format,
  previousMonth,
}: {
  label: MessageKey;
  icon: React.ElementType;
  accent: string;
  value: string;
  hint?: string;
  change: number | null;
  polarity: Polarity;
  format: (v: number) => string;
  previousMonth: string;
}) {
  const t = useT();
  return (
    <Card className="shadow-lg border-border/60 gap-0 py-4">
      <CardContent className="space-y-1 px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{t(label)}</p>
          <Icon className={cn("size-4", accent)} aria-hidden />
        </div>
        <p className={cn("truncate text-xl font-semibold tabular-nums", accent)} title={value}>
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        <Change change={change} polarity={polarity} format={format} previousMonth={previousMonth} />
      </CardContent>
    </Card>
  );
}

function Change({
  change,
  polarity,
  format,
  previousMonth,
}: {
  change: number | null;
  polarity: Polarity;
  format: (v: number) => string;
  previousMonth: string;
}) {
  const t = useT();
  if (change === null) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("dashboard.nothingToCompare", { month: previousMonth })}
      </p>
    );
  }
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  const good = change === 0 ? null : change > 0 === (polarity === "up-good");
  return (
    <p className="flex items-center gap-1 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium tabular-nums",
          good === true && "text-emerald-600 dark:text-emerald-400",
          good === false && "text-rose-600 dark:text-rose-400",
          good === null && "text-muted-foreground"
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {format(change)}
      </span>
      <span className="text-muted-foreground">
        {t("dashboard.vsMonth", { month: previousMonth })}
      </span>
    </p>
  );
}
