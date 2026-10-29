"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Lock, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ColorDot, useCategoryName } from "@/components/categories/category-label";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translator";
import { ENTRY_KINDS, type CategoryDto, type EntryKind } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { CategoryDialog } from "./category-dialog";
import { DeleteDialog } from "./delete-dialog";

// Expenses first: by far the kind users manage most
const TAB_ORDER: EntryKind[] = ["EXPENSE", "INCOME", "INVESTMENT"];
const TAB_LABEL: Record<EntryKind, MessageKey> = {
  EXPENSE: "nav.expenses",
  INCOME: "nav.incomes",
  INVESTMENT: "nav.investments",
};

function parseKind(value: string | null): EntryKind {
  const upper = value?.toUpperCase();
  return ENTRY_KINDS.includes(upper as EntryKind) ? (upper as EntryKind) : "EXPENSE";
}

export function CategoriesManager({ initial }: { initial: CategoryDto[] }) {
  const t = useT();
  const nameOf = useCategoryName();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const kind = parseKind(searchParams.get("kind"));

  const [categories, setCategories] = useState(initial);
  const [editing, setEditing] = useState<{ kind: EntryKind; category?: CategoryDto } | null>(null);
  const [deleting, setDeleting] = useState<CategoryDto | null>(null);

  const ofKind = categories.filter((c) => c.kind === kind);
  const system = ofKind.filter((c) => c.isSystem);
  // Active first, then archived; alphabetical within each group
  const own = ofKind
    .filter((c) => !c.isSystem)
    .sort((a, b) => Number(!a.isActive) - Number(!b.isActive) || a.name.localeCompare(b.name));

  const selectKind = (k: EntryKind) =>
    router.replace(`${pathname}?kind=${k.toLowerCase()}`, { scroll: false });

  const upsert = (c: CategoryDto) =>
    setCategories((list) =>
      list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c]
    );

  async function toggleActive(c: CategoryDto, isActive: boolean) {
    upsert({ ...c, isActive }); // optimistic
    try {
      const res = await fetch(`/api/categories/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error();
      upsert((await res.json()).category);
      toast.success(t(isActive ? "categories.restoredToast" : "categories.archivedToast"));
    } catch {
      upsert(c); // revert
      toast.error(t("common.somethingWrong"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={kind} onValueChange={(v) => selectKind(v as EntryKind)}>
          <TabsList>
            {TAB_ORDER.map((k) => (
              <TabsTrigger key={k} value={k}>
                {t(TAB_LABEL[k])}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          onClick={() => setEditing({ kind })}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
        >
          <Plus />
          {t("categories.new")}
        </Button>
      </div>

      <Card className="shadow-lg border-border/60">
        <CardHeader>
          <CardTitle>{t("categories.yours")}</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          {own.length === 0 ? (
            <EmptyState
              icon={Tag}
              title={t("categories.emptyTitle")}
              description={t("categories.emptyBody")}
              action={{ label: t("categories.new"), onClick: () => setEditing({ kind }) }}
              className="py-10"
            />
          ) : (
            <ul className="divide-y">
              {own.map((c) => (
                <li
                  key={c.id}
                  className={cn("flex items-center gap-3 px-2 py-2.5", !c.isActive && "opacity-60")}
                >
                  <ColorDot color={c.color} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                  {!c.isActive && <Badge variant="outline">{t("categories.archived")}</Badge>}
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <span className="hidden sm:inline">{t("categories.active")}</span>
                    <Switch
                      checked={c.isActive}
                      onCheckedChange={(v) => toggleActive(c, v)}
                      aria-label={`${t("categories.active")}: ${c.name}`}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditing({ kind, category: c })}
                    aria-label={`${t("categories.edit")}: ${c.name}`}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleting(c)}
                    aria-label={`${t("categories.delete")}: ${c.name}`}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg border-border/60">
        <CardHeader>
          <CardTitle>{t("categories.defaults")}</CardTitle>
          <CardDescription>{t("categories.defaultsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {system.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-2 py-2 text-sm">
                <ColorDot color={c.color} />
                <span className="min-w-0 flex-1 truncate">{nameOf(c)}</span>
                <Lock
                  className="size-3.5 text-muted-foreground"
                  aria-label={t("categories.default")}
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <CategoryDialog
        state={editing}
        onClose={() => setEditing(null)}
        onSaved={(c) => {
          upsert(c);
          setEditing(null);
        }}
      />
      <DeleteDialog
        category={deleting}
        onClose={() => setDeleting(null)}
        onDone={(id, result) => {
          setCategories((list) =>
            result === "deleted"
              ? list.filter((c) => c.id !== id)
              : list.map((c) => (c.id === id ? { ...c, isActive: false } : c))
          );
          setDeleting(null);
        }}
      />
    </div>
  );
}
