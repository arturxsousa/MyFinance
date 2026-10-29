"use client";

import { CalendarClock, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColorDot, useCategoryName } from "@/components/categories/category-label";
import { useLocale, useT } from "@/i18n/client";
import { formatDate, formatMonthLabel } from "@/lib/date";
import type { PaymentMethod } from "@/lib/entries";
import type { EntryDto } from "@/lib/entry-api";
import { cn } from "@/lib/utils";
import type { EntriesViewProps, SetParams } from "./entries-view";
import { formatAmount, KIND_ACCENT } from "./format";

export function EntriesList({
  kind,
  list,
  query,
  categories,
  currency,
  setParams,
}: EntriesViewProps & { setParams: SetParams }) {
  const t = useT();
  const locale = useLocale();
  const nameOf = useCategoryName();
  const byId = new Map(categories.map((c) => [c.id, c]));

  const extraColumn =
    kind === "EXPENSE"
      ? t("entries.colPaymentMethod")
      : kind === "INVESTMENT"
        ? t("entries.colInstitution")
        : null;
  const extraValue = (e: EntryDto) =>
    kind === "EXPENSE"
      ? t(`paymentMethods.${e.paymentMethod as PaymentMethod}`)
      : kind === "INVESTMENT"
        ? (e.institution ?? "—")
        : null;

  const filtered = !!(query.q || query.category);

  if (list.entries.length === 0) {
    return (
      <Card className="shadow-lg border-border/60">
        <CardContent>
          <EmptyState
            icon={Inbox}
            title={
              filtered
                ? t("entries.emptyFiltered")
                : t("entries.emptyMonth", { month: formatMonthLabel(list.month, locale) })
            }
            action={
              filtered
                ? {
                    label: t("entries.clearFilters"),
                    onClick: () => setParams({ q: null, category: null }),
                  }
                : undefined
            }
            className="py-12"
          />
        </CardContent>
      </Card>
    );
  }

  const category = (e: EntryDto) => {
    const c = byId.get(e.categoryId);
    return (
      <span className="flex min-w-0 items-center gap-2">
        {c && <ColorDot color={c.color} />}
        <span className="truncate">{c ? nameOf(c) : "—"}</span>
      </span>
    );
  };

  const scheduled = (
    <Badge variant="outline" className="gap-1" title={t("entries.scheduledHint")}>
      <CalendarClock />
      {t("entries.scheduled")}
    </Badge>
  );

  return (
    <Card className="shadow-lg border-border/60 py-0">
      <CardContent className="px-0">
        {/* Desktop: table */}
        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28 pl-4">{t("entries.colDate")}</TableHead>
              <TableHead>{t("entries.colDescription")}</TableHead>
              <TableHead className="w-48">{t("entries.colCategory")}</TableHead>
              {extraColumn && <TableHead className="w-40">{extraColumn}</TableHead>}
              <TableHead className="w-36 pr-4 text-right">{t("entries.colAmount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.entries.map((e) => (
              <TableRow key={e.id} className={cn(e.isScheduled && "text-muted-foreground")}>
                <TableCell className="pl-4 tabular-nums">
                  {formatDate(e.entryDate, locale)}
                </TableCell>
                <TableCell className="max-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate font-medium",
                        !e.description && "font-normal italic text-muted-foreground"
                      )}
                    >
                      {e.description ?? t("entries.noDescription")}
                    </span>
                    {e.isScheduled && scheduled}
                  </div>
                  {e.notes && <p className="truncate text-xs text-muted-foreground">{e.notes}</p>}
                </TableCell>
                <TableCell className="max-w-48">{category(e)}</TableCell>
                {extraColumn && <TableCell className="truncate">{extraValue(e)}</TableCell>}
                <TableCell
                  className={cn(
                    "pr-4 text-right font-medium tabular-nums",
                    !e.isScheduled && KIND_ACCENT[kind]
                  )}
                >
                  {formatAmount(e.amount, currency, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Mobile: cards */}
        <ul className="divide-y md:hidden">
          {list.entries.map((e) => (
            <li
              key={e.id}
              className={cn(
                "flex items-start gap-3 px-4 py-3",
                e.isScheduled && "text-muted-foreground"
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    !e.description && "font-normal italic text-muted-foreground"
                  )}
                >
                  {e.description ?? t("entries.noDescription")}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {category(e)}
                  <span aria-hidden>·</span>
                  <span className="shrink-0 tabular-nums">{formatDate(e.entryDate, locale)}</span>
                </div>
                {e.isScheduled && scheduled}
              </div>
              <span
                className={cn(
                  "shrink-0 text-sm font-semibold tabular-nums",
                  !e.isScheduled && KIND_ACCENT[kind]
                )}
              >
                {formatAmount(e.amount, currency, locale)}
              </span>
            </li>
          ))}
        </ul>

        {list.totalPages > 1 && (
          <nav
            className="flex items-center justify-between gap-2 border-t px-4 py-3"
            aria-label="pagination"
          >
            <Button
              variant="outline"
              size="sm"
              disabled={list.page <= 1}
              onClick={() => setParams({ page: list.page - 1 })}
            >
              {t("entries.previousPage")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("entries.pageOf", { page: list.page, pages: list.totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={list.page >= list.totalPages}
              onClick={() => setParams({ page: list.page + 1 })}
            >
              {t("entries.nextPage")}
            </Button>
          </nav>
        )}
      </CardContent>
    </Card>
  );
}
