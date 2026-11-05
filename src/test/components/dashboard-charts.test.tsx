// Phase 9 step 3 — dashboard charts. The SVG itself needs a real layout, so
// these check what every reader gets: the legend/labels and the table twins.
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import { I18nProvider } from "@/i18n/client";
import { messages } from "@/i18n/messages";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { InvestmentsChart } from "@/components/dashboard/investments-chart";
import { trimLeadingEmpty } from "@/components/dashboard/chart-card";
import type { Dashboard } from "@/lib/dashboard";
import type { CategoryDto } from "@/lib/categories";

beforeAll(() => {
  // Recharts' ResponsiveContainer observes its size
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const cat = (id: string, systemKey: string, color: string): CategoryDto => ({
  id,
  kind: "EXPENSE",
  name: systemKey,
  systemKey,
  color,
  isActive: true,
  isSystem: true,
});
const categories = [cat("c1", "housing", "#f97316"), cat("c2", "food", "#ea580c")];

const trend = Array.from({ length: 12 }, (_, i) => {
  const month = i < 2 ? `2025-${11 + i}` : `2026-${String(i - 1).padStart(2, "0")}`;
  return {
    month,
    income: i === 11 ? "5000.00" : "0.00",
    expense: i === 11 ? "6000.00" : "0.00",
    investment: i === 10 ? "300.00" : "0.00",
    balance: i === 11 ? "-1000.00" : i === 10 ? "-300.00" : "0.00",
    investedToDate: i >= 10 ? "1300.00" : "1000.00",
  };
});

const data = {
  month: "2026-10",
  today: "2026-11-04",
  hasData: true,
  summary: {} as Dashboard["summary"],
  categories: {
    total: "3000.00",
    slices: [
      { categoryId: "c1", total: "2000.00", count: 1 },
      { categoryId: "c2", total: "700.00", count: 3 },
    ],
    other: { total: "300.00", count: 4, categories: 2 },
  },
  trend,
  topExpenses: [],
  upcoming: [],
} as Dashboard;

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nProvider locale="pt-BR" messages={messages["pt-BR"]}>
      {ui}
    </I18nProvider>
  );

describe("CategoryDonut (widget 2)", () => {
  it("names every slice with its amount and share, Other last, total in the middle", () => {
    wrap(<CategoryDonut data={data} categories={categories} currency="BRL" />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Moradia66,7%R$ 2.000,00");
    expect(items[1]).toHaveTextContent("Alimentação23,3%R$ 700,00");
    expect(items[2]).toHaveTextContent("Outras (2 categorias)10%R$ 300,00");
    expect(screen.getByText("R$ 3.000,00")).toBeInTheDocument();
  });

  it("hovering a row shows that slice in the hole instead of the total; leaving restores it", () => {
    wrap(<CategoryDonut data={data} categories={categories} currency="BRL" />);
    const hole = screen.getByText("R$ 3.000,00").parentElement!;
    fireEvent.mouseEnter(screen.getAllByRole("listitem")[1]!);
    expect(hole).toHaveTextContent("AlimentaçãoR$ 700,0023,3%");
    expect(screen.getAllByRole("listitem")[1]).toHaveClass("bg-muted");
    fireEvent.mouseLeave(screen.getAllByRole("listitem")[1]!);
    expect(hole).toHaveTextContent("DespesasR$ 3.000,00");
  });

  it("says so when there are no expenses", () => {
    wrap(
      <CategoryDonut
        data={{ ...data, categories: { total: "0.00", slices: [], other: null } }}
        categories={categories}
        currency="BRL"
      />
    );
    expect(screen.getByText("Nenhuma despesa neste mês")).toBeInTheDocument();
  });
});

describe("TrendChart (widget 3)", () => {
  it("has a legend for its three series and a table twin with every month", () => {
    wrap(<TrendChart data={data} currency="BRL" />);
    const card = screen.getByText("Últimos 12 meses").closest("[data-slot=card]") as HTMLElement;
    expect(within(card).getByText("Receitas")).toBeInTheDocument();
    expect(within(card).getByText("Saldo")).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Tabela" }));
    const rows = within(card).getAllByRole("row");
    // only the last two months have data → the empty start is trimmed to 6 months
    expect(rows).toHaveLength(7);
    expect(rows[1]).toHaveTextContent("Maio de 2026");
    expect(rows[6]).toHaveTextContent("Outubro de 2026R$ 5.000,00R$ 6.000,00-R$ 1.000,00");

    fireEvent.click(within(card).getByRole("button", { name: "Gráfico" }));
    expect(within(card).queryAllByRole("row")).toHaveLength(0);
  });
});

describe("InvestmentsChart (widget 4)", () => {
  it("shows the total invested and a table of contributions and running total", () => {
    wrap(<InvestmentsChart data={data} currency="BRL" />);
    const card = screen.getByText("Investimentos").closest("[data-slot=card]") as HTMLElement;
    expect(within(card).getByText("R$ 1.300,00")).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Tabela" }));
    const rows = within(card).getAllByRole("row");
    expect(rows[5]).toHaveTextContent("Setembro de 2026R$ 300,00R$ 1.300,00");
    expect(rows[1]).toHaveTextContent("Maio de 2026R$ 0,00R$ 1.000,00");
  });
});

describe("trimLeadingEmpty", () => {
  const m = (month: string, income = "0.00") => ({
    month,
    income,
    expense: "0.00",
    investment: "0.00",
  });
  const year = Array.from({ length: 12 }, (_, i) => m(`2026-${String(i + 1).padStart(2, "0")}`));

  it("starts at the first month with data", () => {
    const months = year.map((x) => (x.month === "2026-03" ? m(x.month, "1.00") : x));
    expect(trimLeadingEmpty(months).map((x) => x.month)[0]).toBe("2026-03");
  });

  it("keeps at least six months", () => {
    const months = year.map((x) => (x.month === "2026-11" ? m(x.month, "1.00") : x));
    expect(trimLeadingEmpty(months)).toHaveLength(6);
    expect(trimLeadingEmpty(year)).toHaveLength(6); // nothing at all
  });

  it("data in the first month keeps all twelve", () => {
    expect(trimLeadingEmpty([m("2026-01", "5.00"), ...year.slice(1)])).toHaveLength(12);
  });
});
