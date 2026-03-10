"use client";

import { useFinance } from "@/lib/finance-context";
import SummaryCard from "@/components/SummaryCard";
import SpendingChart from "@/components/SpendingChart";
import BalanceHistory from "@/components/BalanceHistory";

export default function DashboardPage() {
  const { incomes, expenses, investments } = useFinance();

  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalInvested = investments.reduce((sum, i) => sum + i.amount, 0);
  const totalSavings = totalIncome - totalExpenses - totalInvested;

  const summaryData = [
    { title: "Total Income",   amount: `$${totalIncome.toLocaleString()}`,   color: "border-emerald-400" },
    { title: "Total Expenses", amount: `$${totalExpenses.toLocaleString()}`, color: "border-rose-500" },
    { title: "Total Invested", amount: `$${totalInvested.toLocaleString()}`, color: "border-blue-400" },
    { title: "Total Savings",  amount: `$${totalSavings.toLocaleString()}`,  color: "border-violet-500" },
  ];

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Personal Finance Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryData.map((card) => (
          <SummaryCard key={card.title} title={card.title} amount={card.amount} color={card.color} />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendingChart />
        <BalanceHistory />
      </div>
    </main>
  );
}
