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
import type { CategoryDto } from "@/lib/categories";

interface Props {
  category: CategoryDto | null;
  onClose: () => void;
  onDone: (id: string, result: "deleted" | "archived") => void;
}

export function DeleteDialog({ category, onClose, onDone }: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!category) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const { result } = (await res.json()) as { result: "deleted" | "archived" };
      // In use → archived instead: tell the user what actually happened
      if (result === "archived") toast.info(t("categories.archivedInstead"));
      else toast.success(t("categories.deletedToast"));
      onDone(category.id, result);
    } catch {
      toast.error(t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!category} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t("common.close")}>
        <DialogHeader>
          <DialogTitle>{t("categories.deleteTitle", { name: category?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("categories.deleteBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("categories.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy ? t("categories.deleting") : t("categories.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
