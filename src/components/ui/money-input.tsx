"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface MoneyInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value?: number;
  onChange?: (value: number) => void;
  currency?: string;
  locale?: string;
}

function formatMoney(value: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function MoneyInput({
  value = 0,
  onChange,
  currency = "BRL",
  locale = "pt-BR",
  className,
  ...props
}: MoneyInputProps) {
  const [rawDigits, setRawDigits] = React.useState("");
  const [focused, setFocused] = React.useState(false);

  // When not focused, always show the formatted value; when focused, show raw digits
  const display = focused ? rawDigits : formatMoney(value, currency, locale);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    const digits = String(Math.round(value * 100));
    setRawDigits(digits === "0" ? "" : digits);
    e.target.select();
    props.onFocus?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    setRawDigits(digits);
    onChange?.(digits ? parseInt(digits, 10) / 100 : 0);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    setRawDigits("");
    props.onBlur?.(e);
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={display}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  );
}
