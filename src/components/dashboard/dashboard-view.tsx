"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, PiggyBank, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EntryFormDialog } from "@/components/entries/entry-form-dialog";
import { useLocale, useT } from "@/i18n/client";
import { formatMonthLabel, shiftMonth } from "@/lib/date";
import type { CategoryDto } from "@/lib/categories";
import type { Dashboard } from "@/lib/dashboard";
import type { EntryKind } from "@/lib/entries";
import { cn } from "@/lib/utils";
import { SummaryCards } from "./summary-cards";
import { TopExpenses } from "./top-expenses";
import { UpcomingList } from "./upcoming-list";

export interface DashboardViewProps {
  data: Dashboard;
  categories: CategoryDto[];
  currency: string;
  currentMonth: string;
}

const KIND_ICON: Record<EntryKind, React.ElementType> = {
  INCOME: TrendingUp,
  EXPENSE: TrendingDown,
  INVESTMENT: PiggyBank,
};
const KINDS: EntryKind[] = ["INCOME", "EXPENSE", "INVESTMENT"];

export function DashboardView({ data, categories, currency, currentMonth }: DashboardViewProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Widget 7: quick add opens the same entry form as the list pages
  const [adding, setAdding] = useState<EntryKind | null>(null);

  const goTo = (month: string | null) =>
    startTransition(() =>
      router.replace(month && month !== currentMonth ? `/dashboard?month=${month}` : "/dashboard", {
        scroll: false,
      })
    );

  const quickAdd = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="sr-only">{t("dashboard.quickAdd")}</span>
      {KINDS.map((kind) => {
        const Icon = KIND_ICON[kind];
        return (
          <Button key={kind} variant="outline" size="sm" onClick={() => setAdding(kind)}>
            <Plus />
            <Icon className="hidden sm:block" />
            {t(`dashboard.add${kind}`)}
          </Button>
        );
      })}
    </div>
  );

  return (
    <div
      className={cn("space-y-6 transition-opacity", pending && "opacity-60")}
      aria-busy={pending}
    >
      {/* Month picker drives every widget; quick add on the right */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => goTo(shiftMonth(data.month, -1))}
            aria-label={t("entries.previousMonth")}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium tabular-nums">
            {formatMonthLabel(data.month, locale)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => goTo(shiftMonth(data.month, 1))}
            aria-label={t("entries.nextMonth")}
          >
            <ChevronRight />
          </Button>
          {data.month !== currentMonth && (
            <Button variant="ghost" size="sm" onClick={() => goTo(null)}>
              {t("entries.thisMonth")}
            </Button>
          )}
        </div>
        {data.hasData && <div className="ml-auto">{quickAdd}</div>}
      </div>

      {data.hasData ? (
        <>
          <SummaryCards data={data} currency={currency} />
          <div className="grid gap-6 lg:grid-cols-2">
            <TopExpenses data={data} categories={categories} currency={currency} />
            <UpcomingList data={data} categories={categories} currency={currency} />
          </div>
        </>
      ) : (
        <Onboarding onAdd={setAdding} />
      )}

      {adding && (
        <EntryFormDialog
          kind={adding}
          state={{ mode: "create" }}
          categories={categories.filter((c) => c.kind === adding)}
          currency={currency}
          today={data.today}
          viewedMonth={data.month}
          onClose={() => setAdding(null)}
          onViewMonth={goTo}
        />
      )}
    </div>
  );
}

/** A new user sees how to start instead of empty charts */
function Onboarding({ onAdd }: { onAdd: (kind: EntryKind) => void }) {
  const t = useT();
  return (
    <Card className="shadow-lg border-border/60">
      <CardContent className="flex flex-col items-center px-6 py-12 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
          <TrendingUp className="size-7" />
        </div>
        <h2 className="text-lg font-semibold">{t("dashboard.onboardingTitle")}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t("dashboard.onboardingBody")}
        </p>
        <Button
          onClick={() => onAdd("INCOME")}
          className="mt-6 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700"
        >
          <Plus />
          {t("dashboard.onboardingIncome")}
        </Button>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onAdd("EXPENSE")}>
            {t("dashboard.onboardingExpense")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAdd("INVESTMENT")}>
            {t("dashboard.onboardingInvestment")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
