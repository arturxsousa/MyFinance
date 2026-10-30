"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCategoryName } from "@/components/categories/category-label";
import { useLocale, useT } from "@/i18n/client";
import type { CategoryDto } from "@/lib/categories";
import { slugFromKind, type EntryKind } from "@/lib/entries";
import type { EntryDto } from "@/lib/entry-api";
import { formatDate } from "@/lib/date";
import { formatAmount } from "./format";

interface Props {
  kind: EntryKind;
  entry: EntryDto | null;
  categories: CategoryDto[];
  currency: string;
  today: string;
  viewedMonth: string;
  onClose: () => void;
  onViewMonth: (month: string) => void;
}

/** UC-11: copy an entry to a chosen date (fast entry for one-off repeats). */
export function DuplicateEntryDialog({ entry, onClose, ...rest }: Props) {
  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      {entry && <DuplicateForm key={entry.id} entry={entry} onClose={onClose} {...rest} />}
    </Dialog>
  );
}

function DuplicateForm({
  kind,
  entry,
  categories,
  currency,
  today,
  viewedMonth,
  onClose,
  onViewMonth,
}: Props & { entry: EntryDto }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const nameOf = useCategoryName();
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const category = categories.find((c) => c.id === entry.categoryId);

  async function handleDuplicate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slugFromKind(kind)}/${entry.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryDate: date }),
      });
      const data = await res.json();
      if (res.ok) {
        const month = date.slice(0, 7);
        toast.success(
          t("entries.duplicated", { date: formatDate(date, locale) }),
          month !== viewedMonth
            ? { action: { label: t("entries.view"), onClick: () => onViewMonth(month) } }
            : undefined
        );
        router.refresh();
        onClose();
        return;
      }
      // e.g. the category was archived since — a copy is a new entry (BR-06)
      const fields = data?.error?.fields ?? {};
      const msg = fields.categoryId?.[0] ?? fields.entryDate?.[0];
      setError(
        msg === "validation.categoryArchived"
          ? t("entries.duplicateArchived") // there's no category field here to "choose another"
          : msg
            ? t.dynamic(msg, "validation.invalid")
            : t("common.somethingWrong")
      );
    } catch {
      setError(t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent closeLabel={t("common.close")}>
      <DialogHeader>
        <DialogTitle>{t("entries.duplicateTitle")}</DialogTitle>
        <DialogDescription>{t("entries.duplicateBody")}</DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {entry.description ?? (category ? nameOf(category) : t("entries.noDescription"))}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatDate(entry.entryDate, locale)}
            {category && entry.description ? ` · ${nameOf(category)}` : ""}
          </p>
        </div>
        <span className="shrink-0 font-semibold tabular-nums">
          {formatAmount(entry.amount, currency, locale)}
        </span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="duplicate-date">{t("entries.duplicateDate")}</Label>
        <DatePicker
          id="duplicate-date"
          value={date}
          onChange={(v) => {
            setDate(v);
            setError(null);
          }}
          locale={locale}
          invalid={!!error}
        />
        {date > today && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {t("entries.scheduledNotice")}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("entries.cancel")}
        </Button>
        <Button
          onClick={handleDuplicate}
          disabled={busy || !date}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {busy ? t("entries.duplicating") : t("entries.duplicate")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
