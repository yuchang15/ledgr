import { useState, useCallback, useEffect, useRef } from 'react';
import { useTour, useTourTarget } from '../../context/TourContext';
import { useRouter, useFocusEffect } from 'expo-router';
import TourHighlight from '../../components/TourHighlight';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  InteractionManager,
  Platform,
} from 'react-native';

const savingsJarImg = require('../../assets/m_savingsjar.png');
const budgetImg = require('../../assets/m_budget.png');
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PiggyBank,
  ToggleLeft,
  ToggleRight,
  Plus,
  X,
  Home,
  UtensilsCrossed,
  Car,
  Heart,
  Zap,
  Tv,
  ShoppingBag,
  RefreshCw,
  Sparkles,
  MoreHorizontal,
  Minus,
  ChevronDown,
  ChevronUp,
  BarChart2,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../context/LanguageContext';
import { usePurchases } from '../../context/PurchasesContext';
import { usePaywall } from '../../context/PaywallContext';
import { trackEvent } from '../../utils/analytics';
import { BudgetAllocation } from '../../types';
import { CategoryIconRaw } from '../../components/home/CategoryIcon';
import { durationMonthsFromDays, goalMonthIndex } from '../../utils/goals';

// ─── Budget Groups ────────────────────────────────────────────────────────────

interface BudgetGroup {
  label: string;
  color: string;
  categoryId: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}

const BUDGET_GROUPS: BudgetGroup[] = [
  { label: 'Housing & Rent',  color: '#14b8a6', categoryId: 'housing',       Icon: Home },
  { label: 'Food & Dining',   color: '#f97316', categoryId: 'food',          Icon: UtensilsCrossed },
  { label: 'Transportation',  color: '#3b82f6', categoryId: 'transport',     Icon: Car },
  { label: 'Health & Medical',color: '#ef4444', categoryId: 'health',        Icon: Heart },
  { label: 'Utilities',       color: '#eab308', categoryId: 'utilities',     Icon: Zap },
  { label: 'Entertainment',   color: '#8b5cf6', categoryId: 'entertainment', Icon: Tv },
  { label: 'Shopping',        color: '#ec4899', categoryId: 'shopping',      Icon: ShoppingBag },
  { label: 'Subscriptions',   color: '#64748b', categoryId: 'subscriptions', Icon: RefreshCw },
  { label: 'Personal Care',   color: '#a855f7', categoryId: 'personal',      Icon: Sparkles },
  { label: 'Others',          color: '#94a3b8', categoryId: 'others',        Icon: MoreHorizontal },
];

const INITIAL_VISIBLE = 5;
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function categoryLabel(t: (key: any, params?: Record<string, string | number>) => string, categoryId: string, fallback = '') {
  const key = `cat.${categoryId}` as any;
  const translation = t(key);
  return translation !== key ? translation : fallback;
}

function analyzeAllocations(income: number): BudgetAllocation[] {
  let plan: { id: string; pct: number }[];
  if (income >= 8000) {
    plan = [
      { id: 'housing', pct: 20 }, { id: 'food', pct: 10 }, { id: 'transport', pct: 5 },
      { id: 'health', pct: 5 },   { id: 'utilities', pct: 4 }, { id: 'entertainment', pct: 8 },
      { id: 'shopping', pct: 8 }, { id: 'subscriptions', pct: 3 }, { id: 'personal', pct: 5 },
      { id: 'others', pct: 7 },
    ];
  } else if (income >= 4000) {
    plan = [
      { id: 'housing', pct: 33 }, { id: 'food', pct: 22 }, { id: 'transport', pct: 9 },
      { id: 'health', pct: 6 },   { id: 'utilities', pct: 9 }, { id: 'entertainment', pct: 5 },
      { id: 'shopping', pct: 5 }, { id: 'subscriptions', pct: 3 }, { id: 'personal', pct: 4 },
      { id: 'others', pct: 4 },
    ];
  } else {
    plan = [
      { id: 'housing', pct: 30 }, { id: 'food', pct: 20 }, { id: 'transport', pct: 8 },
      { id: 'health', pct: 5 },   { id: 'utilities', pct: 8 }, { id: 'entertainment', pct: 5 },
      { id: 'shopping', pct: 5 }, { id: 'subscriptions', pct: 2 }, { id: 'personal', pct: 4 },
      { id: 'others', pct: 3 },
    ];
  }
  const total = plan.reduce((s, x) => s + x.pct, 0) || 1;
  return BUDGET_GROUPS.map((g) => {
    const item = plan.find((p) => p.id === g.categoryId);
    return {
      categoryId: g.categoryId,
      label: g.label,
      color: g.color,
      percentage: item ? Math.round((item.pct / total) * 100) : 0,
    };
  });
}

