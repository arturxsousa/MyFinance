"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

/** UC-10: how long the "Undo" toast stays up */
export const UNDO_MS = 5000;

interface Props {
  kind: EntryKind;
  entry: EntryDto | null;
  categories: CategoryDto[];
  currency: string;
  onClose: () => void;
  /** Called after a successful delete (e.g. to close the edit form behind) */
  onDeleted?: () => void;
}

export function DeleteEntryDialog({
  kind,
  entry,
  categories,
  currency,
  onClose,
  onDeleted,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const nameOf = useCategoryName();
  const [busy, setBusy] = useState(false);
  const base = `/api/${slugFromKind(kind)}`;
  const category = entry && categories.find((c) => c.id === entry.categoryId);

  async function restore(id: string) {
    try {
      const res = await fetch(`${base}/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success(t("entries.restored"));
      router.refresh();
    } catch {
      toast.error(t("entries.restoreFailed"));
    }
  }

  async function handleDelete() {
    if (!entry) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const id = entry.id;
      // Soft delete (UC-10): the row is restorable, so offer Undo instead of a scarier confirm
      toast(t("entries.deleted"), {
        duration: UNDO_MS,
        action: { label: t("entries.undo"), onClick: () => restore(id) },
      });
      router.refresh();
      onClose();
      onDeleted?.();
    } catch {
      toast.error(t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t("common.close")}>
        <DialogHeader>
          <DialogTitle>{t("entries.deleteTitle")}</DialogTitle>
          <DialogDescription>{t("entries.deleteBody")}</DialogDescription>
        </DialogHeader>

        {entry && (
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
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("entries.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy ? t("entries.deleting") : t("entries.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
