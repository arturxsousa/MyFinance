"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/i18n/client";
import type { CategoryDto, EntryKind } from "@/lib/categories";
import { ColorPicker, CATEGORY_COLORS } from "./color-picker";

interface Props {
  /** null = closed; { kind } = create; { category } = edit */
  state: { kind: EntryKind; category?: CategoryDto } | null;
  onClose: () => void;
  onSaved: (category: CategoryDto, created: boolean) => void;
}

export function CategoryDialog({ state, onClose, onSaved }: Props) {
  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      {/* Keyed so the form resets every time it opens */}
      {state && (
        <CategoryForm
          key={state.category?.id ?? `new-${state.kind}`}
          {...{ state, onClose, onSaved }}
        />
      )}
    </Dialog>
  );
}

function CategoryForm({ state, onClose, onSaved }: Props & { state: NonNullable<Props["state"]> }) {
  const t = useT();
  const editing = state.category;
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? CATEGORY_COLORS[0]!);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/categories/${editing.id}` : "/api/categories", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { name, color } : { kind: state.kind, name, color }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t(editing ? "categories.updated" : "categories.created"));
        onSaved(data.category, !editing);
        return;
      }
      const fieldMsg = data?.error?.fields?.name?.[0] ?? data?.error?.fields?.color?.[0];
      setError(fieldMsg ? t.dynamic(fieldMsg, "validation.invalid") : t("common.somethingWrong"));
    } catch {
      setError(t("common.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent closeLabel={t("common.close")}>
      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t(editing ? "categories.editTitle" : "categories.createTitle")}
            <Badge variant="secondary">{t(`kinds.${state.kind}`)}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="category-name">{t("categories.name")}</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder={t("categories.namePlaceholder")}
            maxLength={50}
            autoFocus
            aria-invalid={!!error}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="space-y-2">
          <Label>{t("categories.color")}</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("categories.cancel")}
          </Button>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={saving || !name.trim()}
          >
            {saving ? t("categories.saving") : t(editing ? "categories.save" : "categories.create")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