// ─── Budget Donut Chart ───────────────────────────────────────────────────────

function BudgetDonut({ allocations, netIncome, totalPct, formatCurrency, title }: {
  allocations: BudgetAllocation[];
  netIncome: number;
  totalPct: number;
  formatCurrency: (n: number) => string;
  title: string;
}) {
  const size = 180;
  const radius = size * 0.36;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = size * 0.15;

  const slices = allocations.filter(a => a.percentage > 0).map(a => ({
    color: a.color,
    pct: totalPct > 0 ? (a.percentage / totalPct) * 100 : 0,
  }));

  let offset = 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} />
      {slices.map((s, i) => {
        const dash = (s.pct / 100) * circumference;
        const gap = circumference - dash;
        const rotation = (offset / 100) * 360 - 90;
        offset += s.pct;
        return (
          <Circle
            key={i}
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={0}
            transform={`rotate(${rotation}, ${cx}, ${cy})`}
          />
        );
      })}
      <SvgText x={cx} y={cy - 7} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.65)">
        {title}
      </SvgText>
      <SvgText x={cx} y={cy + 12} textAnchor="middle" fontSize={15} fontWeight="bold" fill="white">
        {formatCurrency(netIncome)}
      </SvgText>
    </Svg>
  );
}

// ─── Budget Screen ────────────────────────────────────────────────────────────

