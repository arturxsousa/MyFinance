"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CategoryDto } from "@/lib/categories";
import type { EntryKind, ListEntriesQuery } from "@/lib/entries";
import type { EntryList } from "@/lib/entry-api";
import { cn } from "@/lib/utils";
import { EntriesToolbar } from "./entries-toolbar";
import { EntriesList } from "./entries-list";
import { MonthSummary } from "./month-summary";
import { EntryFormDialog, type EntryFormState } from "./entry-form-dialog";
import { DeleteEntryDialog } from "./delete-entry-dialog";
import { DuplicateEntryDialog } from "./duplicate-entry-dialog";
import type { EntryDto } from "@/lib/entry-api";

export interface EntriesViewProps {
  kind: EntryKind;
  list: EntryList;
  query: ListEntriesQuery;
  categories: CategoryDto[];
  currency: string;
  currentMonth: string;
  /** Today in the user's timezone, "YYYY-MM-DD" */
  today: string;
}

export type SetParams = (changes: Record<string, string | number | null>) => void;

export function EntriesView(props: EntriesViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<EntryFormState>(null);
  const [deleting, setDeleting] = useState<EntryDto | null>(null);
  const [duplicating, setDuplicating] = useState<EntryDto | null>(null);
  const t = useT();

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
        <EntriesToolbar
          {...props}
          setParams={setParams}
          actions={
            <Button
              onClick={() => setForm({ mode: "create" })}
              className="hidden bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 sm:inline-flex"
            >
              <Plus />
              {t(`entries.new${props.kind}`)}
            </Button>
          }
        />
        <div className="xl:hidden">
          <MonthSummary {...props} />
        </div>
        <EntriesList
          {...props}
          setParams={setParams}
          onEdit={(entry) => setForm({ mode: "edit", entry })}
          onDelete={setDeleting}
          onDuplicate={setDuplicating}
          onCreate={() => setForm({ mode: "create" })}
        />
      </div>
      <aside className="hidden xl:block">
        <MonthSummary {...props} />
      </aside>

      {/* Mobile: floating add button, clear of the bottom edge */}
      <Button
        onClick={() => setForm({ mode: "create" })}
        size="icon-lg"
        className="fixed right-5 bottom-5 z-40 size-14 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 sm:hidden"
        aria-label={t(`entries.new${props.kind}`)}
      >
        <Plus className="size-6" />
      </Button>

      <EntryFormDialog
        kind={props.kind}
        state={form}
        categories={props.categories}
        currency={props.currency}
        today={props.today}
        viewedMonth={props.list.month}
        onClose={() => setForm(null)}
        onViewMonth={(month) => setParams({ month, q: null, category: null })}
        onDelete={(entry) => {
          // Swap the form for the confirmation rather than stacking dialogs
          setForm(null);
          setDeleting(entry);
        }}
        onDuplicate={(entry) => {
          setForm(null);
          setDuplicating(entry);
        }}
      />

      <DeleteEntryDialog
        kind={props.kind}
        entry={deleting}
        categories={props.categories}
        currency={props.currency}
        onClose={() => setDeleting(null)}
      />

      <DuplicateEntryDialog
        kind={props.kind}
        entry={duplicating}
        categories={props.categories}
        currency={props.currency}
        today={props.today}
        viewedMonth={props.list.month}
        onClose={() => setDuplicating(null)}
        onViewMonth={(month) => setParams({ month, q: null, category: null })}
      />
    </div>
  );
}
