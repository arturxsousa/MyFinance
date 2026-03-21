"use client";

import { useState } from "react";
import { useFinance } from "@/lib/finance-context";

const FILTERS = [3, 6, 12] as const;
type Filter = (typeof FILTERS)[number];

export default function BalanceHistory() {
  const { balanceHistory } = useFinance();
  const [months, setMonths] = useState<Filter>(3);

  const data = balanceHistory.slice(-months);

  return (
    <div className="bg-gray-900 rounded-xl p-6 shadow-lg flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Balance History</h2>
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setMonths(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                months === f ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {f}M
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-auto flex-1">
        {data.length === 0 ? (
          <p className="text-gray-500 text-sm">No history yet. Close your first month to see it here.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 uppercase text-xs tracking-wider">
                <th className="text-left pb-3">Month</th>
                <th className="text-right pb-3">Income</th>
                <th className="text-right pb-3">Spendings</th>
                <th className="text-right pb-3">Invested</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-gray-800 last:border-0">
                  <td className="py-3 text-gray-300 font-medium">{row.month}</td>
                  <td className="py-3 text-right text-emerald-400">${row.income.toLocaleString()}</td>
                  <td className="py-3 text-right text-rose-400">${row.spendings.toLocaleString()}</td>
                  <td className="py-3 text-right text-blue-400">${row.invested.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
