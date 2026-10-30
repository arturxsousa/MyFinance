"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface MoneyInputProps extends Omit<
  React.ComponentProps<"input">,
  "onChange" | "value" | "type"
> {
  /** Decimal string "1234.50", or "" when empty — never a float (BR-02) */
  value: string;
  onChange: (value: string) => void;
  currency: string;
  locale: string;
}

// numeric(14,2): 12 integer digits + 2 decimals
const MAX_DIGITS = 14;

/** "123456" (typed digits) → "1234.56" */
export function digitsToAmount(digits: string): string {
  const clean = digits.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITS);
  if (!clean) return "";
  const padded = clean.padStart(3, "0");
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

/** "1234.50" → "123450" */
const amountToDigits = (amount: string) => amount.replace(/\D/g, "").replace(/^0+/, "");

/**
 * Cash-register style: digits fill from the right, so typing 1 2 3 4 5 6
 * shows R$ 1.234,56. No decimal separator to get wrong in either locale,
 * and the value stays an exact decimal string.
 */
export function MoneyInput({
  value,
  onChange,
  currency,
  locale,
  className,
  ...props
}: MoneyInputProps) {
  const format = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [locale, currency]
  );
  const display = value ? format.format(Number(value)) : "";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(digitsToAmount(e.target.value));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Backspace drops the last digit even when the caret sits after "R$ " formatting
    if (e.key === "Backspace" && value) {
      e.preventDefault();
      onChange(digitsToAmount(amountToDigits(value).slice(0, -1)));
    }
    props.onKeyDown?.(e);
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={display}
      placeholder={props.placeholder ?? format.format(0)}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      // Keep the caret at the end: digits are always appended there
      onFocus={(e) => {
        const el = e.currentTarget;
        requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
        props.onFocus?.(e);
      }}
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-right text-base tabular-nums transition-colors outline-none md:text-sm",
        "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
    />
  );
}
