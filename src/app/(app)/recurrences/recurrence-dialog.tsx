"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale, useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translator";
import { updateRecurrenceSchema, type RecurrenceDto } from "@/lib/recurrences";

interface Props {
  recurrence: RecurrenceDto | null;
  currency: string;
  today: string;
  onClose: () => void;
  onSaved: (r: RecurrenceDto) => void;
}

/** UC-13: edit amount, description and end date */
export function RecurrenceDialog({ recurrence, onClose, ...rest }: Props) {
  return (
    <Dialog open={!!recurrence} onOpenChange={(open) => !open && onClose()}>
      {/* keyed so each opening starts from the recurrence's current values */}
      {recurrence && (
        <RecurrenceForm key={recurrence.id} recurrence={recurrence} onClose={onClose} {...rest} />
      )}
    </Dialog>
  );
}

function RecurrenceForm({
  recurrence: r,
  currency,
  today,
  onClose,
  onSaved,
}: Props & { recurrence: RecurrenceDto }) {
  const t = useT();
  const locale = useLocale();
  const [amount, setAmount] = useState(r.amount);
  const [description, setDescription] = useState(r.description ?? "");
  const [endDate, setEndDate] = useState(r.endDate ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Ending today only makes sense once it has started
  const canEndToday = today >= r.startDate && endDate !== today;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = updateRecurrenceSchema.safeParse({
      amount,
      description,
      endDate: endDate || null,
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), t(i.message as MessageKey)])
        )
      );
      return;
    }
    if (parsed.data.endDate && parsed.data.endDate < r.startDate) {
      setErrors({ endDate: t("validation.recurrenceEnd") });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/recurrences/${r.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.status === 422) {
        const { error } = await res.json();
        setErrors(
          Object.fromEntries(
            Object.entries((error.fields ?? {}) as Record<string, string[]>).map(([k, v]) => [
              k,
              t(v[0] as MessageKey),
            ])
          )
        );
        return;
      }
      if (!res.ok) throw new Error();
      toast.success(t("recurrences.updated"));
      onSaved((await res.json()).recurrence);
    } catch {
      toast.error(t("common.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent closeLabel={t("common.close")}>
      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <DialogHeader>
          <DialogTitle>{t("recurrences.editTitle")}</DialogTitle>
          <DialogDescription>{t("recurrences.appliesToFuture")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="rec-amount">{t("recurrences.amount")}</Label>
          <MoneyInput
            id="rec-amount"
            value={amount}
            onChange={setAmount}
            currency={currency}
            locale={locale}
            aria-invalid={!!errors.amount || undefined}
            autoFocus
            className="h-10 text-lg font-semibold md:text-lg"
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rec-description">{t("recurrences.description")}</Label>
          <Input
            id="rec-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={120}
            aria-invalid={!!errors.description || undefined}
          />
          {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rec-end">{t("recurrences.endDate")}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              id="rec-end"
              value={endDate}
              onChange={setEndDate}
              locale={locale}
              placeholder={t("recurrences.noEnd")}
              invalid={!!errors.endDate}
            />
            {endDate && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEndDate("")}>
                {t("recurrences.clearDate")}
              </Button>
            )}
            {canEndToday && (
              <Button type="button" variant="outline" size="sm" onClick={() => setEndDate(today)}>
                {t("recurrences.endToday")}
              </Button>
            )}
          </div>
          {errors.endDate && <p className="text-sm text-destructive">{errors.endDate}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("recurrences.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
          >
            {saving ? t("recurrences.saving") : t("recurrences.save")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
