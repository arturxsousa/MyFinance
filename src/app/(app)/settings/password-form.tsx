"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/i18n/client";

type FieldName = "currentPassword" | "newPassword" | "confirm";
const EMPTY: Record<FieldName, string> = { currentPassword: "", newPassword: "", confirm: "" };

export function PasswordForm() {
  const t = useT();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = (key: FieldName, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (values.newPassword !== values.confirm) {
      setErrors({ confirm: t("password.mismatch") });
      return;
    }
    setSaving(true);
    setErrors({});

    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });

      if (res.ok) {
        setValues(EMPTY);
        toast.success(t("password.changed"));
        return;
      }

      const data = await res.json();
      const fields = (data?.error?.fields ?? {}) as Partial<Record<FieldName, string[]>>;
      setErrors(
        Object.fromEntries(
          Object.entries(fields).map(([k, msgs]) => [k, t.dynamic(msgs?.[0], "validation.invalid")])
        )
      );
      if (!Object.keys(fields).length) toast.error(t("password.failed"));
    } catch {
      toast.error(t("common.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  const field = (name: FieldName, label: string, autoComplete: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type="password"
        autoComplete={autoComplete}
        value={values[name]}
        onChange={(e) => set(name, e.target.value)}
        aria-invalid={!!errors[name]}
        required
      />
      {errors[name] && <p className="text-sm text-destructive">{errors[name]}</p>}
    </div>
  );

  return (
    <Card className="shadow-lg border-border/60">
      <CardHeader>
        <CardTitle>{t("password.title")}</CardTitle>
        <CardDescription>{t("password.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {field("currentPassword", t("password.current"), "current-password")}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("newPassword", t("password.new"), "new-password")}
            {field("confirm", t("password.confirm"), "new-password")}
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
              disabled={saving || !values.currentPassword || !values.newPassword}
            >
              {saving ? t("password.submitting") : t("password.submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
