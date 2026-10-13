"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecionar data",
  className,
  disabled,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
              className
            )}
            disabled={disabled}
          />
        }
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} locale={ptBR} />
      </PopoverContent>
    </Popover>
  );
}
