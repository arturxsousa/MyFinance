"use client";

import { useState } from "react";

const allMonths = [
  { month: "Apr 2025", income: 4800, spendings: 3100, invested: 900 },
  { month: "May 2025", income: 5100, spendings: 3400, invested: 1000 },
  { month: "Jun 2025", income: 4900, spendings: 2900, invested: 1200 },
  { month: "Jul 2025", income: 5200, spendings: 3600, invested: 800 },
  { month: "Aug 2025", income: 5000, spendings: 3200, invested: 1100 },
  { month: "Sep 2025", income: 5300, spendings: 3500, invested: 950 },
  { month: "Oct 2025", income: 4700, spendings: 3000, invested: 1000 },
  { month: "Nov 2025", income: 5500, spendings: 3800, invested: 1300 },
  { month: "Dec 2025", income: 6200, spendings: 4500, invested: 1000 },
  { month: "Jan 2026", income: 5000, spendings: 3300, invested: 1100 },
  { month: "Feb 2026", income: 5100, spendings: 3100, invested: 1200 },
  { month: "Mar 2026", income: 5000, spendings: 3200, invested: 1000 },
];

const FILTERS = [3, 6, 12] as const;
type Filter = (typeof FILTERS)[number];

export default function BalanceHistory() {
  const [months, setMonths] = useState<Filter>(3);

  const data = allMonths.slice(-months);

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
              <tr key={row.month} className="border-b border-gray-800 last:border-0">
                <td className="py-3 text-gray-300 font-medium">{row.month}</td>
                <td className="py-3 text-right text-emerald-400">${row.income.toLocaleString()}</td>
                <td className="py-3 text-right text-rose-400">${row.spendings.toLocaleString()}</td>
                <td className="py-3 text-right text-blue-400">${row.invested.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
