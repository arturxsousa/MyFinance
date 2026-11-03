"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Pencil,
  PiggyBank,
  Repeat,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ColorDot, useCategoryName } from "@/components/categories/category-label";
import { formatAmount, KIND_ACCENT } from "@/components/entries/format";
import { useLocale, useT } from "@/i18n/client";
import { formatDate } from "@/lib/date";
import type { CategoryDto, EntryKind } from "@/lib/categories";
import type { RecurrenceDto } from "@/lib/recurrences";
import { cn } from "@/lib/utils";
import { RecurrenceDialog } from "./recurrence-dialog";
import { DeleteRecurrenceDialog } from "./delete-dialog";

const KIND_ICON: Record<EntryKind, React.ElementType> = {
  INCOME: TrendingUp,
  EXPENSE: TrendingDown,
  INVESTMENT: PiggyBank,
};

interface Props {
  initial: RecurrenceDto[];
  categories: CategoryDto[];
  currency: string;
  today: string;
}

export function RecurrencesManager({ initial, categories, currency, today }: Props) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [recurrences, setRecurrences] = useState(initial);
  const [editing, setEditing] = useState<RecurrenceDto | null>(null);
  const [deleting, setDeleting] = useState<RecurrenceDto | null>(null);

  const current = recurrences.filter((r) => r.status !== "ENDED");
  const ended = recurrences.filter((r) => r.status === "ENDED");

  const replace = (r: RecurrenceDto) =>
    setRecurrences((list) => list.map((x) => (x.id === r.id ? r : x)));

  async function toggleActive(r: RecurrenceDto, isActive: boolean) {
    replace({ ...r, isActive, status: isActive ? "ACTIVE" : "PAUSED" }); // optimistic
    try {
      const res = await fetch(`/api/recurrences/${r.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error();
      const updated: RecurrenceDto = (await res.json()).recurrence;
      replace(updated);
      toast.success(
        updated.nextDate
          ? t("recurrences.resumedToast", { date: formatDate(updated.nextDate, locale) })
          : t("recurrences.pausedToast")
      );
    } catch {
      replace(r); // revert
      toast.error(t("common.somethingWrong"));
    }
  }

  if (recurrences.length === 0) {
    return (
      <Card className="shadow-lg border-border/60">
        <CardContent>
          <EmptyState
            icon={Repeat}
            title={t("recurrences.emptyTitle")}
            description={t("recurrences.emptyBody")}
            action={{
              label: t("recurrences.emptyAction"),
              onClick: () => router.push("/expenses"),
              className:
                "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20",
            }}
            className="py-10"
          />
        </CardContent>
      </Card>
    );
  }

  const row = (r: RecurrenceDto) => (
    <RecurrenceRow
      key={r.id}
      recurrence={r}
      category={categories.find((c) => c.id === r.categoryId)}
      currency={currency}
      onToggle={(v) => toggleActive(r, v)}
      onEdit={() => setEditing(r)}
      onDelete={() => setDeleting(r)}
    />
  );

  return (
    <div className="space-y-6">
      {current.length > 0 && (
        <Card className="shadow-lg border-border/60">
          <CardHeader>
            <CardTitle>{t("recurrences.active")}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <ul className="divide-y">{current.map(row)}</ul>
          </CardContent>
        </Card>
      )}

      {ended.length > 0 && (
        <Card className="shadow-lg border-border/60">
          <CardHeader>
            <CardTitle>{t("recurrences.ended")}</CardTitle>
            <CardDescription>{t("recurrences.endedHint")}</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <ul className="divide-y">{ended.map(row)}</ul>
          </CardContent>
        </Card>
      )}

      <RecurrenceDialog
        recurrence={editing}
        currency={currency}
        today={today}
        onClose={() => setEditing(null)}
        onSaved={(r) => {
          replace(r);
          setEditing(null);
        }}
      />
      <DeleteRecurrenceDialog
        recurrence={deleting}
        onClose={() => setDeleting(null)}
        onDone={(id) => {
          setRecurrences((list) => list.filter((r) => r.id !== id));
          setDeleting(null);
        }}
      />
    </div>
  );
}

function RecurrenceRow({
  recurrence: r,
  category,
  currency,
  onToggle,
  onEdit,
  onDelete,
}: {
  recurrence: RecurrenceDto;
  category: CategoryDto | undefined;
  currency: string;
  onToggle: (isActive: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const nameOf = useCategoryName();
  const Icon = KIND_ICON[r.kind];
  const categoryName = category ? nameOf(category) : "";
  const title = r.description || categoryName;
  const isEnded = r.status === "ENDED";

  return (
    <li className={cn("flex items-center gap-3 px-2 py-3", r.status !== "ACTIVE" && "opacity-60")}>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted",
          KIND_ACCENT[r.kind]
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          {r.status === "PAUSED" && <Badge variant="outline">{t("recurrences.paused")}</Badge>}
        </div>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {category && r.description && (
            <span className="inline-flex items-center gap-1">
              <ColorDot color={category.color} className="size-2" />
              {categoryName}
              <span aria-hidden>·</span>
            </span>
          )}
          <span>{t("recurrences.everyMonth", { day: r.dayOfMonth })}</span>
          {r.endDate && !isEnded && (
            <span>{t("recurrences.until", { date: formatDate(r.endDate, locale) })}</span>
          )}
          {r.nextDate && (
            <>
              <span aria-hidden>·</span>
              <span>{t("recurrences.next", { date: formatDate(r.nextDate, locale) })}</span>
            </>
          )}
          {isEnded && r.endDate && (
            <>
              <span aria-hidden>·</span>
              <span>{t("recurrences.endedOn", { date: formatDate(r.endDate, locale) })}</span>
            </>
          )}
        </p>
        {category && !category.isActive && !isEnded && (
          <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3.5 shrink-0" />
            {t("recurrences.archivedCategory")}
          </p>
        )}
      </div>

      <span className={cn("shrink-0 text-sm font-semibold tabular-nums", KIND_ACCENT[r.kind])}>
        {formatAmount(r.amount, currency, locale)}
      </span>

      {!isEnded && (
        <Switch
          checked={r.isActive}
          onCheckedChange={onToggle}
          aria-label={t("recurrences.toggleLabel", { name: title })}
        />
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onEdit}
        aria-label={`${t("recurrences.edit")}: ${title}`}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        aria-label={`${t("recurrences.delete")}: ${title}`}
      >
        <Trash2 />
      </Button>
    </li>
  );
}
