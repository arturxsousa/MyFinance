"use client";

import { Check } from "lucide-react";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

export const CATEGORY_COLORS = [
  "#10b981",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#f59e0b",
  "#64748b",
];

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const t = useT();
  const isCustom = !CATEGORY_COLORS.includes(value.toLowerCase());

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="radiogroup"
      aria-label={t("categories.color")}
    >
      {CATEGORY_COLORS.map((c) => {
        const selected = value.toLowerCase() === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c}
            onClick={() => onChange(c)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected && "ring-2 ring-foreground/70"
            )}
            style={{ backgroundColor: c }}
          >
            {selected && <Check className="size-3.5 text-white" strokeWidth={3} />}
          </button>
        );
      })}

      {/* Native picker for anything outside the palette */}
      <label
        className={cn(
          "relative flex size-7 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background",
          "bg-[conic-gradient(from_0deg,#f43f5e,#f59e0b,#22c55e,#06b6d4,#6366f1,#ec4899,#f43f5e)]",
          "focus-within:ring-2 focus-within:ring-ring",
          isCustom && "ring-2 ring-foreground/70"
        )}
        title={t("categories.customColor")}
      >
        <span className="sr-only">{t("categories.customColor")}</span>
        {isCustom && (
          <span
            className="size-4 rounded-full ring-2 ring-white"
            style={{ backgroundColor: value }}
          />
        )}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
