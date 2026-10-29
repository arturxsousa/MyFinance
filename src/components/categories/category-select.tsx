"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/i18n/client";
import type { CategoryDto, EntryKind } from "@/lib/categories";
import { ColorDot, useCategoryName } from "./category-label";

interface CategorySelectProps {
  /** All categories the user can see (e.g. from GET /api/categories); filtered here */
  categories: CategoryDto[];
  kind: EntryKind;
  value: string | null;
  onChange: (categoryId: string) => void;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
}

/**
 * Category picker for entry forms (BR-06): only the given kind, archived ones
 * hidden. If the current value is archived (editing an old entry), it stays
 * visible and selected so the entry keeps it — it just can't be picked anew.
 */
export function CategorySelect({
  categories,
  kind,
  value,
  onChange,
  id,
  invalid,
  disabled,
}: CategorySelectProps) {
  const t = useT();
  const nameOf = useCategoryName();

  const ofKind = categories.filter((c) => c.kind === kind);
  const byName = (a: CategoryDto, b: CategoryDto) => nameOf(a).localeCompare(nameOf(b));
  const own = ofKind.filter((c) => !c.isSystem && c.isActive).sort(byName);
  const system = ofKind.filter((c) => c.isSystem && c.isActive).sort(byName);
  const current = ofKind.find((c) => c.id === value);
  const archivedCurrent = current && !current.isActive ? current : undefined;

  const label = (c: CategoryDto) =>
    c.isActive ? nameOf(c) : `${nameOf(c)} (${t("categories.archivedSuffix")})`;

  const groups = [
    { key: "archived", label: null, items: archivedCurrent ? [archivedCurrent] : [] },
    { key: "own", label: t("categories.yours"), items: own },
    { key: "system", label: t("categories.defaults"), items: system },
  ].filter((g) => g.items.length > 0);

  return (
    <Select
      value={value}
      onValueChange={(v) => v && onChange(v as string)}
      disabled={disabled}
      items={ofKind.map((c) => ({ value: c.id, label: label(c) }))}
    >
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined}>
        <SelectValue placeholder={t("categories.selectPlaceholder")}>
          {(selected: string | null) => {
            const c = ofKind.find((x) => x.id === selected);
            if (!c) return t("categories.selectPlaceholder");
            return (
              <span className="flex min-w-0 items-center gap-2">
                <ColorDot color={c.color} />
                <span className="truncate">{label(c)}</span>
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {groups.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            {t("categories.noneAvailable")}
          </p>
        )}
        {groups.map((g, i) => (
          <SelectGroup key={g.key}>
            {i > 0 && <SelectSeparator />}
            {g.label && <SelectLabel>{g.label}</SelectLabel>}
            {g.items.map((c) => (
              <SelectItem key={c.id} value={c.id} disabled={!c.isActive}>
                <ColorDot color={c.color} />
                {label(c)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
