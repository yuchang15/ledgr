import type { Transaction, BudgetSettings } from '../types';

// ── Streaks ───────────────────────────────────────────────────────────────────

export function computeStreaks(transactions: Transaction[]): { current: number; best: number } {
  const now = new Date();
  const results: boolean[] = [];

  // Start from i=1 — current month is ongoing and never counts until it ends
  for (let i = 1; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const txs = transactions.filter(t => {
      const td = new Date(t.date);
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
    });
    if (!txs.length) { results.push(false); continue; }
    const income   = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    results.push(income > 0 && expenses < income);
  }

  let current = 0;
  for (const ok of results) { if (ok) current++; else break; }

  let best = 0, run = 0;
  for (const ok of results) { run = ok ? run + 1 : 0; best = Math.max(best, run); }

  return { current, best };
}

// ── Badges ────────────────────────────────────────────────────────────────────

export interface BadgeParams {
  transactions: Transaction[];
  budget: BudgetSettings;
  score: number;
  bestStreak: number;
}

export interface BadgeDef {
  id: string;
  icon: string;
  label: string;
  description: string;
  check: (p: BadgeParams) => boolean;
}

function peakSavingRate(transactions: Transaction[]): number {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
  const map = new Map<string, { inc: number; exp: number }>();
  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key === currentKey) return; // current month not yet complete
    const m = map.get(key) ?? { inc: 0, exp: 0 };
    t.type === 'income' ? (m.inc += t.amount) : (m.exp += t.amount);
    map.set(key, m);
  });
  let best = 0;
  map.forEach(m => { if (m.inc > 0) best = Math.max(best, (m.inc - m.exp) / m.inc); });
  return best;
}

function manualCount(transactions: Transaction[]) {
  return transactions.filter(t => !t.id.includes('_auto_')).length;
}

function savingsGoalPct(budget: BudgetSettings): number {
  if (!budget.savingsGoal?.enabled || !budget.expectedIncome || budget.expectedIncome <= 0) return 0;
  return budget.savingsGoal.amount / budget.expectedIncome;
}

function goalFulfilledForAnyMonth(transactions: Transaction[], goalAmount: number): boolean {
  if (goalAmount <= 0) return false;
  const monthlySavings = new Map<string, number>();
  transactions.forEach(t => {
    if (t.type !== 'expense' || t.category !== 'savings') return;
    if (t.linkedGoalId && t.linkedGoalId !== '__monthly__') return;
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthlySavings.set(key, (monthlySavings.get(key) ?? 0) + t.amount);
  });
  for (const total of monthlySavings.values()) {
    if (total >= goalAmount) return true;
  }
  return false;
}

