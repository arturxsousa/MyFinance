"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/i18n/client";

export default function RegisterPage() {
  const router = useRouter();
  const t = useT();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    acceptedTerms: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, acceptedTerms: form.acceptedTerms || undefined }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/login?registered=1");
        router.refresh();
        return;
      }

      if (data?.error?.fields) {
        const mapped: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(data.error.fields)) {
          mapped[k] = t.dynamic((msgs as string[])[0], "validation.invalid");
        }
        setFieldErrors(mapped);
      } else {
        setError(t("common.somethingWrong"));
      }
    } catch {
      setError(t("common.somethingWrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 bg-background"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% -5%, oklch(0.5 0.15 145 / 0.12), transparent)",
      }}
    >
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30">
          <TrendingUp className="h-7 w-7 text-white" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t("common.appName")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("register.subtitle")}</p>
        </div>
      </div>

      <Card className="w-full max-w-sm shadow-lg border-border/60">
        <CardContent className="pt-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">{t("common.firstName")}</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  required
                />
                {fieldErrors.firstName && (
                  <p className="text-xs text-destructive">{fieldErrors.firstName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">{t("common.lastName")}</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  required
                />
                {fieldErrors.lastName && (
                  <p className="text-xs text-destructive">{fieldErrors.lastName}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("common.emailPlaceholder")}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                required
              />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t("common.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder={t("common.passwordHint")}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required
              />
              {fieldErrors.password && (
                <p className="text-xs text-destructive">{fieldErrors.password}</p>
              )}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-emerald-600"
                checked={form.acceptedTerms}
                onChange={(e) => set("acceptedTerms", e.target.checked)}
                required
              />
              <span className="text-sm text-muted-foreground leading-snug">
                {t("register.termsAgree")}{" "}
                <Link href="/terms" className="text-emerald-600 hover:underline">
                  {t("register.terms")}
                </Link>{" "}
                {t("register.termsAnd")}{" "}
                <Link href="/privacy" className="text-emerald-600 hover:underline">
                  {t("register.privacy")}
                </Link>
              </span>
            </label>
            {fieldErrors.acceptedTerms && (
              <p className="text-xs text-destructive">{fieldErrors.acceptedTerms}</p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
              disabled={loading}
            >
              {loading ? t("register.submitting") : t("register.submit")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("register.haveAccount")}{" "}
              <Link href="/login" className="text-emerald-600 hover:underline font-medium">
                {t("register.signIn")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
