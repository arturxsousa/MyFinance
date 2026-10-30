"use client";

import * as React from "react";
import { enUS, ptBR } from "react-day-picker/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** Calendar date "YYYY-MM-DD" ("" = none) — no Date objects, no timezone shifts */
  value: string;
  onChange: (value: string) => void;
  locale: string;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
}

const LOCALES = { "pt-BR": ptBR, "en-US": enUS } as const;

// The calendar works in the browser's local time; a local-midnight Date round-trips safely
const toLocalDate = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y!, m! - 1, d);
};
const fromLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function DatePicker({
  value,
  onChange,
  locale,
  placeholder,
  id,
  className,
  disabled,
  invalid,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? toLocalDate(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            aria-invalid={invalid || undefined}
            className={cn(
              "w-full justify-start text-left font-normal tabular-nums",
              !value && "text-muted-foreground",
              className
            )}
            disabled={disabled}
          />
        }
      >
        <CalendarIcon className="mr-1" />
        {value ? formatDate(value, locale) : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) onChange(fromLocalDate(d));
            setOpen(false);
          }}
          locale={LOCALES[locale as keyof typeof LOCALES] ?? ptBR}
          captionLayout="dropdown"
          startMonth={new Date(2000, 0)}
          endMonth={new Date(new Date().getFullYear() + 5, 11)}
        />
      </PopoverContent>
    </Popover>
  );
}
