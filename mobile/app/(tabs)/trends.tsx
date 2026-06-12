import { useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  InteractionManager,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTourTarget } from '../../context/TourContext';
import TourHighlight from '../../components/TourHighlight';

const magnifierImg = require('../../assets/m_magnifier.png');
import Svg, { Circle, Path, Line, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight, X, Lock } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../context/LanguageContext';
import { usePurchases } from '../../context/PurchasesContext';
import { usePaywall } from '../../context/PaywallContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const CATEGORY_COLORS: Record<string, string> = {
  food: '#f97316',
  transport: '#3b82f6',
  shopping: '#ec4899',
  entertainment: '#8b5cf6',
  health: '#ef4444',
  housing: '#14b8a6',
  utilities: '#eab308',
  education: '#06b6d4',
  travel: '#f43f5e',
  personal: '#a855f7',
  subscriptions: '#64748b',
  insurance: '#0ea5e9',
  savings: '#22c55e',
  investment: '#15803d',
  investments: '#15803d',
  others: '#94a3b8',
};

const MAX_BAR_HEIGHT = 96;

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function LineChart({
  points,
  color,
  formatCurrency,
}: {
  points: { label: string; value: number }[];
  color: string;
  formatCurrency: (n: number) => string;
}) {
  const maxVal = Math.max(...points.map(p => p.value), 1);
  const vW = 320;
  const vH = 150;
  const padL = 6;
  const padR = 54;
  const padT = 20;
  const padB = 22;
  const cW = vW - padL - padR;
  const cH = vH - padT - padB;
  const n = points.length;

  function toX(i: number) { return padL + (n > 1 ? (i / (n - 1)) * cW : cW / 2); }
  function toY(v: number) { return padT + cH * (1 - v / maxVal); }

  const lineParts = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`);
  const linePath = lineParts.join(' ');
  const fillPath = `${linePath} L${toX(n - 1).toFixed(1)},${(padT + cH).toFixed(1)} L${toX(0).toFixed(1)},${(padT + cH).toFixed(1)} Z`;

  // Auto-scale to 3 grid levels: max, half, 0
  const gridLevels = [maxVal, maxVal / 2, 0];

  function fmtGridLabel(v: number) {
    if (v === 0) return '$0';
    const s = formatCurrency(v);
    // Strip trailing .00 for cleanliness
    return s.replace(/\.00$/, '');
  }

  return (
    <Svg width="100%" height={vH} viewBox={`0 0 ${vW} ${vH}`} preserveAspectRatio="none">
      {/* Horizontal grid lines + Y labels */}
      {gridLevels.map((v, i) => {
        const y = toY(v);
        return (
          <Line
            key={i}
            x1={padL} y1={y}
            x2={vW - padR + 2} y2={y}
            stroke="#f0f0f0" strokeWidth={1}
          />
        );
      })}

      {/* Y-axis labels */}
      {gridLevels.map((v, i) => {
        const y = toY(v);
        return (
          <SvgText
            key={`lbl-${i}`}
            x={vW - padR + 6}
            y={y + 3.5}
            fontSize={9}
            fill="#9ca3af"
          >
            {fmtGridLabel(v)}
          </SvgText>
        );
      })}

      {/* Fill area under line */}
      <Path d={fillPath} fill={color} fillOpacity={0.08} />

      {/* Line */}
      <Path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots */}
      {points.map((p, i) => {
        const isLast = i === n - 1;
        const cx = toX(i);
        const cy = toY(p.value);
        return (
          <Circle
            key={i}
            cx={cx} cy={cy}
            r={isLast ? 4.5 : 2.5}
            fill={p.value > 0 ? color : '#e5e7eb'}
            stroke="white"
            strokeWidth={isLast ? 2 : 1}
          />
        );
      })}

      {/* Last point value label */}
      {(() => {
        const last = points[n - 1];
        if (!last || last.value === 0) return null;
        const x = toX(n - 1);
        const y = toY(last.value) - 8;
        return (
          <SvgText x={x} y={y} textAnchor="middle" fontSize={9} fontWeight="bold" fill={color}>
            {formatCurrency(last.value)}
          </SvgText>
        );
      })()}

      {/* X-axis labels */}
      {points.map((p, i) => (
        <SvgText
          key={`x-${i}`}
          x={toX(i)}
          y={vH - 5}
          textAnchor="middle"
          fontSize={8.5}
          fill={i === n - 1 ? color : '#9ca3af'}
        >
          {p.label}
        </SvgText>
      ))}
    </Svg>
  );
}

// ─── Category Detail Modal ────────────────────────────────────────────────────

type Period = 'monthly' | 'quarterly' | 'annually';

function CategoryModal({
  categoryId,
  onClose,
}: {
  categoryId: string;
  onClose: () => void;
}) {
  const { transactions, formatCurrency } = useApp();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const { isPro } = usePurchases();
  const { showPaywall } = usePaywall();

  const [period, setPeriod] = useState<Period>('monthly');
  const now = new Date();
  const [chartYear, setChartYear] = useState(now.getFullYear());

  const color = CATEGORY_COLORS[categoryId] || '#94a3b8';
  const rawKey = ('cat.' + categoryId) as any;
  const label = (() => {
    const tr = t(rawKey);
    return tr !== rawKey ? tr : categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
  })();

  const catTxs = useMemo(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return transactions.filter(
      (tx) => tx.type === 'expense' && tx.category === categoryId && (!tx.isAutoDebit || new Date(tx.date) <= endOfToday),
    );
  }, [transactions, categoryId]);

  // Earliest year that has data for this category (limits the year selector's back button)
  const minYear = catTxs.length > 0
    ? catTxs.reduce((min, tx) => Math.min(min, new Date(tx.date).getFullYear()), now.getFullYear())
    : now.getFullYear();

  const points = useMemo((): { label: string; value: number }[] => {
    if (period === 'monthly') {
      // Show Jan–Dec of chartYear. For the current year cap at the current month.
      const lastMonth = chartYear === now.getFullYear() ? now.getMonth() : 11;
      return Array.from({ length: lastMonth + 1 }, (_, m) => {
        const val = catTxs.filter(tx => {
          const td = new Date(tx.date);
          return td.getMonth() === m && td.getFullYear() === chartYear;
        }).reduce((s, tx) => s + tx.amount, 0);
        return { label: t(`month.${MONTH_KEYS[m]}.short` as any), value: val };
      });
    }
    if (period === 'quarterly') {
      // Show Q1–Q4 of chartYear. For the current year cap at the current quarter.
      const lastQ = chartYear === now.getFullYear() ? Math.floor(now.getMonth() / 3) : 3;
      return Array.from({ length: lastQ + 1 }, (_, q) => {
        const startM = q * 3, endM = startM + 2;
        const val = catTxs.filter(tx => {
          const td = new Date(tx.date);
          return td.getFullYear() === chartYear && td.getMonth() >= startM && td.getMonth() <= endM;
        }).reduce((s, tx) => s + tx.amount, 0);
        return { label: `Q${q + 1}`, value: val };
      });
    }
    // annually — last 5 years (no year selector)
    return Array.from({ length: 5 }, (_, i) => {
      const year = now.getFullYear() - 4 + i;
      const val = catTxs.filter(tx => new Date(tx.date).getFullYear() === year)
        .reduce((s, tx) => s + tx.amount, 0);
      return { label: String(year), value: val };
    });
  }, [period, chartYear, catTxs, t]);

  const total = points.reduce((s, p) => s + p.value, 0);
  const nonZero = points.filter(p => p.value > 0);
  const avg = nonZero.length > 0 ? total / nonZero.length : 0;
  const highest = points.length > 0 ? points.reduce((a, b) => b.value > a.value ? b : a, points[0]) : null;

  const periodLabel = period === 'monthly'
    ? `${t('trends.monthly')} · ${chartYear}`
    : period === 'quarterly'
    ? `${t('trends.quarterly')} · ${chartYear}`
    : t('trends.annually');

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white dark:bg-gray-900">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-12 pb-3 border-b border-gray-100 dark:border-gray-800">
          <View className="flex-row items-center gap-3">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: color + '25' }}
            >
              <View className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
            </View>
            <View>
              <Text className="text-base font-bold text-gray-900 dark:text-white">{label}</Text>
              <Text className="text-xs text-gray-400">{periodLabel}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
          >
            <X size={16} color={dark ? '#9ca3af' : '#6b7280'} />
          </TouchableOpacity>
        </View>

        {/* Period toggle */}
        <View className="px-5 pt-4 pb-1">
          <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5">
            {(['monthly', 'quarterly', 'annually'] as Period[]).map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => { setPeriod(p); setChartYear(now.getFullYear()); }}
                className={`flex-1 py-1.5 rounded-[10px] items-center ${period === p ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
              >
                <Text className={`text-[11px] font-semibold ${
                  period === p ? 'text-gray-800 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                }`}>
                  {p === 'monthly' ? t('trends.monthly') : p === 'quarterly' ? t('trends.quarterly') : t('trends.annually')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Year selector — shown for monthly and quarterly views only */}
        {period !== 'annually' && (
          <View className="flex-row items-center justify-center gap-5 pt-3 pb-1">
            <TouchableOpacity
              onPress={() => { if (!isPro) { showPaywall(); return; } setChartYear(y => y - 1); }}
              disabled={chartYear <= minYear}
              className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
              activeOpacity={0.7}
            >
              <ChevronLeft size={15} color={chartYear <= minYear ? '#d1d5db' : (dark ? '#9ca3af' : '#6b7280')} />
            </TouchableOpacity>
            <Text className="text-base font-bold text-gray-900 dark:text-white w-12 text-center">
              {chartYear}
            </Text>
            <TouchableOpacity
              onPress={() => setChartYear(y => y + 1)}
              disabled={chartYear >= now.getFullYear()}
              className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
              activeOpacity={0.7}
            >
              <ChevronRight size={15} color={chartYear >= now.getFullYear() ? '#d1d5db' : (dark ? '#9ca3af' : '#6b7280')} />
            </TouchableOpacity>
          </View>
        )}

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Line chart */}
          <View className="px-4 pt-4 pb-2">
            {total === 0 ? (
              <View style={{ height: 150 }} className="items-center justify-center">
                <Text className="text-sm text-gray-400">{t('trends.no_data')}</Text>
              </View>
            ) : (
              <LineChart points={points} color={color} formatCurrency={formatCurrency} />
            )}
          </View>

          {/* Stats row — 3 items */}
          <View className="px-5 flex-row gap-2 mb-5 mt-1">
            {[
              { label: t('trends.total'), value: formatCurrency(total) },
              { label: t('trends.avg_period'), value: formatCurrency(avg) },
              { label: t('trends.highest_val'), value: highest && highest.value > 0 ? `${formatCurrency(highest.value)} (${highest.label})` : '—' },
            ].map(s => (
              <View key={s.label} className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-2xl p-3">
                <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">{s.label}</Text>
                <Text className="text-sm font-bold text-gray-900 dark:text-white" numberOfLines={2}>{s.value}</Text>
              </View>
            ))}
          </View>

          {/* Recent transactions */}
          <View className="px-5 pb-10">
            <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
              {t('trends.recent_txs')}
            </Text>
            {catTxs.length === 0 ? (
              <Text className="text-sm text-gray-400 py-4 text-center">{t('trends.no_txs')}</Text>
            ) : (
              [...catTxs]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((tx) => (
                  <View
                    key={tx.id}
                    className="flex-row items-center justify-between py-3.5 border-b border-gray-100 dark:border-gray-800"
                  >
                    <View className="flex-1 min-w-0 mr-3">
                      <Text className="text-sm font-medium text-gray-900 dark:text-white" numberOfLines={1}>
                        {tx.description || label}
                      </Text>
                      <Text className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <Text className="text-sm font-bold text-red-500 flex-shrink-0">
                      -{formatCurrency(tx.amount)}
                    </Text>
                  </View>
                ))
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Trends Screen ────────────────────────────────────────────────────────────

export default function TrendsScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [_layoutCycle, _bumpLayout] = useState(0);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const task = InteractionManager.runAfterInteractions(() => {
      _bumpLayout(n => n + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    return () => task.cancel();
  }, []));

  const { transactions, formatCurrency } = useApp();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const { isPro } = usePurchases();
  const { showPaywall } = usePaywall();

  const topActive        = useTourTarget('trends-top',        { scrollRef, scrollY: 0 });
  const monthlyActive    = useTourTarget('trends-monthly',    { scrollRef, scrollY: 230 });
  const categoriesActive = useTourTarget('trends-categories', { scrollRef, scrollY: 430 });
  const incomeVsActive   = useTourTarget('trends-income-vs',  { scrollRef, scrollY: 950 });

  const [view, setView] = useState<'spending' | 'income'>('spending');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAllCats, setShowAllCats] = useState(false);

  const currentYear = new Date().getFullYear();

  // Exclude FUTURE-dated auto-debit instances from analytics (instances for months that
  // haven't arrived yet), while including instances for today and any earlier date.
  //
  // IMPORTANT: use LOCAL-time end-of-day as the cutoff, NOT the current UTC moment.
  // addTransaction() and processAutoDebits() both cap auto-debit generation at local
  // midnight (ceiling.setHours(23,59,59,999)).  profile.tsx yearTxs uses the same
  // local-midnight gate.  Using raw `new Date()` (UTC "now") here was inconsistent:
  // in UTC+ timezones (e.g. Malaysia UTC+8) at midnight/early morning, today's
  // auto-debit instance (stored as local-midnight UTC, e.g. "2026-05-27T00:00:00Z")
  // would appear future in UTC and get incorrectly excluded — making the Trends page
  // show 0 income while the Home screen and Profile correctly showed the same income.
  const visibleTransactions = useMemo(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999); // local midnight — matches processAutoDebits ceiling
    return transactions.filter(tx => !tx.isAutoDebit || new Date(tx.date) <= endOfToday);
  }, [transactions]); // `endOfToday` is computed inside — no stale-reference churn

  const monthlyData = useMemo(() => {
    // Compute `today` inside the memo so the 6-month window is always current
    // without causing a re-run on every render (avoids the `now` reference churn).
    const today = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
      const month = d.getMonth();
      const year = d.getFullYear();
      const txs = visibleTransactions.filter((tx) => {
        const td = new Date(tx.date);
        return td.getMonth() === month && td.getFullYear() === year;
      });
      return {
        month,
        year,
        income: txs.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0),
        expenses: txs.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0),
        label: t(`month.${MONTH_KEYS[month]}.short` as any),
      };
    });
  }, [visibleTransactions, t]);

  const categoryTotals = useMemo(() => {
    const yearTxs = visibleTransactions.filter((tx) => {
      const d = new Date(tx.date);
      return d.getFullYear() === currentYear && tx.type === 'expense';
    });
    const totals: Record<string, number> = {};
    yearTxs.forEach((tx) => {
      totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [transactions, currentYear]);

  const totalExpensesThisYear = categoryTotals.reduce((s, [, v]) => s + v, 0);

  const currentMonth = monthlyData[monthlyData.length - 1];
  const prevMonth = monthlyData[monthlyData.length - 2];
  const spendDiff = currentMonth.expenses - prevMonth.expenses;
  const spendPct = prevMonth.expenses > 0 ? Math.round(Math.abs(spendDiff / prevMonth.expenses) * 100) : 0;

  const bars = view === 'spending' ? monthlyData.map((m) => m.expenses) : monthlyData.map((m) => m.income);
  const maxBar = Math.max(...bars, 1);

  return (
    <SafeAreaView key={_layoutCycle} className="flex-1 bg-gray-100 dark:bg-gray-950" edges={['top']}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >

        {/* ── Header ── */}
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-black text-gray-900 dark:text-white">{t('trends.title')}</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('trends.subtitle')}</Text>
          </View>
          <Image source={magnifierImg} style={{ width: 72, height: 72 }} resizeMode="contain" />
        </View>

        {/* ── Summary Cards ── */}
        <TourHighlight active={topActive} style={{ marginHorizontal: 16, marginTop: 4 }} borderRadius={16}><View className="flex-row gap-3">
          {/* Spending card */}
          <View className="flex-1 bg-red-500 rounded-2xl p-4">
            <Text className="text-[10px] text-red-100 font-bold uppercase tracking-widest mb-1">
              {t('trends.this_month')}
            </Text>
            <Text className="text-2xl font-black text-white leading-tight">
              {formatCurrency(currentMonth.expenses)}
            </Text>
            <Text className="text-[11px] text-red-200 mt-0.5">{t('trends.spending')}</Text>
            {prevMonth.expenses > 0 && (
              <View className="flex-row items-center gap-1 mt-2">
                {spendDiff > 0 ? (
                  <TrendingUp size={11} color="rgba(254,226,226,0.9)" />
                ) : spendDiff < 0 ? (
                  <TrendingDown size={11} color="rgba(254,226,226,0.9)" />
                ) : (
                  <Minus size={11} color="rgba(254,226,226,0.9)" />
                )}
                <Text className="text-[10px] text-red-100 font-semibold">
                  {spendDiff === 0
                    ? t('trends.same')
                    : spendDiff > 0
                    ? t('trends.more_pct', { n: spendPct })
                    : t('trends.less_pct', { n: spendPct })}
                </Text>
              </View>
            )}
          </View>

          {/* Income card */}
          <View className="flex-1 bg-green-600 rounded-2xl p-4">
            <Text className="text-[10px] text-green-100 font-bold uppercase tracking-widest mb-1">
              {t('trends.this_month')}
            </Text>
            <Text className="text-2xl font-black text-white leading-tight">
              {formatCurrency(currentMonth.income)}
            </Text>
            <Text className="text-[11px] text-green-200 mt-0.5">{t('trends.income')}</Text>
            {currentMonth.income > 0 && (
              <View className="flex-row items-center gap-1 mt-2">
                {currentMonth.income >= currentMonth.expenses ? (
                  <TrendingUp size={11} color="rgba(220,252,231,0.9)" />
                ) : (
                  <TrendingDown size={11} color="rgba(220,252,231,0.9)" />
                )}
                <Text className="text-[10px] text-green-100 font-semibold">
                  {currentMonth.income >= currentMonth.expenses
                    ? `↗ ${t('common.surplus')} ${formatCurrency(currentMonth.income - currentMonth.expenses)}`
                    : `↘ ${t('common.deficit')} ${formatCurrency(currentMonth.expenses - currentMonth.income)}`}
                </Text>
              </View>
            )}
          </View>
        </View></TourHighlight>

        {/* ── Monthly Bar Chart ── */}
        <TourHighlight active={monthlyActive} style={{ marginHorizontal: 16, marginTop: 16 }} borderRadius={16}><View className="bg-white dark:bg-gray-900 rounded-2xl p-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-sm font-bold text-gray-900 dark:text-white">
              {t('trends.monthly_overview')}
            </Text>
            <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5 gap-0.5">
              {(['spending', 'income'] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => setView(v)}
                  className={`px-3 py-1 rounded-[10px] ${view === v ? 'bg-white dark:bg-gray-700' : ''}`}
                >
                  <Text
                    className={`text-[11px] font-semibold ${
                      view === v
                        ? 'text-gray-800 dark:text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {v === 'spending' ? t('trends.spending') : t('trends.income')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Bars */}
          <View className="flex-row items-end gap-2" style={{ height: MAX_BAR_HEIGHT + 28 }}>
            {monthlyData.map((m, i) => {
              const val = view === 'spending' ? m.expenses : m.income;
              const heightPct = maxBar > 0 ? val / maxBar : 0;
              const barH = Math.max(heightPct * MAX_BAR_HEIGHT, val > 0 ? 4 : 0);
              const isLast = i === monthlyData.length - 1;

              let barColor: string;
              if (view === 'spending') {
                barColor = isLast ? '#ef4444' : (dark ? 'rgba(239,68,68,0.25)' : '#fee2e2');
              } else {
                barColor = isLast ? '#16a34a' : (dark ? 'rgba(22,163,74,0.25)' : '#dcfce7');
              }

              return (
                <View key={`${m.year}-${m.month}`} className="flex-1 items-center gap-1">
                  {val > 0 && (
                    <Text className="text-[8px] text-gray-400 text-center" numberOfLines={1}>
                      {formatCurrency(val)}
                    </Text>
                  )}
                  <View className="flex-1 justify-end w-full">
                    <View
                      className="w-full rounded-t-lg"
                      style={{ height: barH, backgroundColor: barColor }}
                    />
                  </View>
                  <Text
                    className={`text-[10px] font-medium ${
                      isLast
                        ? view === 'spending'
                          ? 'text-red-500'
                          : 'text-green-500'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}
                  >
                    {m.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View></TourHighlight>

        {/* ── Category Breakdown ── */}
        <TourHighlight active={categoriesActive} style={{ marginHorizontal: 16, marginTop: 16 }} borderRadius={16}><View className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
            <Text className="text-sm font-bold text-gray-900 dark:text-white">
              {t('common.categories')}
            </Text>
            <Text className="text-[11px] text-gray-400">
              {t('trends.year_explore', { year: currentYear })}
            </Text>
          </View>

          {categoryTotals.length === 0 ? (
            <Text className="text-sm text-gray-400 text-center py-6 px-5 pb-6">
              {t('trends.no_expense')}
            </Text>
          ) : (
            <>
              {(showAllCats ? categoryTotals : categoryTotals.slice(0, 5)).map(([id, amount]) => {
                const pct = totalExpensesThisYear > 0 ? (amount / totalExpensesThisYear) * 100 : 0;
                const color = CATEGORY_COLORS[id] || '#94a3b8';
                const ck = ('cat.' + id) as any;
                const catLabel = (() => {
                  const tr = t(ck);
                  return tr !== ck ? tr : id.charAt(0).toUpperCase() + id.slice(1);
                })();

                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setSelectedCategory(id)}
                    className="px-5 py-3 border-b border-gray-50 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
                  >
                    <View className="flex-row items-center justify-between mb-1.5">
                      <View className="flex-row items-center gap-2">
                        <View className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <Text className="text-sm font-medium text-gray-900 dark:text-white">{catLabel}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-[11px] text-gray-400">{pct.toFixed(0)}%</Text>
                        <Text className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatCurrency(amount)}
                        </Text>
                        <ChevronRight size={13} color={dark ? '#4b5563' : '#d1d5db'} />
                      </View>
                    </View>
                    <View className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}

              {categoryTotals.length > 5 && (
                <TouchableOpacity
                  onPress={() => setShowAllCats((v) => !v)}
                  className="py-3.5 border-t border-gray-100 dark:border-gray-800 items-center"
                >
                  <Text className="text-[12px] font-semibold text-green-500">
                    {showAllCats
                      ? t('trends.show_less')
                      : t('trends.show_more', { n: categoryTotals.length - 5 })}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View></TourHighlight>

        {/* ── Income vs Expenses ── */}
        {isPro ? (
          <TourHighlight active={incomeVsActive} style={{ marginHorizontal: 16, marginTop: 16 }} borderRadius={16}><View className="bg-white dark:bg-gray-900 rounded-2xl p-5">
            <Text className="text-sm font-bold text-gray-900 dark:text-white mb-4">
              {t('trends.income_vs')}
            </Text>
            <View className="gap-3">
              {[...monthlyData].reverse().map((m) => {
                const maxVal = Math.max(m.income, m.expenses, 1);
                const surplus = m.income - m.expenses;
                return (
                  <View key={`${m.year}-${m.month}`}>
                    <View className="flex-row items-center">
                      <Text className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 w-8">
                        {m.label}
                      </Text>
                      <View className="flex-1 mx-3 gap-1">
                        <View className="flex-row items-center gap-1.5">
                          <View className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                          <View className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <View
                              className="h-full rounded-full bg-green-500"
                              style={{ width: `${(m.income / maxVal) * 100}%` }}
                            />
                          </View>
                        </View>
                        <View className="flex-row items-center gap-1.5">
                          <View className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                          <View className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <View
                              className="h-full rounded-full bg-red-400"
                              style={{ width: `${(m.expenses / maxVal) * 100}%` }}
                            />
                          </View>
                        </View>
                      </View>
                      <Text
                        className={`text-[11px] font-bold w-16 text-right ${
                          surplus > 0 ? 'text-green-500' : surplus < 0 ? 'text-red-500' : 'text-gray-400'
                        }`}
                      >
                        {m.income === 0 && m.expenses === 0
                          ? '–'
                          : `${surplus > 0 ? '+' : surplus < 0 ? '-' : ''}${surplus !== 0 ? formatCurrency(Math.abs(surplus)) : '–'}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View className="flex-row gap-4 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <View className="flex-row items-center gap-1.5">
                <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <Text className="text-[11px] text-gray-400">{t('common.income')}</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <Text className="text-[11px] text-gray-400">{t('common.expenses')}</Text>
              </View>
            </View>
          </View></TourHighlight>
        ) : (
          <TourHighlight active={incomeVsActive} style={{ marginHorizontal: 16, marginTop: 16 }} borderRadius={16}>
            <TouchableOpacity
              onPress={showPaywall}
              activeOpacity={0.8}
              className="bg-white dark:bg-gray-900 rounded-2xl p-5 items-center gap-2"
            >
              <Lock size={18} color="#9ca3af" />
              <Text className="text-sm font-semibold text-gray-400">{t('trends.income_vs')}</Text>
              <Text className="text-xs text-gray-400">{t('trends.upgrade_pro_unlock')}</Text>
            </TouchableOpacity>
          </TourHighlight>
        )}

      </ScrollView>

      {selectedCategory && (
        <CategoryModal
          categoryId={selectedCategory}
          onClose={() => setSelectedCategory(null)}
        />
      )}
    </SafeAreaView>
  );
}
