"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useFinance } from "@/lib/finance-context";

const COLORS = ["#818cf8", "#34d399", "#f472b6", "#fb923c", "#60a5fa", "#facc15", "#94a3b8"];

type Tab = "spending" | "investments" | "incomes";

const TITLES: Record<Tab, string> = {
  spending: "Spending Breakdown",
  investments: "Investments Breakdown",
  incomes: "Incomes Breakdown",
};

export default function SpendingChart() {
  const { expenses, investments, incomes } = useFinance();
  const [tab, setTab] = useState<Tab>("spending");

  const source = tab === "spending" ? expenses : tab === "investments" ? investments : incomes;

  const grouped = source.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + e.amount;
    return acc;
  }, {});

  const data = Object.entries(grouped).map(([name, value]) => ({ name, value }));
  const total = source.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="bg-gray-900 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">{TITLES[tab]}</h2>
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
          {(["spending", "investments", "incomes"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                tab === t ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fill="#9ca3af" fontSize={13}>
            Total
          </text>
          <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="#f9fafb" fontSize={20} fontWeight={700}>
            ${total.toLocaleString()}
          </text>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#f9fafb" }}
            itemStyle={{ color: "#e5e7eb" }}
            labelStyle={{ color: "#a78bfa", fontWeight: 600 }}
          />
          <Legend
            iconType="circle"
            formatter={(value) => <span style={{ color: "#d1d5db" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
