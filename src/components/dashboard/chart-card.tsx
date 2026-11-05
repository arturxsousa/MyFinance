"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLocale, useT } from "@/i18n/client";

/**
 * A chart with its table twin: every value stays readable without colour or
 * hover (tooltips enhance, never gate).
 */
export function ChartCard({
  title,
  description,
  chart,
  table,
  className,
}: {
  title: string;
  description?: string;
  chart: React.ReactNode;
  table: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  const [view, setView] = useState<"chart" | "table">("chart");
  const asTable = view === "table";
  return (
    <Card className={`shadow-lg border-border/60 ${className ?? ""}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView(asTable ? "chart" : "table")}
            aria-pressed={asTable}
          >
            {asTable ? <BarChart3 /> : <Table2 />}
            {t(asTable ? "dashboard.showChart" : "dashboard.showTable")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>{asTable ? table : chart}</CardContent>
    </Card>
  );
}

/** Formatters shared by the charts. Amounts are exact strings; Number() is display-only. */
export function useChartFormat(currency: string) {
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale, { style: "currency", currency });
  const compact = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const monthShort = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const monthLong = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const toDate = (ym: string) => new Date(`${ym}-01T00:00:00Z`);
  const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  return {
    money: (v: string | number) => money.format(Number(v)),
    compact: (v: number) => compact.format(v),
    /** "nov." — with the year on January so a 12-month axis stays anchored */
    monthTick: (ym: string) => {
      const label = monthShort.format(toDate(ym)).replace(".", "");
      return ym.endsWith("-01") ? `${label} ${ym.slice(2, 4)}` : label;
    },
    monthLabel: (ym: string) => capitalize(monthLong.format(toDate(ym))),
    percent: (part: number, whole: number) =>
      whole > 0
        ? new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(
            part / whole
          )
        : "—",
  };
}

/**
 * Chart colour tokens, light and dark, set on the dashboard root. Each set was
 * checked with the dataviz palette validator against the card surface:
 * income/expense keep their hues but differ in lightness so they stay apart
 * for colour-blind readers; the six category slots are a validated
 * categorical order (adjacent pairs ΔE ≥ 8.4 under CVD simulation).
 */
export const VIZ_TOKENS = [
  "[--viz-income:#10b981] [--viz-expense:#be123c] [--viz-investment:#0284c7]",
  "[--viz-balance:#3f3f46] [--viz-other:#a1a1aa] [--viz-grid:#e4e4e7] [--viz-axis:#71717a]",
  "[--viz-1:#2a78d6] [--viz-2:#eb6834] [--viz-3:#1baf7a] [--viz-4:#eda100] [--viz-5:#e87ba4] [--viz-6:#008300]",
  "dark:[--viz-income:#0fa37f] dark:[--viz-expense:#c81e4a] dark:[--viz-investment:#38bdf8]",
  "dark:[--viz-balance:#e4e4e7] dark:[--viz-other:#71717a] dark:[--viz-grid:#2e2e32] dark:[--viz-axis:#a1a1aa]",
  "dark:[--viz-1:#3987e5] dark:[--viz-2:#d95926] dark:[--viz-3:#199e70] dark:[--viz-4:#c98500] dark:[--viz-5:#d55181] dark:[--viz-6:#008300]",
].join(" ");

/** Slot colours for the category chart, by rank; the tail folds into Other */
export const CATEGORY_SLOTS = [
  "var(--viz-1)",
  "var(--viz-2)",
  "var(--viz-3)",
  "var(--viz-4)",
  "var(--viz-5)",
  "var(--viz-6)",
];

/**
 * Drops the empty months at the start of the 12-month window so a new user
 * doesn't get a wall of zeros — but always keeps at least `min` months.
 */
export function trimLeadingEmpty<T extends { income: string; expense: string; investment: string }>(
  months: T[],
  min = 6
): T[] {
  const isZero = (v: string) => Number(v) === 0;
  const first = months.findIndex(
    (m) => !isZero(m.income) || !isZero(m.expense) || !isZero(m.investment)
  );
  const start = first === -1 ? months.length - min : Math.min(first, months.length - min);
  return months.slice(Math.max(0, start));
}

/** Recessive chrome: hairline grid, muted axis text */
export const AXIS_TICK = { fill: "var(--viz-axis)", fontSize: 12 };

/** Tooltip shell matching the app's popovers */
export function TooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; color?: string; dashed?: boolean }[];
}) {
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1.5 font-medium">{title}</p>
      <dl className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              {r.color && (
                <span
                  className="inline-block size-2.5 rounded-sm"
                  style={{ backgroundColor: r.color }}
                  aria-hidden
                />
              )}
              {r.label}
            </dt>
            <dd className="font-medium tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Legend for ≥ 2 series: identity never rests on colour alone */
export function SeriesLegend({
  items,
}: {
  items: { label: string; color: string; line?: boolean }[];
}) {
  return (
    <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.line ? (
            <span
              className="inline-block h-0.5 w-4 rounded-full"
              style={{ backgroundColor: i.color }}
              aria-hidden
            />
          ) : (
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ backgroundColor: i.color }}
              aria-hidden
            />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}
