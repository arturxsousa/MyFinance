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

function LoginForm() {
  const router = useRouter();
  const t = useT();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const registered = searchParams.get("registered") === "1";
  const verified = searchParams.get("verified") === "1";
  const reset = searchParams.get("reset") === "1";
  const verifyError = searchParams.get("verify_error") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push(next);
        router.refresh();
        return;
      }

      const data = await res.json();
      const code = data?.error?.code;

      if (code === "ACCOUNT_LOCKED") {
        setError(t("login.locked"));
      } else if (code === "ACCOUNT_INACTIVE") {
        setError(t("login.inactive"));
      } else {
        setError(t("login.invalidCredentials"));
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
      {/* Brand */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30">
          <TrendingUp className="h-7 w-7 text-white" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t("common.appName")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("common.tagline")}</p>
        </div>
      </div>

      {/* Card */}
      <Card className="w-full max-w-sm shadow-lg border-border/60">
        <CardContent className="pt-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("common.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t("common.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {registered && <p className="text-sm text-emerald-600">{t("login.registered")}</p>}
            {verified && <p className="text-sm text-emerald-600">{t("login.verified")}</p>}
            {reset && <p className="text-sm text-emerald-600">{t("login.reset")}</p>}
            {verifyError && <p className="text-sm text-destructive">{t("login.verifyError")}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center justify-between">
              <Link href="/forgot-password" className="text-sm text-emerald-600 hover:underline">
                {t("login.forgot")}
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
              disabled={loading}
            >
              {loading ? t("login.submitting") : t("login.submit")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("login.noAccount")}{" "}
              <Link href="/register" className="text-emerald-600 hover:underline font-medium">
                {t("login.signUp")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">{t("common.footer")}</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
