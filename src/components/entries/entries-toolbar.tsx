"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorDot, useCategoryName } from "@/components/categories/category-label";
import { useLocale, useT } from "@/i18n/client";
import { ENTRY_SORTS } from "@/lib/entries";
import { formatMonthLabel, shiftMonth } from "@/lib/date";
import type { EntriesViewProps, SetParams } from "./entries-view";

const ALL = "all";

export function EntriesToolbar({
  list,
  query,
  categories,
  currentMonth,
  setParams,
}: EntriesViewProps & { setParams: SetParams }) {
  const t = useT();
  const locale = useLocale();
  const nameOf = useCategoryName();
  const month = list.month;

  // Filtering includes archived categories: old entries still use them
  const options = [...categories].sort(
    (a, b) => Number(!a.isActive) - Number(!b.isActive) || nameOf(a).localeCompare(nameOf(b))
  );
  const categoryLabel = (id: string) => {
    const c = categories.find((x) => x.id === id);
    if (!c) return t("entries.allCategories");
    return c.isActive ? nameOf(c) : `${nameOf(c)} (${t("categories.archivedSuffix")})`;
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      {/* Month picker */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setParams({ month: shiftMonth(month, -1) })}
          aria-label={t("entries.previousMonth")}
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-40 text-center text-sm font-medium tabular-nums">
          {formatMonthLabel(month, locale)}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setParams({ month: shiftMonth(month, 1) })}
          aria-label={t("entries.nextMonth")}
        >
          <ChevronRight />
        </Button>
        {month !== currentMonth && (
          <Button variant="ghost" size="sm" onClick={() => setParams({ month: null })}>
            {t("entries.thisMonth")}
          </Button>
        )}
      </div>

      <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto_auto] lg:justify-end">
        <SearchBox value={query.q ?? ""} onSearch={(q) => setParams({ q })} />

        <Select
          value={query.category ?? ALL}
          onValueChange={(v) => setParams({ category: v === ALL ? null : (v as string) })}
        >
          <SelectTrigger className="w-full sm:w-52" aria-label={t("entries.colCategory")}>
            <SelectValue>
              {(v: string) => (v === ALL ? t("entries.allCategories") : categoryLabel(v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("entries.allCategories")}</SelectItem>
            <SelectSeparator />
            {options.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <ColorDot color={c.color} />
                {categoryLabel(c.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={query.sort}
          onValueChange={(v) => setParams({ sort: v === "date_desc" ? null : (v as string) })}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label={t("entries.sortLabel")}>
            <SelectValue>
              {(v: string) => t(`entries.sort_${v as (typeof ENTRY_SORTS)[number]}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ENTRY_SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`entries.sort_${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Debounced so the list doesn't reload on every keystroke */
function SearchBox({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const t = useT();
  const [text, setText] = useState(value);
  const last = useRef(value);

  // Follow external changes (e.g. "Clear filters")
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (text.trim() === last.current.trim()) return;
    const id = setTimeout(() => {
      last.current = text;
      onSearch(text.trim());
    }, 350);
    return () => clearTimeout(id);
  }, [text, onSearch]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("entries.search")}
        aria-label={t("entries.search")}
        className="pl-8"
        maxLength={100}
      />
    </div>
  );
}
