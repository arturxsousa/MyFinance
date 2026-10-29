"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, LOCALE_NAMES, TIMEZONES, type ProfileInput } from "@/lib/preferences";
import { LOCALES } from "@/i18n/config";
import { useT } from "@/i18n/client";
import type { Profile } from "@/lib/profile";

type FieldErrors = Partial<Record<keyof ProfileInput, string[]>>;

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const t = useT();
  const [values, setValues] = useState<ProfileInput>({
    firstName: profile.firstName,
    lastName: profile.lastName,
    currency: profile.currency as ProfileInput["currency"],
    locale: profile.locale as ProfileInput["locale"],
    timezone: profile.timezone,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const currencies = CURRENCIES.map((c) => ({ value: c, label: t(`currencies.${c}`) }));
  const locales = LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }));
  const timezones: { value: string; label: string }[] = TIMEZONES.map((tz) => ({
    value: tz,
    label: t(`timezones.${tz}`),
  }));
  // Keep a saved zone selectable even if it isn't in the curated list
  if (!timezones.some((tz) => tz.value === profile.timezone)) {
    timezones.push({ value: profile.timezone, label: profile.timezone });
  }

  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        toast.success(t("settings.saved"));
        router.refresh();
        return;
      }

      const data = await res.json();
      if (data?.error?.fields) setErrors(data.error.fields);
      toast.error(
        t(data?.error?.code === "VALIDATION_ERROR" ? "settings.checkFields" : "settings.saveFailed")
      );
    } catch {
      toast.error(t("common.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="shadow-lg border-border/60">
      <CardHeader>
        <CardTitle>{t("settings.profileTitle")}</CardTitle>
        <CardDescription>{t("settings.profileDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="firstName" label={t("common.firstName")} error={errors.firstName}>
              <Input
                id="firstName"
                autoComplete="given-name"
                value={values.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                aria-invalid={!!errors.firstName}
                maxLength={60}
              />
            </Field>
            <Field id="lastName" label={t("common.lastName")} error={errors.lastName}>
              <Input
                id="lastName"
                autoComplete="family-name"
                value={values.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                aria-invalid={!!errors.lastName}
                maxLength={80}
              />
            </Field>
          </div>

          <Field id="email" label={t("common.email")}>
            <Input id="email" value={profile.email} disabled readOnly />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="currency" label={t("settings.currency")} error={errors.currency}>
              <PrefSelect
                id="currency"
                items={currencies}
                value={values.currency}
                onChange={(v) => set("currency", v as ProfileInput["currency"])}
              />
            </Field>
            <Field id="locale" label={t("settings.locale")} error={errors.locale}>
              <PrefSelect
                id="locale"
                items={locales}
                value={values.locale}
                onChange={(v) => set("locale", v as ProfileInput["locale"])}
              />
            </Field>
          </div>

          <Field id="timezone" label={t("settings.timezone")} error={errors.timezone}>
            <PrefSelect
              id="timezone"
              items={timezones}
              value={values.timezone}
              onChange={(v) => set("timezone", v)}
            />
          </Field>

          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
              disabled={saving}
            >
              {saving ? t("settings.saving") : t("settings.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error?.[0] && (
        <p className="text-sm text-destructive">{t.dynamic(error[0], "validation.invalid")}</p>
      )}
    </div>
  );
}

function PrefSelect({
  id,
  items,
  value,
  onChange,
}: {
  id: string;
  items: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v as string)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
