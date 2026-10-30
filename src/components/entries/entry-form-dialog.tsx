"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategorySelect } from "@/components/categories/category-select";
import { useLocale, useT } from "@/i18n/client";
import type { CategoryDto } from "@/lib/categories";
import { PAYMENT_METHODS, slugFromKind, type EntryKind, type PaymentMethod } from "@/lib/entries";
import type { EntryDto } from "@/lib/entry-api";
import { formatMonthLabel } from "@/lib/date";

export type EntryFormState = { mode: "create" } | { mode: "edit"; entry: EntryDto } | null;

interface Props {
  kind: EntryKind;
  state: EntryFormState;
  categories: CategoryDto[];
  currency: string;
  /** Today in the user's timezone — the default date (BR-03) */
  today: string;
  /** The month being viewed; saving into another month offers a jump there */
  viewedMonth: string;
  onClose: () => void;
  onViewMonth: (month: string) => void;
}

export function EntryFormDialog({ state, onClose, ...rest }: Props) {
  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      {/* Keyed so every open starts from fresh values */}
      {state && (
        <EntryForm
          key={state.mode === "edit" ? state.entry.id : "new"}
          state={state}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}

type Values = {
  amount: string;
  entryDate: string;
  categoryId: string | null;
  description: string;
  notes: string;
  paymentMethod: PaymentMethod;
  institution: string;
};
type FieldErrors = Partial<Record<keyof Values, string>>;

function EntryForm({
  kind,
  state,
  categories,
  currency,
  today,
  viewedMonth,
  onClose,
  onViewMonth,
}: Props & { state: NonNullable<EntryFormState> }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const editing = state.mode === "edit" ? state.entry : null;

  const [values, setValues] = useState<Values>({
    amount: editing?.amount ?? "",
    entryDate: editing?.entryDate ?? today,
    categoryId: editing?.categoryId ?? null,
    description: editing?.description ?? "",
    notes: editing?.notes ?? "",
    paymentMethod: (editing?.paymentMethod as PaymentMethod) ?? "PIX",
    institution: editing?.institution ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const scheduled = values.entryDate > today;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const body: Record<string, unknown> = {
      amount: values.amount,
      entryDate: values.entryDate,
      categoryId: values.categoryId ?? undefined,
      description: values.description,
      notes: values.notes,
    };
    if (kind === "EXPENSE") body.paymentMethod = values.paymentMethod;
    if (kind === "INVESTMENT") body.institution = values.institution;

    const base = `/api/${slugFromKind(kind)}`;
    try {
      const res = await fetch(editing ? `${base}/${editing.id}` : base, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        const savedMonth = (data.entry.entryDate as string).slice(0, 7);
        if (savedMonth !== viewedMonth) {
          // Saved outside the month on screen — say where it went
          toast.success(
            t("entries.savedInOtherMonth", { month: formatMonthLabel(savedMonth, locale) }),
            {
              action: { label: t("entries.view"), onClick: () => onViewMonth(savedMonth) },
            }
          );
        } else {
          toast.success(t(editing ? "entries.updated" : "entries.created"));
        }
        router.refresh();
        onClose();
        return;
      }

      const fields = (data?.error?.fields ?? {}) as Record<string, string[]>;
      setErrors(
        Object.fromEntries(
          Object.entries(fields).map(([k, msgs]) => [k, t.dynamic(msgs[0], "validation.invalid")])
        )
      );
      if (!Object.keys(fields).length) toast.error(t("common.somethingWrong"));
    } catch {
      toast.error(t("common.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent closeLabel={t("common.close")} className="sm:max-w-lg">
      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <DialogHeader>
          <DialogTitle>{t(editing ? `entries.edit${kind}` : `entries.new${kind}`)}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="entry-amount" label={t("entries.fieldAmount")} error={errors.amount}>
            <MoneyInput
              id="entry-amount"
              value={values.amount}
              onChange={(v) => set("amount", v)}
              currency={currency}
              locale={locale}
              aria-invalid={!!errors.amount || undefined}
              autoFocus
              className="h-10 text-lg font-semibold md:text-lg"
            />
          </Field>
          <Field id="entry-date" label={t("entries.fieldDate")} error={errors.entryDate}>
            <DatePicker
              id="entry-date"
              value={values.entryDate}
              onChange={(v) => set("entryDate", v)}
              locale={locale}
              invalid={!!errors.entryDate}
              className="h-10"
            />
          </Field>
        </div>

        {scheduled && (
          <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {t("entries.scheduledNotice")}
          </p>
        )}

        <Field id="entry-category" label={t("entries.fieldCategory")} error={errors.categoryId}>
          <CategorySelect
            id="entry-category"
            kind={kind}
            categories={categories}
            value={values.categoryId}
            onChange={(v) => set("categoryId", v)}
            invalid={!!errors.categoryId}
          />
        </Field>

        {kind === "EXPENSE" && (
          <Field
            id="entry-payment"
            label={t("entries.fieldPaymentMethod")}
            error={errors.paymentMethod}
          >
            <Select
              value={values.paymentMethod}
              onValueChange={(v) => v && set("paymentMethod", v as PaymentMethod)}
            >
              <SelectTrigger id="entry-payment" className="w-full">
                <SelectValue>{(v: PaymentMethod) => t(`paymentMethods.${v}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`paymentMethods.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {kind === "INVESTMENT" && (
          <Field
            id="entry-institution"
            label={t("entries.fieldInstitution")}
            optional
            error={errors.institution}
          >
            <Input
              id="entry-institution"
              value={values.institution}
              onChange={(e) => set("institution", e.target.value)}
              placeholder={t("entries.institutionPlaceholder")}
              maxLength={80}
            />
          </Field>
        )}

        <Field
          id="entry-description"
          label={t("entries.fieldDescription")}
          optional
          error={errors.description}
        >
          <Input
            id="entry-description"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={t("entries.descriptionPlaceholder")}
            maxLength={120}
          />
        </Field>

        <Field id="entry-notes" label={t("entries.fieldNotes")} optional error={errors.notes}>
          <Textarea
            id="entry-notes"
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder={t("entries.notesPlaceholder")}
            maxLength={500}
            rows={2}
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("entries.cancel")}
          </Button>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={saving || !values.amount || !values.categoryId}
          >
            {saving ? t("entries.saving") : t(editing ? "entries.save" : "entries.create")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({
  id,
  label,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {optional && (
          <span className="font-normal text-muted-foreground"> ({t("entries.optional")})</span>
        )}
      </Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
