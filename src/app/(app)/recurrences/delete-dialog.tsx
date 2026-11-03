"use client";

import { useState } from "react";
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
import { useT } from "@/i18n/client";
import type { RecurrenceDto } from "@/lib/recurrences";

interface Props {
  recurrence: RecurrenceDto | null;
  onClose: () => void;
  onDone: (id: string) => void;
}

export function DeleteRecurrenceDialog({ recurrence, onClose, onDone }: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!recurrence) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recurrences/${recurrence.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("recurrences.deletedToast"));
      onDone(recurrence.id);
    } catch {
      toast.error(t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!recurrence} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t("common.close")}>
        <DialogHeader>
          <DialogTitle>{t("recurrences.deleteTitle")}</DialogTitle>
          <DialogDescription>{t("recurrences.deleteBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("recurrences.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy ? t("recurrences.deleting") : t("recurrences.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
