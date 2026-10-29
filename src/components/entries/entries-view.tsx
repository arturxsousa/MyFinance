"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CategoryDto } from "@/lib/categories";
import type { EntryKind, ListEntriesQuery } from "@/lib/entries";
import type { EntryList } from "@/lib/entry-api";
import { cn } from "@/lib/utils";
import { EntriesToolbar } from "./entries-toolbar";
import { EntriesList } from "./entries-list";
import { MonthSummary } from "./month-summary";

export interface EntriesViewProps {
  kind: EntryKind;
  list: EntryList;
  query: ListEntriesQuery;
  categories: CategoryDto[];
  currency: string;
  currentMonth: string;
}

export type SetParams = (changes: Record<string, string | number | null>) => void;

export function EntriesView(props: EntriesViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  /** Update the URL; the server re-renders the list. Filters reset to page 1. */
  const setParams: SetParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    if (!("page" in changes)) next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    // Wide screens: list on the left, summary panel on the right.
    // Smaller screens: summary card above the list.
    <div
      className={cn(
        "grid gap-4 transition-opacity xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start",
        pending && "opacity-60"
      )}
      aria-busy={pending}
    >
      <div className="min-w-0 space-y-4">
        <EntriesToolbar {...props} setParams={setParams} />
        <div className="xl:hidden">
          <MonthSummary {...props} />
        </div>
        <EntriesList {...props} setParams={setParams} />
      </div>
      <aside className="hidden xl:block">
        <MonthSummary {...props} />
      </aside>
    </div>
  );
}
