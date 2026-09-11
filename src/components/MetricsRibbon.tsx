import {
  CheckCircle, XCircle, Clock, Zap, TrendingDown, Wallet,
} from 'lucide-react';

type Props = {
  present: number;
  absent: number;
  half: number;
  otHours: number;
  advancePayout: number;
  dailyCost: number;
};

export default function MetricsRibbon({
  present, absent, half, otHours, advancePayout, dailyCost,
}: Props) {
  const cards = [
    { label: 'Present', value: String(present), icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/40', border: 'border-green-200 dark:border-green-900' },
    { label: 'Absent', value: String(absent), icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-900' },
    { label: 'Half Day', value: String(half), icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-900' },
    { label: 'OT Hours', value: otHours.toFixed(1), icon: Zap, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-900' },
    { label: 'Advances', value: `\u20B9${advancePayout.toFixed(0)}`, icon: TrendingDown, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-900' },
    { label: 'Est. Daily Cost', value: `\u20B9${dailyCost.toFixed(0)}`, icon: Wallet, color: 'text-slate-700 dark:text-slate-200', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-6">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className={`${c.bg} ${c.border} border rounded-xl p-3 flex flex-col items-center justify-center transition-all hover:scale-[1.02]`}
          >
            <Icon className={`w-5 h-5 ${c.color} mb-1`} />
            <p className={`text-lg font-bold ${c.color} leading-none`}>{c.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 text-center">{c.label}</p>
          </div>
        );
      })}
    </div>
  );
}