export const BADGES: BadgeDef[] = [
  {
    id: 'first_transaction', icon: '🌱', label: 'First Steps',
    description: 'Logged your first transaction',
    check: ({ transactions }) => manualCount(transactions) >= 1,
  },
  {
    id: 'txn_10', icon: '📝', label: 'Record Keeper',
    description: 'Logged 10+ transactions',
    check: ({ transactions }) => manualCount(transactions) >= 10,
  },
  {
    id: 'txn_50', icon: '📊', label: 'Data Guru',
    description: 'Logged 50+ transactions',
    check: ({ transactions }) => manualCount(transactions) >= 50,
  },
  {
    id: 'budget_set', icon: '🎯', label: 'Budget Planner',
    description: 'Set up a monthly budget',
    check: ({ budget }) => budget.expectedIncome > 0,
  },
  {
    id: 'categories_5', icon: '🗂️', label: 'Diversified',
    description: 'Tracked expenses across 5+ categories',
    check: ({ transactions }) =>
      new Set(transactions.filter(t => t.type === 'expense').map(t => t.category)).size >= 5,
  },
  {
    id: 'saver_10', icon: '💰', label: 'Smart Saver',
    description: 'Saved a set goal of 10%+ of income',
    check: ({ transactions, budget }) => {
      const pct = savingsGoalPct(budget);
      return pct >= 0.10 && goalFulfilledForAnyMonth(transactions, budget.savingsGoal?.amount ?? 0);
    },
  },
  {
    id: 'saver_20', icon: '🏦', label: 'Super Saver',
    description: 'Saved a set goal of 15%+ of income',
    check: ({ transactions, budget }) => {
      const pct = savingsGoalPct(budget);
      return pct >= 0.15 && goalFulfilledForAnyMonth(transactions, budget.savingsGoal?.amount ?? 0);
    },
  },
  {
    id: 'streak_3', icon: '🔥', label: 'On a Roll',
    description: '3 consecutive months under budget',
    check: ({ bestStreak }) => bestStreak >= 3,
  },
  {
    id: 'streak_6', icon: '⚡', label: 'On Fire',
    description: '6 consecutive months under budget',
    check: ({ bestStreak }) => bestStreak >= 6,
  },
  {
    id: 'streak_12', icon: '💎', label: 'Unstoppable',
    description: '12 consecutive months under budget',
    check: ({ bestStreak }) => bestStreak >= 12,
  },
  {
    id: 'score_60', icon: '⭐', label: 'Getting There',
    description: 'Reached Fair financial health (60+)',
    check: ({ score }) => score >= 60,
  },
  {
    id: 'score_80', icon: '🌟', label: 'Star Performer',
    description: 'Reached Excellent health (80+)',
    check: ({ score }) => score >= 80,
  },
  {
    id: 'goal_created', icon: '🎯', label: 'Goal Setter',
    description: 'Created your first custom saving goal',
    check: ({ budget }) => (budget.customGoals?.length ?? 0) >= 1,
  },
  {
    id: 'goal_3', icon: '💫', label: 'Dream Big',
    description: 'Running 3 or more saving goals at once',
    check: ({ budget }) => (budget.customGoals?.length ?? 0) >= 3,
  },
  {
    id: 'goal_completed', icon: '🏆', label: 'Goal Crusher',
    description: 'Fully completed a custom saving goal',
    check: ({ budget }) =>
      (budget.customGoals ?? []).some(g => g.savedAmount >= g.targetAmount && g.targetAmount > 0),
  },
  {
    id: 'savings_depositor', icon: '🐖', label: 'Dedicated Saver',
    description: 'Made 5+ savings deposits via Add Transaction',
    check: ({ transactions }) =>
      transactions.filter(t => t.type === 'expense' && t.category === 'savings').length >= 5,
  },
  {
    id: 'savings_50pct', icon: '🚀', label: 'Halfway There',
    description: 'Reached 50% progress on any custom goal',
    check: ({ budget }) =>
      (budget.customGoals ?? []).some(
        g => g.targetAmount > 0 && g.savedAmount / g.targetAmount >= 0.5
      ),
  },
];

// ── Knowledge Base ────────────────────────────────────────────────────────────

export interface Tip {
  id: string;
  tag: 'critical' | 'fair' | 'excellent';
}

export const TIPS: Tip[] = [
  // Critical (0–59)
  { id: 'c0', tag: 'critical' },
  { id: 'c1', tag: 'critical' },
  { id: 'c2', tag: 'critical' },
  { id: 'c3', tag: 'critical' },
  { id: 'c4', tag: 'critical' },
  // Fair (60–79)
  { id: 'f0', tag: 'fair' },
  { id: 'f1', tag: 'fair' },
  { id: 'f2', tag: 'fair' },
  { id: 'f3', tag: 'fair' },
  { id: 'f4', tag: 'fair' },
  // Excellent (80–100)
  { id: 'e0', tag: 'excellent' },
  { id: 'e1', tag: 'excellent' },
  { id: 'e2', tag: 'excellent' },
  { id: 'e3', tag: 'excellent' },
  { id: 'e4', tag: 'excellent' },
];

export function computeBadges(transactions: Transaction[], budget: BudgetSettings): BadgeDef[] {
  const { best: bestStreak } = computeStreaks(transactions);
  const currentYear = new Date().getFullYear();
  const yearTxs = transactions.filter(t => new Date(t.date).getFullYear() === currentYear);
  const yearIncome = yearTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const yearExpenses = yearTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const score = yearIncome > 0
    ? Math.min(100, Math.max(0, Math.round(100 - (yearExpenses / yearIncome) * 100)))
    : 50;
  const params: BadgeParams = { transactions, budget, score, bestStreak };
  return BADGES.filter(b => b.check(params));
}

export function tipsForScore(score: number): Tip[] {
  if (score < 60) return TIPS.filter(t => t.tag === 'critical');
  if (score < 80) return TIPS.filter(t => t.tag === 'fair');
  return TIPS.filter(t => t.tag === 'excellent');
}
