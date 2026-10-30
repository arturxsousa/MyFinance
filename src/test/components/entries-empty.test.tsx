import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@/i18n/client";
import { messages } from "@/i18n/messages";
import { EntriesList } from "@/components/entries/entries-list";
import type { EntryList } from "@/lib/entry-api";
import type { EntryKind } from "@/lib/entries";

const emptyList: EntryList = {
  month: "2026-10",
  entries: [],
  total: "0.00",
  page: 1,
  pageSize: 20,
  totalCount: 0,
  totalPages: 1,
  stats: {
    previousMonth: "2026-09",
    previousTotal: "0.00",
    previousCount: 0,
    largest: null,
    scheduledTotal: "0.00",
    scheduledCount: 0,
  },
};

function setup(kind: EntryKind, query: Record<string, unknown> = {}) {
  const handlers = {
    setParams: vi.fn(),
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
  };
  render(
    <I18nProvider locale="pt-BR" messages={messages["pt-BR"]}>
      <EntriesList
        kind={kind}
        list={emptyList}
        query={{ sort: "date_desc", page: 1, q: undefined, ...query }}
        categories={[]}
        currency="BRL"
        currentMonth="2026-10"
        today="2026-10-29"
        {...handlers}
      />
    </I18nProvider>
  );
  return handlers;
}

describe("entries empty states (Phase 6 step 7)", () => {
  it.each([
    ["EXPENSE", "Nenhuma despesa em Outubro de 2026", "Nova despesa"],
    ["INCOME", "Nenhuma receita em Outubro de 2026", "Nova receita"],
    ["INVESTMENT", "Nenhum investimento em Outubro de 2026", "Novo investimento"],
  ] as const)(
    "%s: per-kind message and an add button that opens the form",
    (kind, title, button) => {
      const { onCreate } = setup(kind);
      expect(screen.getByText(title)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: button }));
      expect(onCreate).toHaveBeenCalledOnce();
    }
  );

  it("with filters active, offers to clear them instead", () => {
    const { setParams, onCreate } = setup("EXPENSE", { q: "mercado" });
    expect(screen.getByText("Nenhum lançamento corresponde aos filtros")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(setParams).toHaveBeenCalledWith({ q: null, category: null });
    expect(onCreate).not.toHaveBeenCalled();
  });
});
