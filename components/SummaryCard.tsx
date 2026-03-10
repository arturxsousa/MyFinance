type SummaryCardProps = {
  title: string;
  amount: string;
  color: string;
};

export default function SummaryCard({ title, amount, color }: SummaryCardProps) {
  return (
    <div className={`rounded-xl border-l-4 p-6 bg-gray-900 shadow-lg ${color}`}>
      <p className="text-sm font-medium text-gray-400">{title}</p>
      <p className="mt-2 text-3xl font-bold text-white">{amount}</p>
    </div>
  );
}
