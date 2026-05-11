import { useState, useRef } from 'react';
import {
  Moon, Sun, ChevronRight, Camera, Bell, Lock, HelpCircle,
  FileText, LogOut, Star, Trash2, Edit3, TrendingUp, TrendingDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const dashoffset = circumference * (1 - score / 100);
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg width={144} height={144} viewBox="0 0 144 144" className="-rotate-90">
        <circle cx={72} cy={72} r={r} fill="none" stroke="currentColor" strokeWidth={10} className="text-gray-100 dark:text-gray-800" />
        <circle
          cx={72} cy={72} r={r}
          fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-black" style={{ color }}>{score}</span>
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Score</span>
      </div>
    </div>
  );
}

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
}

function SettingsRow({ icon, label, value, onClick, danger }: SettingsRowProps) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${danger ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
        <span className={danger ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}>{icon}</span>
      </div>
      <span className={`flex-1 text-sm font-medium text-left ${danger ? 'text-red-500' : 'dark:text-white'}`}>{label}</span>
      {value && <span className="text-xs text-gray-400">{value}</span>}
      {!danger && <ChevronRight size={14} className="text-gray-300 dark:text-gray-600" />}
    </button>
  );
}

export default function Profile() {
  const { transactions, userProfile, darkMode, toggleDarkMode, updateUserProfile } = useApp();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userProfile.name);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(userProfile.email);
  const [showTerms, setShowTerms] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate yearly / all-time stats
  const currentYear = new Date().getFullYear();
  const yearTxs = transactions.filter(t => new Date(t.date).getFullYear() === currentYear);
  const yearIncome = yearTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const yearExpenses = yearTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Monthly averages
  const monthsWithData = new Set(transactions.map(t => {
    const d = new Date(t.date);
    return `${d.getFullYear()}-${d.getMonth()}`;
  })).size || 1;
  const avgIncome = yearIncome / Math.max(monthsWithData, 1);
  const avgExpenses = yearExpenses / Math.max(monthsWithData, 1);

  // Score: 100 - (expenses/income * 100), capped 0-100
  const score = yearIncome > 0
    ? Math.min(100, Math.max(0, Math.round(100 - (yearExpenses / yearIncome) * 100)))
    : 50;

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => updateUserProfile({ avatar: ev.target?.result as string });
    reader.readAsDataURL(file);
  }

  return (
    <div className="pb-28 overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold dark:text-white">Profile</h1>
        <button
          onClick={toggleDarkMode}
          className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
        >
          {darkMode ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-gray-500" />}
        </button>
      </div>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center gap-3 pb-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-700 flex items-center justify-center overflow-hidden">
            {userProfile.avatar
              ? <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
              : <span className="text-white font-black text-3xl">{userProfile.name.charAt(0).toUpperCase()}</span>
            }
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center shadow-lg"
          >
            <Camera size={14} className="text-white" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              className="border-b-2 border-green-600 bg-transparent text-center font-bold text-lg dark:text-white outline-none w-40"
              autoFocus
              onBlur={() => { updateUserProfile({ name: nameInput }); setEditingName(false); }}
              onKeyDown={e => e.key === 'Enter' && (updateUserProfile({ name: nameInput }), setEditingName(false))}
            />
          </div>
        ) : (
          <button onClick={() => setEditingName(true)} className="flex items-center gap-1.5">
            <span className="text-lg font-bold dark:text-white">{userProfile.name}</span>
            <Edit3 size={14} className="text-gray-400" />
          </button>
        )}

        <span className="text-xs px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold capitalize">
          {userProfile.plan} plan
        </span>
      </div>

      {/* Financial Assessment */}
      <div className="mx-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">Financial Assessment</h2>

        {/* Income / Expense boxes */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 border border-green-100 dark:border-green-900/30">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={14} className="text-green-600" />
              <span className="text-[11px] text-green-600 font-semibold uppercase tracking-wide">Income</span>
            </div>
            <p className="text-xl font-black text-green-700 dark:text-green-400">${yearIncome.toLocaleString()}</p>
            <p className="text-[11px] text-green-600/70 mt-0.5">This year</p>
            <p className="text-[11px] text-green-600 mt-1 font-medium">~${Math.round(avgIncome).toLocaleString()}/mo avg</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-100 dark:border-red-900/30">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown size={14} className="text-red-500" />
              <span className="text-[11px] text-red-500 font-semibold uppercase tracking-wide">Expenses</span>
            </div>
            <p className="text-xl font-black text-red-600 dark:text-red-400">${yearExpenses.toLocaleString()}</p>
            <p className="text-[11px] text-red-500/70 mt-0.5">This year</p>
            <p className="text-[11px] text-red-500 mt-1 font-medium">~${Math.round(avgExpenses).toLocaleString()}/mo avg</p>
          </div>
        </div>

        {/* Score ring */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 flex flex-col items-center gap-3 shadow-sm border border-gray-50 dark:border-gray-800">
          <ScoreRing score={score} />
          <div className="text-center">
            <p className="font-bold text-base dark:text-white">
              {score >= 80 ? 'Excellent Financial Health' : score >= 60 ? 'Fair Financial Health' : 'Needs Improvement'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {score >= 80
                ? 'You\'re saving a healthy portion of your income.'
                : score >= 60
                ? 'You\'re managing well but there\'s room to improve.'
                : 'Your expenses are high relative to income.'}
            </p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-1" />
              <p className="text-[10px] text-gray-400">80–100</p>
              <p className="text-[10px] font-medium text-green-600">Excellent</p>
            </div>
            <div>
              <div className="w-3 h-3 rounded-full bg-yellow-400 mx-auto mb-1" />
              <p className="text-[10px] text-gray-400">60–79</p>
              <p className="text-[10px] font-medium text-yellow-600">Fair</p>
            </div>
            <div>
              <div className="w-3 h-3 rounded-full bg-red-500 mx-auto mb-1" />
              <p className="text-[10px] text-gray-400">0–59</p>
              <p className="text-[10px] font-medium text-red-500">Critical</p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings sections */}
      <div className="mx-4 space-y-3 mb-4">
        {/* Account */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-50 dark:border-gray-800">
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wider px-4 pt-3 pb-1">Account</p>
          <div>
            {editingEmail ? (
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Edit3 size={16} className="text-gray-500" />
                </div>
                <input
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="flex-1 text-sm bg-transparent border-b border-green-600 dark:text-white outline-none"
                  autoFocus
                  onBlur={() => { updateUserProfile({ email: emailInput }); setEditingEmail(false); }}
                  onKeyDown={e => e.key === 'Enter' && (updateUserProfile({ email: emailInput }), setEditingEmail(false))}
                />
              </div>
            ) : (
              <SettingsRow icon={<Edit3 size={16} />} label="Email" value={userProfile.email} onClick={() => setEditingEmail(true)} />
            )}
            <SettingsRow icon={<Star size={16} />} label="Subscription Plan" value={userProfile.plan === 'free' ? 'Free' : 'Premium'} onClick={() => updateUserProfile({ plan: userProfile.plan === 'free' ? 'premium' : 'free' })} />
            <SettingsRow icon={<Lock size={16} />} label="Change Password" />
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-50 dark:border-gray-800">
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wider px-4 pt-3 pb-1">Preferences</p>
          <SettingsRow icon={<Bell size={16} />} label="Notifications" />
          <div className="w-full flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              {darkMode ? <Moon size={16} className="text-gray-500 dark:text-gray-400" /> : <Sun size={16} className="text-gray-500" />}
            </div>
            <span className="flex-1 text-sm font-medium dark:text-white">Dark Mode</span>
            <button
              onClick={toggleDarkMode}
              className={`w-12 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Legal */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-50 dark:border-gray-800">
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wider px-4 pt-3 pb-1">Legal & Support</p>
          <SettingsRow icon={<FileText size={16} />} label="Terms & Conditions" onClick={() => setShowTerms(true)} />
          <SettingsRow icon={<HelpCircle size={16} />} label="Help & FAQ" />
        </div>

        {/* Danger zone */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-50 dark:border-gray-800">
          <SettingsRow icon={<Trash2 size={16} />} label="Clear All Data" danger onClick={() => {
            if (window.confirm('Clear all transaction data? This cannot be undone.')) {
              localStorage.clear();
              window.location.reload();
            }
          }} />
          <SettingsRow icon={<LogOut size={16} />} label="Sign Out" danger />
        </div>
      </div>

      {/* App version */}
      <p className="text-center text-[11px] text-gray-300 dark:text-gray-700 pb-4">ExpenseWise v1.0.0</p>

      {/* Terms modal */}
      {showTerms && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setShowTerms(false)}>
          <div className="w-full max-w-[430px] bg-white dark:bg-gray-900 rounded-t-3xl p-6 max-h-[70dvh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 dark:text-white">Terms & Conditions</h2>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-3 leading-relaxed">
              <p><strong>1. Acceptance of Terms</strong><br />By using ExpenseWise, you agree to these terms and conditions.</p>
              <p><strong>2. Data Storage</strong><br />All financial data is stored locally on your device. We do not transmit your personal financial information to our servers.</p>
              <p><strong>3. Privacy</strong><br />Your privacy is important to us. We collect minimal data necessary for app functionality.</p>
              <p><strong>4. AI Receipt Capture</strong><br />The AI receipt scanning feature is provided as-is. Always verify captured data before confirming.</p>
              <p><strong>5. Financial Advice Disclaimer</strong><br />ExpenseWise is a tracking tool only. It does not provide financial advice. Consult a qualified financial advisor for personal finance decisions.</p>
              <p><strong>6. Limitation of Liability</strong><br />We are not liable for any financial decisions made based on information displayed in the app.</p>
              <p><strong>7. Updates</strong><br />We reserve the right to update these terms at any time.</p>
            </div>
            <button onClick={() => setShowTerms(false)} className="mt-5 w-full py-3 rounded-2xl bg-green-600 text-white font-bold">
              I Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
