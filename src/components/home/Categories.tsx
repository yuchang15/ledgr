import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../types';
import CategoryIcon from './CategoryIcon';

interface Props {
  year: number;
  month: number;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Categories({ year, month }: Props) {
  const { getMonthTransactions, removeTransaction } = useApp();
  const [expanded, setExpanded] = useState<string | null>(null);

  const txs = getMonthTransactions(year, month);

  const allCategories = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

  const rows = allCategories
    .map(cat => {
      const catTxs = txs.filter(t => t.category === cat.id);
      const total = catTxs.reduce((s, t) => s + t.amount, 0);
      return { ...cat, txs: catTxs, total };
    })
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total);

  if (rows.length === 0) {
    return (
      <div className="mx-4 py-8 text-center text-gray-400 dark:text-gray-600 text-sm">
        No transactions this month
      </div>
    );
  }

  return (
    <div className="mx-4 space-y-2 pb-2">
      {rows.map(row => {
        const isOpen = expanded === row.id;
        const isIncome = INCOME_CATEGORIES.some(c => c.id === row.id);
        return (
          <div key={row.id} className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-50 dark:border-gray-800">
            <button
              onClick={() => setExpanded(isOpen ? null : row.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5"
            >
              <CategoryIcon icon={row.icon} color={row.color} />
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold dark:text-white">{row.label}</p>
                <p className="text-[11px] text-gray-400">{row.txs.length} transaction{row.txs.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-bold text-sm ${isIncome ? 'text-green-600' : 'text-gray-800 dark:text-gray-200'}`}>
                  {isIncome ? '+' : '-'}${row.total.toLocaleString()}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-gray-300 dark:text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-50 dark:border-gray-800">
                {row.txs.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0 ml-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium dark:text-gray-200 truncate">
                        {tx.description || row.label}
                      </p>
                      <p className="text-[10px] text-gray-400">{formatDate(tx.date)}</p>
                    </div>
                    <span className={`text-xs font-semibold flex-shrink-0 ${isIncome ? 'text-green-600' : 'text-gray-700 dark:text-gray-300'}`}>
                      {isIncome ? '+' : '-'}${tx.amount.toLocaleString()}
                    </span>
                    <button
                      onClick={() => removeTransaction(tx.id)}
                      className="ml-1 w-6 h-6 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={11} className="text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
