import { useState } from 'react';
import { X, ChevronDown, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TransactionType, AutoDebitPeriod } from '../../types';

interface Props {
  onClose: () => void;
  prefill?: {
    type?: TransactionType;
    amount?: number;
    category?: string;
    description?: string;
  };
}

const PERIODS: { value: AutoDebitPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function ManualEntryModal({ onClose, prefill }: Props) {
  const { addTransaction } = useApp();

  const [type, setType] = useState<TransactionType>(prefill?.type || 'expense');
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : '');
  const [category, setCategory] = useState(prefill?.category || '');
  const [description, setDescription] = useState(prefill?.description || '');
  const [isAutoDebit, setIsAutoDebit] = useState(false);
  const [period, setPeriod] = useState<AutoDebitPeriod>('monthly');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const selectedCategory = categories.find(c => c.id === category);

  function handleSubmit() {
    if (!amount || !category) return;
    addTransaction({
      type,
      amount: parseFloat(amount),
      category,
      description,
      date: new Date().toISOString(),
      isAutoDebit,
      autoDebitPeriod: isAutoDebit ? period : undefined,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[430px] bg-white dark:bg-gray-900 rounded-t-3xl animate-slide-up max-h-[90dvh] overflow-y-auto scrollbar-hide">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-lg font-bold dark:text-white">New Record</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="px-5 pb-8 space-y-4">
          {/* Type selector */}
          <div className="flex rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 p-1 bg-gray-50 dark:bg-gray-800">
            <button
              onClick={() => { setType('expense'); setCategory(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                type === 'expense'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Expense
            </button>
            <button
              onClick={() => { setType('income'); setCategory(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                type === 'income'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Income
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1.5 block">Amount</label>
            <div className="flex items-center border-2 border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 focus-within:border-green-500 transition-colors bg-gray-50 dark:bg-gray-800">
              <span className="text-gray-400 font-semibold mr-2">$</span>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 bg-transparent text-xl font-bold outline-none dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                inputMode="decimal"
              />
            </div>
          </div>

          {/* Category */}
          <div className="relative">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1.5 block">Category</label>
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="w-full flex items-center justify-between border-2 border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 bg-gray-50 dark:bg-gray-800 transition-colors focus:border-green-500"
            >
              {selectedCategory ? (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: selectedCategory.color }} />
                  <span className="text-sm font-medium dark:text-white">{selectedCategory.label}</span>
                </div>
              ) : (
                <span className="text-sm text-gray-400">Select category</span>
              )}
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showCategoryDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-10 max-h-52 overflow-y-auto scrollbar-hide">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setCategory(cat.id); setShowCategoryDropdown(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                    <span className="text-sm dark:text-white">{cat.label}</span>
                    {category === cat.id && <span className="ml-auto text-green-600">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1.5 block">Description <span className="text-gray-300">(optional)</span></label>
            <textarea
              placeholder="Add a note..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full border-2 border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm bg-gray-50 dark:bg-gray-800 dark:text-white outline-none focus:border-green-500 transition-colors resize-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
          </div>

          {/* Auto debit toggle */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw size={16} className="text-green-600" />
                <div>
                  <p className="text-sm font-medium dark:text-white">Auto Debit</p>
                  <p className="text-[11px] text-gray-400">Repeat this transaction</p>
                </div>
              </div>
              <button
                onClick={() => setIsAutoDebit(!isAutoDebit)}
                className={`w-12 h-6 rounded-full transition-colors relative ${isAutoDebit ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isAutoDebit ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {isAutoDebit && (
              <div className="mt-3 relative">
                <button
                  onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                  className="w-full flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-900"
                >
                  <span className="text-sm dark:text-white">{PERIODS.find(p => p.value === period)?.label}</span>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>
                {showPeriodDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-10">
                    {PERIODS.map(p => (
                      <button
                        key={p.value}
                        onClick={() => { setPeriod(p.value); setShowPeriodDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors"
                      >
                        {p.label}
                        {period === p.value && <span className="float-right text-green-600">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Confirm button */}
          <button
            onClick={handleSubmit}
            disabled={!amount || !category}
            className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-base disabled:opacity-40 active:scale-[0.98] transition-transform shadow-lg shadow-green-600/30"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
