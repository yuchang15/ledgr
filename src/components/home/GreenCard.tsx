import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EXPENSE_CATEGORIES, FinancialStatus } from '../../types';
import DonutChart from './DonutChart';
import type { Slice } from './DonutChart';

interface Props {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getStatus(income: number, expenses: number): FinancialStatus {
  if (income === 0) return expenses === 0 ? 'excellent' : 'critical';
  const ratio = expenses / income;
  if (ratio < 0.5) return 'excellent';
  if (ratio < 0.8) return 'sustained';
  return 'critical';
}

function GoldCoin() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="13" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5"/>
      <circle cx="14" cy="14" r="9" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.6"/>
      <text x="14" y="18.5" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#92400e">$</text>
    </svg>
  );
}

function SilverCoin() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="13" fill="#94a3b8" stroke="#64748b" strokeWidth="1.5"/>
      <circle cx="14" cy="14" r="9" fill="none" stroke="#cbd5e1" strokeWidth="1" opacity="0.6"/>
      <text x="14" y="18.5" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1e293b">$</text>
    </svg>
  );
}

function CopperCoin() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="13" fill="#b45309" stroke="#92400e" strokeWidth="1.5"/>
      <circle cx="14" cy="14" r="9" fill="none" stroke="#d97706" strokeWidth="1" opacity="0.6"/>
      <text x="14" y="18.5" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fef3c7">$</text>
    </svg>
  );
}

export default function GreenCard({ year, month, onPrev, onNext }: Props) {
  const { getMonthTransactions, getMonthIncome, getMonthExpenses } = useApp();

  const txs = getMonthTransactions(year, month);
  const totalIncome = getMonthIncome(year, month);
  const totalExpenses = getMonthExpenses(year, month);
  const remaining = totalIncome - totalExpenses;

  const status = getStatus(totalIncome, totalExpenses);

  const statusConfig = {
    excellent: { label: 'Excellent', Coin: GoldCoin, bg: 'rgba(251,191,36,0.2)', text: '#fbbf24' },
    sustained: { label: 'Sustained', Coin: SilverCoin, bg: 'rgba(148,163,184,0.2)', text: '#cbd5e1' },
    critical: { label: 'Critical', Coin: CopperCoin, bg: 'rgba(180,83,9,0.2)', text: '#f97316' },
  };
  const { label, Coin, bg, text } = statusConfig[status];

  // Build pie slices from expense categories
  const categoryTotals: Record<string, number> = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const slices: Slice[] = EXPENSE_CATEGORIES
    .filter(c => categoryTotals[c.id])
    .map(c => ({
      category: c.id,
      label: c.label,
      amount: categoryTotals[c.id],
      color: c.color,
    }));

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const isFuture = new Date(year, month) > new Date(now.getFullYear(), now.getMonth());

  return (
    <div className="mx-4 mt-4 rounded-3xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 40%, #166534 100%)' }}>

      {/* Month nav */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <button onClick={onPrev} className="w-7 h-7 rounded-full glass flex items-center justify-center active:scale-90 transition-transform">
          <ChevronLeft size={16} className="text-white" />
        </button>
        <span className="text-white font-semibold text-sm tracking-wide">
          {MONTHS[month]} {year}
        </span>
        <button onClick={onNext} disabled={isFuture} className="w-7 h-7 rounded-full glass flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30">
          <ChevronRight size={16} className="text-white" />
        </button>
      </div>

      {/* Financial status glass box */}
      <div className="mx-4 mb-3 rounded-2xl glass p-3 flex items-center gap-3">
        <Coin />
        <div>
          <p className="text-white/60 text-[10px] uppercase tracking-wider font-medium">Financial Status</p>
          <p className="font-bold text-base leading-tight" style={{ color: text }}>{label}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-white/60 text-[10px]">Score</p>
          <p className="text-white font-semibold text-sm">
            {status === 'excellent' ? '90+' : status === 'sustained' ? '60–79' : '<60'}
          </p>
        </div>
      </div>

      {/* Donut chart */}
      <div className="flex justify-center pb-2">
        <DonutChart slices={slices} total={totalExpenses} />
      </div>

      {/* Income / Remaining row */}
      <div className="mx-4 mb-4 grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-3">
          <p className="text-white/60 text-[10px] uppercase tracking-wider mb-1">Income</p>
          <p className="text-white font-bold text-base">${totalIncome.toLocaleString()}</p>
        </div>
        <div className="glass rounded-2xl p-3">
          <p className="text-white/60 text-[10px] uppercase tracking-wider mb-1">Remaining</p>
          <p className={`font-bold text-base ${remaining >= 0 ? 'text-white' : 'text-red-300'}`}>
            ${Math.abs(remaining).toLocaleString()}
            {remaining < 0 && <span className="text-[10px] ml-1">deficit</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