export default function BudgetScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [_layoutCycle, _bumpLayout] = useState(0);
  const { bottom: safeBottom } = useSafeAreaInsets();

  // After returning from the camera capture screen on Android the window-inset
  // state is disturbed: SafeAreaView may read a stale/large top inset, producing
  // a black gap above the header. Waiting for all interactions to complete (so
  // the navigation animation has fully settled) then bumping a counter forces
  // this component to re-render, causing SafeAreaView to re-read the now-correct
  // insets from the context. scrollTo(y:0) additionally ensures the header row
  // is not hidden behind a mis-positioned ScrollView.
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const task = InteractionManager.runAfterInteractions(() => {
      _bumpLayout(n => n + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    return () => task.cancel();
  }, []));
  const {
    budget, updateBudget, getMonthTransactions, getMonthIncome,
    formatCurrency, getCurrencySymbol, removeCustomGoal,
  } = useApp();
  const { isPro } = usePurchases();
  const { showPaywall } = usePaywall();

  const now = new Date();
  const autoFilledMonth = t(`month.${MONTH_KEYS[now.getMonth()]}` as any);
  const actualIncome = getMonthIncome(now.getFullYear(), now.getMonth());

  const [activeTab, setActiveTab] = useState<'goals' | 'budget'>('goals');
  const { currentStep } = useTour();

  useEffect(() => {
    if (currentStep?.id === 'budget-income')      setActiveTab('budget');
    if (currentStep?.id === 'budget-goals')       setActiveTab('goals');
    if (currentStep?.id === 'budget-custom-goal') setActiveTab('goals');
  }, [currentStep?.id]);

  const goalsActive      = useTourTarget('budget-goals',       { scrollRef, scrollY: 0 });
  const customGoalActive = useTourTarget('budget-custom-goal', { scrollRef, scrollY: 220 });
  const incomeActive     = useTourTarget('budget-income',      { scrollRef, scrollY: 260 });
  const [incomeInput, setIncomeInput] = useState(
    budget.expectedIncome > 0 ? String(budget.expectedIncome) : actualIncome > 0 ? String(Math.round(actualIncome)) : '',
  );
  const [savingsEnabled, setSavingsEnabled] = useState(budget.savingsGoal?.enabled ?? false);
  const [savingsMode, setSavingsMode] = useState<'pct' | 'fixed'>(budget.savingsGoal?.mode ?? 'pct');
  const [savingsValue, setSavingsValue] = useState(() => {
    if (!budget.savingsGoal) return '';
    const inc = budget.expectedIncome || 1;
    return budget.savingsGoal.mode === 'pct'
      ? String(Math.round((budget.savingsGoal.amount / inc) * 100))
      : String(Math.round(budget.savingsGoal.amount));
  });
  const [allocations, setAllocations] = useState<BudgetAllocation[]>(
    budget.allocations.length > 0
      ? budget.allocations
      : BUDGET_GROUPS.map((g) => ({ categoryId: g.categoryId, label: g.label, color: g.color, percentage: 0 })),
  );
  const [analyzed, setAnalyzed] = useState(budget.allocations.length > 0);
  const [saved, setSaved] = useState(false);
  const [showAllAllocations, setShowAllAllocations] = useState(false);
  const [expandedAlloc, setExpandedAlloc] = useState<string | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const activeCustomGoals = (budget.customGoals ?? []).filter(g => !g.completedAt);
  const completedGoals = (budget.customGoals ?? []).filter(g => !!g.completedAt);

  const income = parseFloat(incomeInput) || 0;
  const savingsAmt = income > 0 && savingsValue
    ? savingsMode === 'pct' ? income * (parseFloat(savingsValue) / 100) : parseFloat(savingsValue)
    : 0;
  const customGoalMonthly = activeCustomGoals.reduce((sum, g) => {
    const months = durationMonthsFromDays(g.durationDays);
    return sum + g.targetAmount / months;
  }, 0);
  const netIncome = Math.max(0, income - savingsAmt - customGoalMonthly);
  const totalPct = allocations.reduce((s, a) => s + a.percentage, 0);

  const txs = getMonthTransactions(now.getFullYear(), now.getMonth());
  const actualByCategory: Record<string, number> = {};
  txs.forEach((tx) => {
    if (tx.type === 'expense') {
      actualByCategory[tx.category] = (actualByCategory[tx.category] || 0) + tx.amount;
    }
  });

  function handleAnalyze() {
    if (income <= 0) return;
    const result = analyzeAllocations(netIncome > 0 ? netIncome : income);
    setAllocations(result);
    setAnalyzed(true);
  }

  function handleReset() {
    if (income <= 0) return;
    const result = analyzeAllocations(netIncome > 0 ? netIncome : income);
    setAllocations(result);
  }

  function adjustPct(idx: number, delta: number) {
    setAllocations((prev) => {
      const currentTotal = prev.reduce((s, a) => s + a.percentage, 0);
      if (delta > 0 && currentTotal >= 100) return prev;
      return prev.map((a, i) =>
        i === idx ? { ...a, percentage: Math.max(0, Math.min(100, a.percentage + delta)) } : a,
      );
    });
  }

  const handleSave = useCallback(() => {
    const savingsGoal = savingsEnabled && savingsValue ? {
      enabled: true,
      amount: savingsMode === 'pct' ? income * (parseFloat(savingsValue) / 100) : parseFloat(savingsValue),
      mode: savingsMode,
    } : undefined;
    updateBudget({ expectedIncome: income, allocations, savingsGoal, customGoals: budget.customGoals });
    trackEvent('budget_saved', { income, total_pct: totalPct });
    setSaved(true);
  }, [income, allocations, savingsEnabled, savingsValue, savingsMode, updateBudget, budget.customGoals, totalPct]);

  const activeGoalCount = (savingsEnabled ? 1 : 0) + activeCustomGoals.length;
  const visibleAllocations = showAllAllocations
    ? allocations
    : allocations.slice(0, INITIAL_VISIBLE);
  const hiddenCount = allocations.length - INITIAL_VISIBLE;

  return (
    <SafeAreaView key={_layoutCycle} className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      {/* Completed goals bottom sheet */}
      <Modal visible={showCompleted} animationType="slide" presentationStyle="pageSheet" transparent onRequestClose={() => setShowCompleted(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="bg-white dark:bg-gray-900 rounded-t-3xl overflow-hidden" style={{ maxHeight: '80%' }}>
            <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
              <View className="flex-row items-center gap-2">
                <CheckCircle2 size={18} color="#16a34a" />
                <Text className="text-base font-bold text-gray-900 dark:text-white">
                  {t('goal.completed_section')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowCompleted(false)} className="p-1">
                <X size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20, paddingBottom: Math.max(24, safeBottom + 16) }}
            >
              {completedGoals.map(goal => (
                <TouchableOpacity
                  key={goal.id}
                  onPress={() => { setShowCompleted(false); router.push(`/goal/${goal.id}` as any); }}
                  className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-3 flex-row items-center gap-3"
                  activeOpacity={0.7}
                >
                  <View
                    className="w-10 h-10 rounded-2xl items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: goal.color + '20' }}
                  >
                    <CategoryIconRaw icon={goal.icon} color={goal.color} size={20} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-white" numberOfLines={1}>{goal.name}</Text>
                    <Text className="text-xs text-gray-400">
                      {t('goal.completed_on', { date: goal.completedAt ? new Date(goal.completedAt).toLocaleDateString() : '' })}
                    </Text>
                    <Text className="text-xs font-semibold mt-0.5" style={{ color: goal.color }}>
                      {formatCurrency(goal.savedAmount)} / {formatCurrency(goal.targetAmount)}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete confirmation modal for custom goals */}
      {deletingGoalId && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setDeletingGoalId(null)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ width: '86%', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8 }}>{t('goal.delete_title')}</Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 14 }}>{t('goal.delete_confirm', { name: (budget.customGoals ?? []).find(g => g.id === deletingGoalId)?.name ?? '' })}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <TouchableOpacity onPress={() => setDeletingGoalId(null)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                  <Text style={{ color: '#6b7280' }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { removeCustomGoal(deletingGoalId); setDeletingGoalId(null); }} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                  <Text style={{ color: '#ef4444', fontWeight: '700' }}>{t('common.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {/* Header */}
      <View className="bg-white dark:bg-gray-900 px-5 pt-2 pb-4 border-b border-gray-100 dark:border-gray-800">
        <Text className="text-xl font-bold text-gray-900 dark:text-white">{t('budget.title')}</Text>
        <Text className="text-xs text-gray-400 mt-0.5">{t('budget.subtitle')}</Text>
      </View>

      {/* Tab bar */}
      <View className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-row px-5">
        {(['goals', 'budget'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className="flex-1 py-3.5 items-center relative"
          >
            <View className="flex-row items-center gap-1">
              <Text className={`text-sm font-bold ${activeTab === tab ? 'text-green-600' : 'text-gray-400'}`}>
                {tab === 'goals' ? t('budget.goals') : t('budget.budget')}
              </Text>
              {tab === 'goals' && activeGoalCount > 0 && (
                <View className="w-4 h-4 rounded-full bg-green-600 items-center justify-center">
                  <Text className="text-white text-[10px] font-black">{activeGoalCount}</Text>
                </View>
              )}
            </View>
            {activeTab === tab && (
              <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 rounded-t-full" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1 px-5 pt-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >

        {/* ── GOALS TAB ── */}
        {activeTab === 'goals' && (
          <>
            {/* Completed goals entry point — only shown when at least one goal is done */}
            {completedGoals.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowCompleted(true)}
                className="flex-row items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-2xl px-4 py-3 mb-4 border border-green-100 dark:border-green-800/30"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-2.5">
                  <CheckCircle2 size={18} color="#16a34a" />
                  <Text className="text-sm font-semibold text-green-700 dark:text-green-400">
                    {t('goal.completed_section')}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className="w-5 h-5 rounded-full bg-green-600 items-center justify-center">
                    <Text className="text-white text-[10px] font-black">{completedGoals.length}</Text>
                  </View>
                  <ChevronRight size={14} color="#16a34a" />
                </View>
              </TouchableOpacity>
            )}

            {/* Monthly Savings Goal toggle */}
            <TourHighlight active={goalsActive} borderRadius={24} style={{ marginBottom: 16 }}><View className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <View className="px-5 py-4">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <Text style={{ fontSize: 16 }}>🐷</Text>
                    <Text className="text-sm font-semibold text-gray-900 dark:text-white">{t('budget.monthly_savings')}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSavingsEnabled((v) => !v)}>
                    {savingsEnabled
                      ? <ToggleRight size={28} color="#22c55e" />
                      : <ToggleLeft size={28} color="#d1d5db" />}
                  </TouchableOpacity>
                </View>

                {savingsEnabled && (
                  <>
                    {/* Mode toggle */}
                    <View className="flex-row gap-2 mb-3 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                      {(['pct', 'fixed'] as const).map((m) => (
                        <TouchableOpacity
                          key={m}
                          onPress={() => setSavingsMode(m)}
                          className={`flex-1 py-2 rounded-lg items-center ${savingsMode === m ? 'bg-green-600' : ''}`}
                        >
                          <Text className={`text-xs font-bold ${savingsMode === m ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                            {m === 'pct' ? `% ${t('common.income')}` : `${t('budget.fixed')} ${getCurrencySymbol()}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Value input */}
                    <View className="flex-row items-center border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2.5 gap-2 bg-gray-50 dark:bg-gray-800">
                      <Text className="text-gray-400 text-sm font-bold">{savingsMode === 'pct' ? '%' : getCurrencySymbol()}</Text>
                      <TextInput
                        className="flex-1 text-lg font-bold text-gray-900 dark:text-white"
                        placeholder={savingsMode === 'pct' ? '20' : '1000'}
                        placeholderTextColor="#d1d5db"
                        keyboardType="decimal-pad"
                        value={savingsValue}
                        onChangeText={setSavingsValue}
                      />
                    </View>
                    {savingsAmt > 0 && (
                      <Text className="text-sm text-green-600 font-semibold mt-2 text-right">
                        = {formatCurrency(savingsAmt)}{t('common.per_month')}
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View></TourHighlight>

            {/* Active custom goals */}
            {activeCustomGoals.map((goal) => {
              const durationMonths = durationMonthsFromDays(goal.durationDays);
              const monthlyTarget = goal.targetAmount / durationMonths;
              const currentMonthIdx = goalMonthIndex(goal.startDate, durationMonths);
              const monthSaved = Math.max(0, Math.min(monthlyTarget, goal.savedAmount - currentMonthIdx * monthlyTarget));
              const totalPctGoal = goal.targetAmount > 0 ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0;
              const monthPct = monthlyTarget > 0 ? Math.min(100, (monthSaved / monthlyTarget) * 100) : 0;

              return (
                <View key={goal.id} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-5 mb-4">
                  <View className="flex-row items-center gap-3 mb-3">
                    <View
                      className="w-10 h-10 rounded-2xl items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: goal.color + '20' }}
                    >
                      <CategoryIconRaw icon={goal.icon} color={goal.color} size={20} />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-semibold text-gray-900 dark:text-white" numberOfLines={1}>{goal.name}</Text>
                      <Text className="text-xs text-gray-400">
                        {t('budget.month_of', { x: currentMonthIdx + 1, y: durationMonths })} · {formatCurrency(monthlyTarget)}{t('common.per_month')}
                      </Text>
                    </View>
                      <TouchableOpacity onPress={() => setDeletingGoalId(goal.id)} className="p-1">
                        <X size={14} color="#d1d5db" />
                      </TouchableOpacity>
                  </View>

                  <View className="flex-row justify-between mb-1.5">
                    <Text className="text-xs text-gray-400">{t('trends.this_month')}</Text>
                    <Text className="text-xs font-semibold" style={{ color: goal.color }}>
                      {formatCurrency(monthSaved)} / {formatCurrency(monthlyTarget)}
                    </Text>
                  </View>
                  <View className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <View className="h-full rounded-full" style={{ width: `${monthPct}%`, backgroundColor: goal.color }} />
                  </View>
                  <View className="flex-row justify-between mt-2 items-center">
                    <Text className="text-xs text-gray-400">Total: {formatCurrency(goal.savedAmount)} / {formatCurrency(goal.targetAmount)}</Text>
                    <Text className="text-xs font-medium text-gray-500">{Math.round(totalPctGoal)}%</Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => router.push(`/goal/${goal.id}` as any)}
                    className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-800 flex-row items-center justify-center"
                    activeOpacity={0.7}
                  >
                    <Text className="text-xs font-semibold" style={{ color: goal.color }}>{t('budget.see_progress')}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Savings jar illustration — always visible so the mascot is always present */}
            <View className="items-center py-6 mb-2">
              <Image source={savingsJarImg} style={{ width: 110, height: 110 }} resizeMode="contain" />
              {activeCustomGoals.length === 0 && (
                <>
                  <Text className="text-sm font-bold text-gray-700 dark:text-white mt-3 text-center">{t('budget.start_saving')}</Text>
                  <Text className="text-xs text-gray-400 mt-1 text-center leading-relaxed px-6">
                    {t('budget.empty_goals_desc')}
                  </Text>
                </>
              )}
            </View>

            {/* Add Goal */}
            <TourHighlight active={customGoalActive} borderRadius={16} style={{ marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => {
                  if (!isPro && (budget.customGoals?.length ?? 0) >= 1) { showPaywall(); return; }
                  router.push('/goal/new' as any);
                }}
                className="w-full flex-row items-center gap-3 px-1 py-3"
                activeOpacity={0.7}
              >
                <View className="w-11 h-11 rounded-2xl items-center justify-center flex-shrink-0" style={{ backgroundColor: '#22c55e25' }}>
                  <Plus size={20} color="#22c55e" strokeWidth={1.8} />
                </View>
                <Text className="text-sm font-semibold" style={{ color: '#22c55e' }}>{t('budget.add_goal')}</Text>
              </TouchableOpacity>
            </TourHighlight>
          </>
        )}

        {/* ── BUDGET TAB ── */}
        {activeTab === 'budget' && (
          <>
            {/* Income input */}
            <TourHighlight active={incomeActive} borderRadius={24} style={{ marginBottom: 16 }}><View className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {t('budget.expected_income')}
                </Text>
                <View className="bg-gray-100 dark:bg-gray-800 rounded-full px-2.5 py-0.5 flex-row items-center gap-1">
                  <Text className="text-[10px] text-gray-500 dark:text-gray-400">{t('budget.variable')}</Text>
                </View>
              </View>
                      {actualIncome > 0 && !budget.expectedIncome && (
                <Text className="text-xs text-green-600 mb-2 font-medium">
                  {t('budget.auto_filled', { month: autoFilledMonth })}
                </Text>
              )}
              {actualIncome > 0 && budget.expectedIncome > 0 && (
                <Text className="text-xs text-green-600 mb-2 font-medium">
                  {t('budget.auto_filled', { month: autoFilledMonth })}
                </Text>
              )}
              <View className="flex-row items-center border-2 border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 bg-gray-50 dark:bg-gray-800 gap-2 mb-4">
                <Text className="text-gray-400 font-semibold text-xl">{getCurrencySymbol()}</Text>
                <TextInput
                  className="flex-1 text-xl font-bold text-gray-900 dark:text-white"
                  placeholder={t('budget.income_placeholder')}
                  placeholderTextColor="#d1d5db"
                  keyboardType="decimal-pad"
                  value={incomeInput}
                  onChangeText={setIncomeInput}
                />
              </View>

              <TouchableOpacity
                onPress={handleAnalyze}
                disabled={income <= 0}
                className={`py-3.5 rounded-2xl items-center flex-row justify-center gap-2 ${income > 0 ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <BarChart2 size={16} color={income > 0 ? 'white' : '#9ca3af'} />
                <Text className={`font-bold ${income > 0 ? 'text-white' : 'text-gray-400'}`}>
                  {t('budget.analyze')}
                </Text>
              </TouchableOpacity>
              {income <= 0 && (
                <Text className="text-xs text-amber-500 font-medium mt-2">{t('budget.enter_income')}</Text>
              )}
              {analyzed && income > 0 && (
                <Text className="text-xs text-green-600 font-medium mt-2">
                  ✓ {t('budget.allocation_generated')} · {t('budget.savings_locked', { pct: savingsEnabled && savingsAmt > 0 ? Math.round((savingsAmt / income) * 100) : 0 })}
                </Text>
              )}
            </View></TourHighlight>

            {/* Budget mascot — shown before the user has analyzed their budget */}
            {!analyzed && (
              <View className="items-center py-8">
                <Image source={budgetImg} style={{ width: 120, height: 120 }} resizeMode="contain" />
                <Text className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center leading-relaxed px-6">
                  {t('budget.mascot_desc')}
                </Text>
              </View>
            )}

            {/* Active Goals summary */}
            {(savingsEnabled && savingsAmt > 0 || customGoalMonthly > 0) && income > 0 && (
              <View className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 mb-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('budget.active_goals')}</Text>
                  <View className="bg-green-100 dark:bg-green-900/30 rounded-full px-2.5 py-0.5">
                    <Text className="text-xs font-bold text-green-700 dark:text-green-400">
                      {t('budget.x_active', { n: activeGoalCount })}
                    </Text>
                  </View>
                </View>
                {savingsEnabled && savingsAmt > 0 && (
                  <View className="flex-row items-center justify-between py-2.5 border-b border-gray-50 dark:border-gray-800">
                    <View className="flex-row items-center gap-2.5">
                      <View className="w-7 h-7 rounded-xl items-center justify-center" style={{ backgroundColor: '#22c55e20' }}>
                        <Text style={{ fontSize: 13 }}>🐷</Text>
                      </View>
                      <Text className="text-sm text-gray-600 dark:text-gray-300">{t('budget.monthly_savings')}</Text>
                    </View>
                    <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">−{formatCurrency(savingsAmt)}{t('common.per_month')}</Text>
                  </View>
                )}
                {(budget.customGoals ?? []).map(goal => {
                  const months = durationMonthsFromDays(goal.durationDays);
                  const monthly = goal.targetAmount / months;
                  return (
                    <View key={goal.id} className="flex-row items-center justify-between py-2.5 border-b border-gray-50 dark:border-gray-800">
                      <View className="flex-row items-center gap-2.5">
                        <View className="w-7 h-7 rounded-xl items-center justify-center" style={{ backgroundColor: goal.color + '20' }}>
                          <CategoryIconRaw icon={goal.icon} color={goal.color} size={13} />
                        </View>
                        <Text className="text-sm text-gray-600 dark:text-gray-300" numberOfLines={1}>{goal.name}</Text>
                      </View>
                      <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">−{formatCurrency(monthly)}{t('common.per_month')}</Text>
                    </View>
                  );
                })}
                <View className="flex-row items-center justify-between pt-3 mt-1">
                  <Text className="text-sm font-bold text-gray-700 dark:text-white">{t('budget.spendable')}</Text>
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-base font-black text-green-600">{formatCurrency(netIncome)}</Text>
                    <Text className="text-xs text-gray-400">/ {formatCurrency(income)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Budget Allocation donut card */}
            {analyzed && income > 0 && (
              <View className="rounded-3xl overflow-hidden mb-4" style={{ backgroundColor: '#15803d' }}>
                <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
                  <Text style={{ fontSize: 11, fontWeight: '700', color: 'white', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {t('budget.allocation')}
                  </Text>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: 'white' }}>
                      {t('budget.pct_badge', { pct: totalPct.toFixed(0) })}
                    </Text>
                  </View>
                </View>
                <View className="items-center py-2">
                  <BudgetDonut
                    allocations={allocations}
                    netIncome={netIncome}
                    totalPct={totalPct}
                    formatCurrency={formatCurrency}
                    title={t('budget.spendable')}
                  />
                </View>
                <Text style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.5)', paddingBottom: 16 }}>
                  {t('budget.tap_adjust')}
                </Text>
              </View>
            )}

            {/* Adjust Manually section */}
            {analyzed && (
              <View className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden mb-4">
                <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50 dark:border-gray-800">
                  <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {t('budget.adjust_manual')}
                  </Text>
                  <TouchableOpacity onPress={handleReset} className="flex-row items-center gap-1">
                    <RefreshCw size={11} color="#9ca3af" />
                    <Text className="text-xs font-semibold text-gray-400">{t('budget.reset')}</Text>
                  </TouchableOpacity>
                </View>

                {visibleAllocations.map((alloc, idx) => {
                  const group = BUDGET_GROUPS.find(g => g.categoryId === alloc.categoryId);
                  if (!group) return null;
                  const { Icon } = group;
                  const budgetAmt = netIncome > 0 ? Math.round(netIncome * alloc.percentage / 100) : 0;
                  const actual = actualByCategory[alloc.categoryId] || 0;
                  const over = actual > budgetAmt && budgetAmt > 0;
                  const spentPct = budgetAmt > 0 ? Math.min(100, (actual / budgetAmt) * 100) : 0;
                  const isExpanded = expandedAlloc === alloc.categoryId;

                  return (
                    <View key={alloc.categoryId} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                      <TouchableOpacity
                        onPress={() => setExpandedAlloc(isExpanded ? null : alloc.categoryId)}
                        className="flex-row items-center gap-3 px-5 py-3.5"
                        activeOpacity={0.7}
                      >
                        <View
                          className="w-8 h-8 rounded-xl items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: alloc.color + '20' }}
                        >
                          <Icon size={15} color={alloc.color} />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text className="text-sm font-medium text-gray-800 dark:text-gray-200">{categoryLabel(t, alloc.categoryId, alloc.label)}</Text>
                          {actual > 0 && budgetAmt > 0 && (
                            <View className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-1.5">
                              <View
                                className="h-full rounded-full"
                                style={{ width: `${spentPct}%`, backgroundColor: over ? '#ef4444' : alloc.color }}
                              />
                            </View>
                          )}
                        </View>
                        <Text className="text-sm font-bold mr-1" style={{ color: alloc.color }}>{alloc.percentage}%</Text>
                        {budgetAmt > 0 && (
                          <Text className="text-xs text-gray-400 mr-1">{formatCurrency(budgetAmt)}</Text>
                        )}
                        {isExpanded
                          ? <ChevronUp size={14} color="#d1d5db" />
                          : <ChevronDown size={14} color="#d1d5db" />}
                      </TouchableOpacity>

                      {isExpanded && (
                        <View className="px-5 pb-3 flex-row items-center justify-end gap-3">
                          <TouchableOpacity
                            onPress={() => adjustPct(idx, -1)}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
                          >
                            <Minus size={12} color="#6b7280" />
                          </TouchableOpacity>
                          <Text className="text-base font-black text-gray-900 dark:text-white w-10 text-center">
                            {alloc.percentage}%
                          </Text>
                          <TouchableOpacity
                            onPress={() => adjustPct(idx, 1)}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
                          >
                            <Plus size={12} color="#6b7280" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}

                {hiddenCount > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowAllAllocations(v => !v)}
                    className="py-3.5 items-center border-t border-gray-50 dark:border-gray-800"
                  >
                    <Text className="text-sm font-semibold text-green-600">
                      {showAllAllocations ? t('budget.show_less') : t('budget.show_more_cats', { n: String(hiddenCount) })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Save button */}
            {analyzed && (
              <>
                {totalPct !== 100 && (
                  <Text className="text-xs text-red-500 dark:text-red-400 text-center mb-2">
                    {t('budget.pct_not_100', { pct: String(totalPct) })}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={totalPct !== 100}
                  className={`rounded-2xl py-4 items-center mb-6 ${totalPct === 100 ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <Text className={`font-bold text-base ${totalPct === 100 ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                    {saved ? '✓ ' : ''}{t('budget.save_plan')}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Budget mascot reminder — shown above "This Month" once budget is set */}
            {analyzed && income > 0 && (
              <View className="flex-row items-center gap-3 bg-green-50 dark:bg-green-900/20 rounded-2xl px-4 py-3 mb-4">
                <Image source={budgetImg} style={{ width: 52, height: 52 }} resizeMode="contain" />
                <Text className="text-sm font-semibold text-green-700 dark:text-green-400 flex-1">
                  {t('budget.stick_to_budget')}
                </Text>
              </View>
            )}

            {/* This month summary */}
            {analyzed && income > 0 && (
              <View className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 mb-4">
                <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  {t('budget.this_month')}
                </Text>
                {allocations.filter((a) => a.percentage > 0 && (actualByCategory[a.categoryId] ?? 0) > 0).length === 0 ? (
                  <Text className="text-xs text-gray-400 py-2">{t('budget.no_expense')}</Text>
                ) : (
                  allocations
                    .filter((a) => a.percentage > 0 && (actualByCategory[a.categoryId] ?? 0) > 0)
                    .map((a) => {
                      const budgetAmt = Math.round(netIncome * a.percentage / 100);
                      const actual = actualByCategory[a.categoryId] || 0;
                      const pct = budgetAmt > 0 ? Math.min(130, (actual / budgetAmt) * 100) : 0;
                      const over = actual > budgetAmt;
                      return (
                        <View key={a.categoryId} className="mb-3">
                          <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-xs font-medium text-gray-800 dark:text-gray-200">{categoryLabel(t, a.categoryId, a.label)}</Text>
                            <Text className={`text-xs font-bold ${over ? 'text-red-500' : 'text-green-600'}`}>
                              {formatCurrency(actual)} / {formatCurrency(budgetAmt)}
                            </Text>
                          </View>
                          <View className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <View
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: over ? '#f87171' : a.color }}
                            />
                          </View>
                        </View>
                      );
                    })
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
