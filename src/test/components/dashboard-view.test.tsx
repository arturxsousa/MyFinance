// Phase 9 step 3 — dashboard screen: month picker, summary cards, lists,
// quick add and the onboarding state for new users.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { I18nProvider } from "@/i18n/client";
import { messages } from "@/i18n/messages";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { Dashboard } from "@/lib/dashboard";
import type { CategoryDto } from "@/lib/categories";

const categories: CategoryDto[] = [
  {
    id: "c-food",
    kind: "EXPENSE",
    name: "Food",
    systemKey: "food",
    color: "#ea580c",
    isActive: true,
    isSystem: true,
  },
  {
    id: "c-salary",
    kind: "INCOME",
    name: "Salary",
    systemKey: "salary",
    color: "#22c55e",
    isActive: true,
    isSystem: true,
  },
];

const trend = Array.from({ length: 12 }, (_, i) => ({
  month: `2026-${String(i + 1).padStart(2, "0")}`,
  income: "0.00",
  expense: "0.00",
  investment: "0.00",
  balance: "0.00",
  investedToDate: "0.00",
}));

const data: Dashboard = {
  month: "2026-11",
  today: "2026-11-04",
  hasData: true,
  summary: {
    income: { total: "9700.50", change: 21.3 },
    expense: { total: "2650.20", change: -11.7 },
    investment: { total: "1000.00", change: null },
    balance: { total: "-50.00", change: 34.5 },
    savingsRate: { rate: 72.7, changePoints: 10.2 },
  },
  categories: { total: "2650.20", slices: [], other: null },
  trend,
  topExpenses: [
    {
      id: "e1",
      kind: "EXPENSE",
      categoryId: "c-food",
      amount: "450.00",
      entryDate: "2026-11-03",
      description: "Mercado",
      notes: null,
      recurrenceId: null,
      isScheduled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentMethod: "PIX",
    },
  ],
  upcoming: [
    {
      kind: "INCOME",
      source: "projected",
      id: "r1|2026-12-01",
      categoryId: "c-salary",
      description: null,
      amount: "8500.00",
      entryDate: "2026-12-01",
      recurring: true,
    },
  ],
};

function setup(overrides: Partial<Dashboard> = {}, currentMonth = "2026-11") {
  render(
    <I18nProvider locale="pt-BR" messages={messages["pt-BR"]}>
      <DashboardView
        data={{ ...data, ...overrides }}
        categories={categories}
        currency="BRL"
        currentMonth={currentMonth}
      />
    </I18nProvider>
  );
}

beforeEach(() => replace.mockReset());

describe("DashboardView", () => {
  it("shows the five summary figures with their change vs the previous month", () => {
    setup();
    expect(screen.getByText("R$ 9.700,50")).toBeInTheDocument();
    expect(screen.getByText("+21,3%")).toBeInTheDocument();
    expect(screen.getByText("-11,7%")).toBeInTheDocument(); // spending less: good news
    expect(screen.getByText("-R$ 50,00")).toBeInTheDocument(); // negative balance
    expect(screen.getByText("72,7%")).toBeInTheDocument();
    expect(screen.getByText("+10,2 p.p.")).toBeInTheDocument();
    expect(screen.getAllByText("vs. outubro").length).toBeGreaterThan(0);
    // invested had nothing last month
    expect(screen.getByText("Nada em outubro para comparar")).toBeInTheDocument();
  });

  it("a fall in expenses is shown as good (green), a rise in income too", () => {
    setup();
    expect(screen.getByText("-11,7%").closest("span")).toHaveClass("text-emerald-600");
    expect(screen.getByText("+21,3%").closest("span")).toHaveClass("text-emerald-600");
  });

  it("savings rate without income reads as such", () => {
    setup({ summary: { ...data.summary, savingsRate: { rate: null, changePoints: null } } });
    expect(screen.getByText("Sem receitas neste mês")).toBeInTheDocument();
  });

  it("lists top expenses and upcoming entries", () => {
    setup();
    const top = screen.getByText("Maiores despesas").closest("[data-slot=card]") as HTMLElement;
    expect(within(top).getByText("Mercado")).toBeInTheDocument();
    expect(within(top).getByText("R$ 450,00")).toBeInTheDocument();
    expect(within(top).getByRole("link", { name: /Ver todas/ })).toHaveAttribute(
      "href",
      "/expenses?month=2026-11&sort=amount_desc"
    );

    const upcoming = screen
      .getByText("Próximos 30 dias")
      .closest("[data-slot=card]") as HTMLElement;
    expect(within(upcoming).getByText("Salário")).toBeInTheDocument(); // category name when no description
    expect(within(upcoming).getByText("Previsto")).toBeInTheDocument();
    expect(within(upcoming).getByText("01/12/2026")).toBeInTheDocument();
  });

  it("empty lists say so", () => {
    setup({ topExpenses: [], upcoming: [] });
    expect(screen.getByText("Nenhuma despesa neste mês")).toBeInTheDocument();
    expect(screen.getByText("Nada previsto para os próximos 30 dias")).toBeInTheDocument();
  });

  it("the month picker moves the whole page; 'this month' goes back", () => {
    setup({ month: "2026-09" });
    expect(screen.getByText("Setembro de 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(replace).toHaveBeenLastCalledWith("/dashboard?month=2026-08", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(replace).toHaveBeenLastCalledWith("/dashboard?month=2026-10", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Mês atual" }));
    expect(replace).toHaveBeenLastCalledWith("/dashboard", { scroll: false });
  });

  it("moving onto the current month drops the ?month param", () => {
    setup({ month: "2026-10" });
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(replace).toHaveBeenLastCalledWith("/dashboard", { scroll: false });
  });

  it("quick add opens the entry form for that kind", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Nova despesa");
  });

  it("a new user gets onboarding instead of empty widgets", () => {
    setup({ hasData: false });
    expect(screen.getByText("Boas-vindas ao My Finance")).toBeInTheDocument();
    expect(screen.queryByText("Maiores despesas")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar primeira receita" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Nova receita");
  });
});
