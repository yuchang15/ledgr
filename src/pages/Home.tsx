import { useState } from 'react';
import { Plus } from 'lucide-react';
import GreenCard from '../components/home/GreenCard';
import Categories from '../components/home/Categories';
import ManualEntryModal from '../components/home/ManualEntryModal';

export default function Home() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [showEntry, setShowEntry] = useState(false);

  function handlePrev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function handleNext() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-2">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Good {getGreeting()}</p>
          <h1 className="text-xl font-bold dark:text-white">My Finances</h1>
        </div>
        <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <span className="text-green-700 dark:text-green-400 font-bold text-sm">U</span>
        </div>
      </div>

      {/* Green summary card */}
      <GreenCard year={year} month={month} onPrev={handlePrev} onNext={handleNext} />

      {/* Manual entry button */}
      <div className="mx-4 mt-4">
        <button
          onClick={() => setShowEntry(true)}
          className="w-full flex items-center gap-3 bg-white dark:bg-gray-900 rounded-2xl px-4 py-3.5 shadow-sm border border-gray-50 dark:border-gray-800 active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
            <Plus size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Add Transaction</span>
          <span className="ml-auto text-xs text-gray-300 dark:text-gray-600">Tap to record</span>
        </button>
      </div>

      {/* Section header */}
      <div className="mx-4 mt-5 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Categories</h2>
      </div>

      {/* Categories */}
      <Categories year={year} month={month} />

      {/* Manual entry modal */}
      {showEntry && <ManualEntryModal onClose={() => setShowEntry(false)} />}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
