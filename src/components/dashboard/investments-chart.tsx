"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
import { AXIS_TICK, ChartCard, trimLeadingEmpty, TooltipBox, useChartFormat } from "./chart-card";

type Point = Dashboard["trend"][number] & { contributedN: number; toDateN: number };

/**
 * Widget 4: contributed per month and the total invested. The two live on very
 * different scales, so they're two small charts on a shared month axis —
 * never one plot with two y-scales.
 */
export function InvestmentsChart({ data, currency }: { data: Dashboard; currency: string }) {
  const t = useT();
  const fmt = useChartFormat(currency);
  const points: Point[] = trimLeadingEmpty(data.trend).map((m) => ({
    ...m,
    contributedN: Number(m.investment),
    toDateN: Number(m.investedToDate),
  }));
  const last = points.at(-1)!;

  const tooltip = (
    <Tooltip
      cursor={{ fill: "var(--muted)", opacity: 0.5, stroke: "var(--viz-axis)" }}
      content={({ active, payload }) => {
        const p = active && (payload?.[0]?.payload as Point | undefined);
        if (!p) return null;
        return (
          <TooltipBox
            title={fmt.monthLabel(p.month)}
            rows={[
              {
                label: t("dashboard.contributed"),
                value: fmt.money(p.investment),
                color: "var(--viz-investment)",
              },
              { label: t("dashboard.investedToDate"), value: fmt.money(p.investedToDate) },
            ]}
          />
        );
      }}
    />
  );
  const xAxis = (hide: boolean) => (
    <XAxis
      dataKey="month"
      tickFormatter={fmt.monthTick}
      tick={hide ? false : AXIS_TICK}
      height={hide ? 4 : 30}
      tickLine={false}
      axisLine={{ stroke: "var(--viz-grid)" }}
      interval="preserveStartEnd"
    />
  );
  const yAxis = (
    <YAxis
      tickFormatter={fmt.compact}
      tick={AXIS_TICK}
      tickLine={false}
      axisLine={false}
      width={72}
    />
  );

  const chart = (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <span>{t("dashboard.investedToDate")}</span>
          <span className="text-sm font-semibold text-foreground">
            {fmt.money(last.investedToDate)}
          </span>
        </div>
        <div className="h-32" role="img" aria-label={t("dashboard.investedToDate")}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              syncId="investments"
            >
              <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
              {xAxis(true)}
              {yAxis}
              {tooltip}
              <Area
                dataKey="toDateN"
                type="monotone"
                stroke="var(--viz-investment)"
                strokeWidth={2}
                fill="var(--viz-investment)"
                fillOpacity={0.12}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">{t("dashboard.contributed")}</p>
        <div className="h-36" role="img" aria-label={t("dashboard.contributed")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              syncId="investments"
            >
              <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
              {xAxis(false)}
              {yAxis}
              {tooltip}
              <Bar
                dataKey="contributedN"
                fill="var(--viz-investment)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("dashboard.month")}</TableHead>
          <TableHead className="text-right">{t("dashboard.contributed")}</TableHead>
          <TableHead className="text-right">{t("dashboard.investedToDate")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {points.map((p) => (
          <TableRow key={p.month}>
            <TableCell>{fmt.monthLabel(p.month)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt.money(p.investment)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt.money(p.investedToDate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <ChartCard
      title={t("dashboard.investments")}
      description={t("dashboard.investmentsHint")}
      chart={chart}
      table={table}
    />
  );
}
