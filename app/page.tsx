"use client";

import { useState } from "react";
import { useFinance } from "@/lib/finance-context";
import SummaryCard from "@/components/SummaryCard";
import SpendingChart from "@/components/SpendingChart";
import BalanceHistory from "@/components/BalanceHistory";

export default function DashboardPage() {
  const { incomes, expenses, investments, closeMonth } = useFinance();
  const [showConfirm, setShowConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  const totalIncome   = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalInvested = investments.reduce((sum, i) => sum + i.amount, 0);
  const totalSavings  = totalIncome - totalExpenses - totalInvested;

  const currentMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  const summaryData = [
    { title: "Total Income",   amount: `$${totalIncome.toLocaleString()}`,   color: "border-emerald-400" },
    { title: "Total Expenses", amount: `$${totalExpenses.toLocaleString()}`, color: "border-rose-500" },
    { title: "Total Invested", amount: `$${totalInvested.toLocaleString()}`, color: "border-blue-400" },
    { title: "Total Savings",  amount: `$${totalSavings.toLocaleString()}`,  color: "border-violet-500" },
  ];

  async function handleCloseMonth() {
    setClosing(true);
    await closeMonth();
    setClosing(false);
    setShowConfirm(false);
  }

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Personal Finance Dashboard</h1>
        <button
          onClick={() => setShowConfirm(true)}
          className="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 hover:text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Close Month
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryData.map((card) => (
          <SummaryCard key={card.title} title={card.title} amount={card.amount} color={card.color} />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendingChart />
        <BalanceHistory />
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-2">Close {currentMonth}?</h2>
            <p className="text-gray-400 text-sm mb-6">
              This will save a snapshot of your current totals to Balance History and reset all incomes, expenses and investments for the new month.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseMonth}
                disabled={closing}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {closing ? "Closing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
