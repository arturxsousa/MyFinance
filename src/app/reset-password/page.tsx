"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/i18n/client";

const bg = {
  backgroundImage:
    "radial-gradient(ellipse 80% 50% at 50% -5%, oklch(0.5 0.15 145 / 0.12), transparent)",
};

function Logo() {
  const t = useT();
  return (
    <div className="mb-8 flex flex-col items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30">
        <TrendingUp className="h-7 w-7 text-white" strokeWidth={2.5} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{t("common.appName")}</h1>
    </div>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const t = useT();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("reset.mismatch"));
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (res.ok) {
        router.push("/login?reset=1");
        return;
      }

      if (data?.error?.fields?.password) {
        setError(t.dynamic(data.error.fields.password[0], "validation.invalid"));
      } else {
        setError(t("reset.invalidLink"));
      }
    } catch {
      setError(t("common.somethingWrong"));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 bg-background"
        style={bg}
      >
        <Logo />
        <Card className="w-full max-w-sm shadow-lg border-border/60 text-center">
          <CardContent className="pt-8 pb-8 space-y-3">
            <p className="text-sm text-muted-foreground">{t("reset.invalidLink")}</p>
            <Link
              href="/forgot-password"
              className="block text-sm text-emerald-600 hover:underline font-medium"
            >
              {t("reset.requestNew")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 bg-background"
      style={bg}
    >
      <Logo />
      <Card className="w-full max-w-sm shadow-lg border-border/60">
        <CardContent className="pt-6 pb-6">
          <div className="mb-5">
            <h2 className="text-base font-bold">{t("reset.title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("reset.subtitle")}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("reset.newPassword")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder={t("common.passwordHint")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">{t("reset.confirm")}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder={t("reset.confirmPlaceholder")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
              disabled={loading}
            >
              {loading ? t("reset.submitting") : t("reset.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
