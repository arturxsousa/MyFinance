"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/i18n/client";
import type { Dashboard } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import {
  AXIS_TICK,
  ChartCard,
  trimLeadingEmpty,
  SeriesLegend,
  TooltipBox,
  useChartFormat,
} from "./chart-card";

type Point = Dashboard["trend"][number] & { incomeN: number; expenseN: number; balanceN: number };

/**
 * Widget 3: income vs expenses per month (grouped bars) with the balance as a
 * line — all in money, so one shared axis (never a second scale).
 */
export function TrendChart({ data, currency }: { data: Dashboard; currency: string }) {
  const t = useT();
  const fmt = useChartFormat(currency);
  const points: Point[] = trimLeadingEmpty(data.trend).map((m) => ({
    ...m,
    incomeN: Number(m.income),
    expenseN: Number(m.expense),
    balanceN: Number(m.balance),
  }));
  const negative = points.some((p) => p.balanceN < 0);

  const series = [
    { key: "income", label: t("dashboard.income"), color: "var(--viz-income)" },
    { key: "expense", label: t("dashboard.expense"), color: "var(--viz-expense)" },
  ];

  const chart = (
    <>
      <SeriesLegend
        items={[
          ...series,
          { label: t("dashboard.balance"), color: "var(--viz-balance)", line: true },
        ]}
      />
      <div className="h-72" role="img" aria-label={t("dashboard.trend")}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap="24%"
          >
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis
              dataKey="month"
              tickFormatter={fmt.monthTick}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--viz-grid)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={fmt.compact}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            {negative && <ReferenceLine y={0} stroke="var(--viz-axis)" />}
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={({ active, payload }) => {
                const p = active && (payload?.[0]?.payload as Point | undefined);
                if (!p) return null;
                return (
                  <TooltipBox
                    title={fmt.monthLabel(p.month)}
                    rows={[
                      {
                        label: t("dashboard.income"),
                        value: fmt.money(p.income),
                        color: "var(--viz-income)",
                      },
                      {
                        label: t("dashboard.expense"),
                        value: fmt.money(p.expense),
                        color: "var(--viz-expense)",
                      },
                      {
                        label: t("dashboard.balance"),
                        value: fmt.money(p.balance),
                        color: "var(--viz-balance)",
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="incomeN"
              name={series[0]!.label}
              fill="var(--viz-income)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expenseN"
              name={series[1]!.label}
              fill="var(--viz-expense)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
            <Line
              dataKey="balanceN"
              name={t("dashboard.balance")}
              type="monotone"
              stroke="var(--viz-balance)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--viz-balance)", stroke: "var(--card)", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("dashboard.month")}</TableHead>
          <TableHead className="text-right">{t("dashboard.income")}</TableHead>
          <TableHead className="text-right">{t("dashboard.expense")}</TableHead>
          <TableHead className="text-right">{t("dashboard.balance")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {points.map((p) => (
          <TableRow key={p.month}>
            <TableCell>{fmt.monthLabel(p.month)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt.money(p.income)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt.money(p.expense)}</TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums",
                p.balanceN < 0 && "text-rose-600 dark:text-rose-400"
              )}
            >
              {fmt.money(p.balance)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <ChartCard
      title={t("dashboard.trend")}
      description={t("dashboard.trendHint")}
      chart={chart}
      table={table}
    />
  );
}
