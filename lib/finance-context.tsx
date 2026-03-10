"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Income = {
  id: number;
  source: string;
  type: string;
  amount: number;
  date: string;
};

export type Expense = {
  id: number;
  source: string;
  type: string;
  amount: number;
  date: string;
};

export type Investment = {
  id: number;
  source: string;
  type: string;
  amount: number;
  date: string;
};

const defaultIncomes: Income[] = [
  { id: 1, source: "Employer",         type: "Salary",     amount: 3500, date: "2026-03-01" },
  { id: 2, source: "Freelance Client", type: "Freelance",  amount: 800,  date: "2026-03-03" },
  { id: 3, source: "Dividends",        type: "Investment", amount: 220,  date: "2026-03-05" },
  { id: 4, source: "Rental Property",  type: "Rental",     amount: 600,  date: "2026-03-05" },
  { id: 5, source: "Side Project",     type: "Freelance",  amount: 350,  date: "2026-03-07" },
  { id: 6, source: "Bank Interest",    type: "Investment", amount: 30,   date: "2026-03-08" },
];

const defaultInvestments: Investment[] = [
  { id: 1, source: "S&P 500 ETF",   type: "ETF",        amount: 500, date: "2026-03-01" },
  { id: 2, source: "Bitcoin",        type: "Crypto",     amount: 200, date: "2026-03-03" },
  { id: 3, source: "Apple Stock",    type: "Stock",      amount: 150, date: "2026-03-05" },
  { id: 4, source: "Savings Bond",   type: "Bond",       amount: 100, date: "2026-03-07" },
  { id: 5, source: "Real Estate Fund", type: "REIT",    amount: 50,  date: "2026-03-08" },
];

const defaultExpenses: Expense[] = [
  { id: 1, source: "Supermarket",     type: "Food",          amount: 220,  date: "2026-03-01" },
  { id: 2, source: "Landlord",        type: "Rent",          amount: 1500, date: "2026-03-01" },
  { id: 3, source: "Netflix",         type: "Entertainment", amount: 18,   date: "2026-03-03" },
  { id: 4, source: "Pharmacy",        type: "Health",        amount: 45,   date: "2026-03-04" },
  { id: 5, source: "Restaurant",      type: "Food",          amount: 65,   date: "2026-03-05" },
  { id: 6, source: "Spotify",         type: "Entertainment", amount: 10,   date: "2026-03-06" },
  { id: 7, source: "Electric Bill",   type: "Utilities",     amount: 95,   date: "2026-03-07" },
  { id: 8, source: "Gas Station",     type: "Transport",     amount: 80,   date: "2026-03-07" },
  { id: 9, source: "Online Shopping", type: "Other",         amount: 130,  date: "2026-03-08" },
  { id: 10, source: "Gym",            type: "Health",        amount: 40,   date: "2026-03-08" },
];

type FinanceContextType = {
  incomes: Income[];
  expenses: Expense[];
  investments: Investment[];
  addIncome: (income: Omit<Income, "id">) => void;
  deleteIncome: (id: number) => void;
  addExpense: (expense: Omit<Expense, "id">) => void;
  deleteExpense: (id: number) => void;
  addInvestment: (investment: Omit<Investment, "id">) => void;
  deleteInvestment: (id: number) => void;
};

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [incomes, setIncomes] = useState<Income[]>(() => {
    if (typeof window === "undefined") return defaultIncomes;
    const stored = localStorage.getItem("incomes");
    return stored ? JSON.parse(stored) : defaultIncomes;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    if (typeof window === "undefined") return defaultExpenses;
    const stored = localStorage.getItem("expenses");
    return stored ? JSON.parse(stored) : defaultExpenses;
  });

  const [investments, setInvestments] = useState<Investment[]>(() => {
    if (typeof window === "undefined") return defaultInvestments;
    const stored = localStorage.getItem("investments");
    return stored ? JSON.parse(stored) : defaultInvestments;
  });

  useEffect(() => {
    localStorage.setItem("incomes", JSON.stringify(incomes));
  }, [incomes]);

  useEffect(() => {
    localStorage.setItem("expenses", JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem("investments", JSON.stringify(investments));
  }, [investments]);

  function addIncome(income: Omit<Income, "id">) {
    setIncomes((prev) => [...prev, { ...income, id: Date.now() }]);
  }

  function deleteIncome(id: number) {
    setIncomes((prev) => prev.filter((i) => i.id !== id));
  }

  function addExpense(expense: Omit<Expense, "id">) {
    setExpenses((prev) => [...prev, { ...expense, id: Date.now() }]);
  }

  function deleteExpense(id: number) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function addInvestment(investment: Omit<Investment, "id">) {
    setInvestments((prev) => [...prev, { ...investment, id: Date.now() }]);
  }

  function deleteInvestment(id: number) {
    setInvestments((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <FinanceContext.Provider value={{ incomes, expenses, investments, addIncome, deleteIncome, addExpense, deleteExpense, addInvestment, deleteInvestment }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used inside FinanceProvider");
  return ctx;
}
