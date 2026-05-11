export type TransactionType = 'expense' | 'income';

export type AutoDebitPeriod = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export type FinancialStatus = 'excellent' | 'sustained' | 'critical';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  isAutoDebit: boolean;
  autoDebitPeriod?: AutoDebitPeriod;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string | null;
  plan: 'free' | 'premium';
}

export const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Food & Dining', icon: 'UtensilsCrossed', color: '#f97316' },
  { id: 'transport', label: 'Transportation', icon: 'Car', color: '#3b82f6' },
  { id: 'shopping', label: 'Shopping', icon: 'ShoppingBag', color: '#ec4899' },
  { id: 'entertainment', label: 'Entertainment', icon: 'Tv', color: '#8b5cf6' },
  { id: 'health', label: 'Health & Medical', icon: 'Heart', color: '#ef4444' },
  { id: 'housing', label: 'Housing & Rent', icon: 'Home', color: '#14b8a6' },
  { id: 'utilities', label: 'Utilities', icon: 'Zap', color: '#eab308' },
  { id: 'education', label: 'Education', icon: 'GraduationCap', color: '#06b6d4' },
  { id: 'travel', label: 'Travel', icon: 'Plane', color: '#f43f5e' },
  { id: 'personal', label: 'Personal Care', icon: 'Sparkles', color: '#a855f7' },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'RefreshCw', color: '#64748b' },
  { id: 'insurance', label: 'Insurance', icon: 'Shield', color: '#0ea5e9' },
  { id: 'savings', label: 'Savings', icon: 'PiggyBank', color: '#22c55e' },
  { id: 'others', label: 'Others', icon: 'MoreHorizontal', color: '#94a3b8' },
];

export const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Salary', icon: 'Briefcase', color: '#22c55e' },
  { id: 'freelance', label: 'Freelance', icon: 'Laptop', color: '#16a34a' },
  { id: 'investment', label: 'Investment', icon: 'TrendingUp', color: '#15803d' },
  { id: 'business', label: 'Business', icon: 'Building2', color: '#166534' },
  { id: 'gift', label: 'Gift', icon: 'Gift', color: '#4ade80' },
  { id: 'other_income', label: 'Other Income', icon: 'Plus', color: '#86efac' },
];
