"use client";

import { useState } from "react";
import { useFinance } from "@/lib/finance-context";

const TYPES = ["ETF", "Stock", "Crypto", "Bond", "REIT", "Other"];

const typeBadgeColor: Record<string, string> = {
  ETF:    "bg-blue-900 text-blue-300",
  Stock:  "bg-emerald-900 text-emerald-300",
  Crypto: "bg-orange-900 text-orange-300",
  Bond:   "bg-violet-900 text-violet-300",
  REIT:   "bg-pink-900 text-pink-300",
  Other:  "bg-gray-700 text-gray-300",
};

const empty = { source: "", type: "ETF", amount: "", date: "" };

export default function InvestmentsPage() {
  const { investments, addInvestment, deleteInvestment } = useFinance();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(empty);

  function handleAdd() {
    if (!form.source || !form.amount || !form.date) return;
    addInvestment({ source: form.source, type: form.type, amount: Number(form.amount), date: form.date });
    setForm(empty);
    setShowModal(false);
  }

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Investments</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add Investment
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 uppercase text-xs tracking-wider">
              <th className="text-left px-6 py-4">Investment Source</th>
              <th className="text-left px-6 py-4">Type</th>
              <th className="text-right px-6 py-4">Total Amount</th>
              <th className="text-right px-6 py-4">Date</th>
              <th className="px-6 py-4" />
            </tr>
          </thead>
          <tbody>
            {investments.map((investment) => (
              <tr
                key={investment.id}
                className="border-b border-gray-800 last:border-0 hover:bg-gray-800 transition-colors"
              >
                <td className="px-6 py-4 font-medium text-white">{investment.source}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${typeBadgeColor[investment.type] ?? typeBadgeColor.Other}`}>
                    {investment.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-blue-400 font-semibold">
                  ${investment.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right text-gray-400">{investment.date}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => deleteInvestment(investment.id)}
                    className="text-gray-600 hover:text-rose-400 transition-colors text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-6">Add Investment</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Investment Source</label>
                <input
                  type="text"
                  placeholder="e.g. S&P 500 ETF"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Amount ($)</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setForm(empty); }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
