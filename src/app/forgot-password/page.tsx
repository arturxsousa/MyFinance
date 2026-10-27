"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setDone(true);
      setLoading(false);
    }
  }

  const bg = {
    backgroundImage:
      "radial-gradient(ellipse 80% 50% at 50% -5%, oklch(0.5 0.15 145 / 0.12), transparent)",
  };

  const logo = (
    <div className="mb-8 flex flex-col items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30">
        <TrendingUp className="h-7 w-7 text-white" strokeWidth={2.5} />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">My Finance</h1>
      </div>
    </div>
  );

  if (done) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 bg-background"
        style={bg}
      >
        {logo}
        <Card className="w-full max-w-sm shadow-lg border-border/60 text-center">
          <CardContent className="pt-8 pb-8 space-y-3">
            <h2 className="text-lg font-bold">Check your inbox</h2>
            <p className="text-sm text-muted-foreground">
              If an account exists for <strong>{email}</strong>, you&apos;ll receive a password
              reset link shortly.
            </p>
            <Link
              href="/login"
              className="block text-sm text-emerald-600 hover:underline font-medium pt-2"
            >
              Back to sign in
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
      {logo}
      <Card className="w-full max-w-sm shadow-lg border-border/60">
        <CardContent className="pt-6 pb-6">
          <div className="mb-5">
            <h2 className="text-base font-bold">Forgot your password?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
              disabled={loading}
            >
              {loading ? "Sending…" : "Send reset link"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="text-emerald-600 hover:underline font-medium">
                Back to sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
