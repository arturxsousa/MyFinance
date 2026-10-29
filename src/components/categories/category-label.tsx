"use client";

import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translator";
import type { CategoryDto } from "@/lib/categories";
import { cn } from "@/lib/utils";

/** System categories are stored in English; show them in the UI language. */
export function useCategoryName() {
  const t = useT();
  return (c: Pick<CategoryDto, "name" | "systemKey">) =>
    c.systemKey ? t(`systemCategories.${c.systemKey}` as MessageKey) : c.name;
}

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3 shrink-0 rounded-full ring-1 ring-black/10", className)}
      style={{ backgroundColor: color }}
    />
  );
}
