"use client";

import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/i18n/client";
import type { EntryDto } from "@/lib/entry-api";

export interface EntryActions {
  onEdit: (entry: EntryDto) => void;
  onDelete: (entry: EntryDto) => void;
  onDuplicate: (entry: EntryDto) => void;
}

/** The ⋯ menu at the end of a row. Clicks don't bubble to the row (which opens edit). */
export function EntryRowMenu({
  entry,
  onEdit,
  onDelete,
  onDuplicate,
}: EntryActions & { entry: EntryDto }) {
  const t = useT();
  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${t("entries.actions")}: ${entry.description ?? entry.entryDate}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(entry)}>
            <Pencil />
            {t("entries.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDuplicate(entry)}>
            <Copy />
            {t("entries.duplicate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(entry)}>
            <Trash2 />
            {t("entries.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
