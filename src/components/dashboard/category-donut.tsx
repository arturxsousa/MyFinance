"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCategoryName } from "@/components/categories/category-label";
import { useT } from "@/i18n/client";
import type { CategoryDto } from "@/lib/categories";
import type { Dashboard } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { CATEGORY_SLOTS, useChartFormat } from "./chart-card";

interface Slice {
  key: string;
  name: string;
  /** Validated slot by rank this month; Other is neutral gray */
  color: string;
  total: string;
  value: number;
}

/**
 * Widget 2: share of each category in the month's expenses, top 6 + Other.
 * The list beside the ring names every slice with its amount and share, so it
 * doubles as the legend and the table view. Slices take the validated slot
 * colours: users' own category colours can be near-identical (two oranges).
 *
 * No floating tooltip — it would cover the hole's label. Hovering a slice or
 * its row shows that slice in the hole instead, and dims the rest.
 */
export function CategoryDonut({
  data,
  categories,
  currency,
}: {
  data: Dashboard;
  categories: CategoryDto[];
  currency: string;
}) {
  const t = useT();
  const nameOf = useCategoryName();
  const fmt = useChartFormat(currency);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const total = Number(data.categories.total);
  const [active, setActive] = useState<number | null>(null);

  const slices: Slice[] = data.categories.slices.map((s, i) => {
    const c = byId.get(s.categoryId);
    return {
      key: s.categoryId,
      name: c ? nameOf(c) : "—",
      color: CATEGORY_SLOTS[i]!,
      total: s.total,
      value: Number(s.total),
    };
  });
  if (data.categories.other) {
    slices.push({
      key: "other",
      name: t("dashboard.otherCategories", { count: data.categories.other.categories }),
      color: "var(--viz-other)",
      total: data.categories.other.total,
      value: Number(data.categories.other.total),
    });
  }

  const current = active === null ? null : slices[active];

  return (
    <Card className="shadow-lg border-border/60">
      <CardHeader>
        <CardTitle>{t("dashboard.byCategory")}</CardTitle>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("dashboard.topExpensesEmpty")}
          </p>
        ) : (
          <div className="grid items-center gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <div
              className="relative mx-auto size-48"
              role="img"
              aria-label={t("dashboard.byCategory")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="68%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                    // 2px gap in the surface colour between slices
                    stroke="var(--card)"
                    strokeWidth={2}
                    isAnimationActive={false}
                    onMouseEnter={(_, i) => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                  >
                    {slices.map((s, i) => (
                      <Cell
                        key={s.key}
                        fill={s.color}
                        fillOpacity={active === null || active === i ? 1 : 0.3}
                        className="cursor-pointer outline-none transition-[fill-opacity]"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* The hole: the month's total, or the hovered slice */}
              <div
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
                aria-live="polite"
              >
                {current ? (
                  <>
                    <span className="max-w-full truncate text-xs text-muted-foreground">
                      {current.name}
                    </span>
                    <span className="text-base font-semibold">{fmt.money(current.total)}</span>
                    <span className="text-xs text-muted-foreground">
                      {fmt.percent(current.value, total)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">{t("dashboard.expense")}</span>
                    <span className="text-base font-semibold">
                      {fmt.money(data.categories.total)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <ul className="space-y-1.5 text-sm">
              {slices.map((s, i) => (
                <li
                  key={s.key}
                  className={cn(
                    "-mx-2 flex items-center gap-2 rounded-md px-2 py-0.5 transition-colors",
                    active === i && "bg-muted"
                  )}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                >
                  <span
                    className="inline-block size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {fmt.percent(s.value, total)}
                  </span>
                  <span className="w-28 shrink-0 text-right font-medium tabular-nums">
                    {fmt.money(s.total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
