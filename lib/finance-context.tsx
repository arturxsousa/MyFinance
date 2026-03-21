"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

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

type FinanceContextType = {
  incomes: Income[];
  expenses: Expense[];
  investments: Investment[];
  addIncome: (income: Omit<Income, "id">) => Promise<void>;
  deleteIncome: (id: number) => Promise<void>;
  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  deleteExpense: (id: number) => Promise<void>;
  addInvestment: (investment: Omit<Investment, "id">) => Promise<void>;
  deleteInvestment: (id: number) => Promise<void>;
};

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        fetchAll();
      } else {
        setIncomes([]);
        setExpenses([]);
        setInvestments([]);
      }
    });
    // Fetch on mount if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchAll();
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchAll() {
    const [incomesRes, expensesRes, investmentsRes] = await Promise.all([
      supabase.from("incomes").select("*").order("date", { ascending: false }),
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase.from("investments").select("*").order("date", { ascending: false }),
    ]);
    if (incomesRes.data) setIncomes(incomesRes.data);
    if (expensesRes.data) setExpenses(expensesRes.data);
    if (investmentsRes.data) setInvestments(investmentsRes.data);
  }

  async function getUserId(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user.id ?? null;
  }

  async function addIncome(income: Omit<Income, "id">) {
    const user_id = await getUserId();
    if (!user_id) return;
    const { data } = await supabase.from("incomes").insert({ ...income, user_id }).select().single();
    if (data) setIncomes((prev) => [data, ...prev]);
  }

  async function deleteIncome(id: number) {
    await supabase.from("incomes").delete().eq("id", id);
    setIncomes((prev) => prev.filter((i) => i.id !== id));
  }

  async function addExpense(expense: Omit<Expense, "id">) {
    const user_id = await getUserId();
    if (!user_id) return;
    const { data } = await supabase.from("expenses").insert({ ...expense, user_id }).select().single();
    if (data) setExpenses((prev) => [data, ...prev]);
  }

  async function deleteExpense(id: number) {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  async function addInvestment(investment: Omit<Investment, "id">) {
    const user_id = await getUserId();
    if (!user_id) return;
    const { data } = await supabase.from("investments").insert({ ...investment, user_id }).select().single();
    if (data) setInvestments((prev) => [data, ...prev]);
  }

  async function deleteInvestment(id: number) {
    await supabase.from("investments").delete().eq("id", id);
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
