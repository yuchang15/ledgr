import { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image, InteractionManager, Platform,
} from 'react-native';

const savingsJarImg = require('../../assets/m_savingsjar.png');
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Plus, Target, Search, SlidersHorizontal, TrendingUp, TrendingDown, X,
  LayoutGrid, List, CalendarDays, Camera,
} from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../context/LanguageContext';
import { usePurchases } from '../../context/PurchasesContext';
import { usePaywall } from '../../context/PaywallContext';
import { useTourTarget } from '../../context/TourContext';
import TourHighlight from '../../components/TourHighlight';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, Transaction } from '../../types';
import GreenCard from '../../components/home/GreenCard';
import GoalTrackerCard from '../../components/home/GoalTrackerCard';
import ManualEntryModal from '../../components/home/ManualEntryModal';
import { CategoryIconRaw } from '../../components/home/CategoryIcon';
import Categories, { CalendarModal } from '../../components/home/Categories';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function getGreeting(): 'home.greeting_morning' | 'home.greeting_afternoon' | 'home.greeting_evening' | 'home.greeting_night' {
  const h = new Date().getHours();
  if (h < 12) return 'home.greeting_morning';
  if (h < 17) return 'home.greeting_afternoon';
  if (h < 21) return 'home.greeting_evening';
  return 'home.greeting_night';
}

function translateCategoryLabel(
  t: (key: any, params?: Record<string, string | number>) => string,
  cat?: { id: string; label: string },
): string {
  if (!cat) return '';
  const key = `cat.${cat.id}` as any;
  const translated = t(key);
  return translated !== key ? translated : cat.label;
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const now = new Date();
  const {
    transactions, budget, formatCurrency,
    getMonthExpenses, userProfile,
  } = useApp();
  const { t } = useTranslation();
  const { isPro } = usePurchases();
  const { showPaywall } = usePaywall();

  // Tour step activation (boolean per step — highlights via TourHighlight, no coordinates)
  const greenCardActive = useTourTarget('home-green-card', { scrollRef, scrollY: 0 });
  const statsActive     = useTourTarget('home-stats',       { scrollRef, scrollY: 260 });
  const addTxActive     = useTourTarget('home-add-tx',      { scrollRef, scrollY: 390 });
  const captureActive   = useTourTarget('home-capture');
  const budgetBtnActive = useTourTarget('home-budget-btn',  { scrollRef, scrollY: 390 });
  const toggleActive    = useTourTarget('home-view-toggle', { scrollRef, scrollY: 720 });

  const [showEntry, setShowEntry] = useState(false);
  const [entryPrefill, setEntryPrefill] = useState<{ type?: 'expense' | 'income'; amount?: number; category?: string; description?: string } | undefined>(undefined);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [numbersHidden, setNumbersHidden] = useState(false);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState<'category' | 'date' | 'calendar'>('category');
  const [_layoutCycle, _bumpLayout] = useState(0);

  // Reset scroll and consume any pending receipt left by the camera capture screen.
  // On Android, also bump a layout-cycle counter so SafeAreaView re-reads the
  // correct insets after the camera disturbs the window-inset state (cancel path
  // or save path both trigger this via useFocusEffect).
  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      if (Platform.OS === 'android') _bumpLayout(n => n + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    const PENDING_KEY = 'kachingo_pending_receipt';
    AsyncStorage.getItem(PENDING_KEY).then(raw => {
      if (!raw) return;
      AsyncStorage.removeItem(PENDING_KEY);
      try {
        const data = JSON.parse(raw);
        setEntryPrefill(data);
        setShowEntry(true);
      } catch {}
    });
    // kachingo://add deep link: app/add.tsx stores this flag then redirects here
    AsyncStorage.getItem('kachingo_open_add').then(val => {
      if (val !== '1') return;
      AsyncStorage.removeItem('kachingo_open_add');
      setShowEntry(true);
    });
    return () => task.cancel();
  }, []));

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterMin, setFilterMin] = useState('');
  const [filterMax, setFilterMax] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Budget status for current real month
  const hasBudget = budget.expectedIncome > 0 && budget.allocations.length > 0;
  const currentMonthExpenses = getMonthExpenses(now.getFullYear(), now.getMonth());
  const totalBudget = hasBudget
    ? budget.allocations.reduce((s, a) => s + (budget.expectedIncome * a.percentage / 100), 0)
    : 0;
  const budgetUsedPct = totalBudget > 0 ? (currentMonthExpenses / totalBudget) * 100 : 0;
  const isOverBudget = hasBudget && currentMonthExpenses > totalBudget;

  // Search across ALL transactions
  const q = searchQuery.trim().toLowerCase();
  const searchResults: Transaction[] = useMemo(() => {
    if (!q) return [];
    return transactions.filter(tx => {
      const cat = ALL_CATEGORIES.find(c => c.id === tx.category);
      const catLabel = translateCategoryLabel(t, cat).toLowerCase();
      return (
        tx.description.toLowerCase().includes(q) ||
        catLabel.includes(q) ||
        String(tx.amount).includes(q)
      );
    });
  }, [transactions, q, t]);

  const activeFilterCount =
    (filterType !== 'all' ? 1 : 0) +
    (filterMin ? 1 : 0) +
    (filterMax ? 1 : 0) +
    (filterCategory ? 1 : 0);

  const filterFn = useMemo(() => {
    if (activeFilterCount === 0) return undefined;
    return (tx: Transaction) => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterMin && tx.amount < parseFloat(filterMin)) return false;
      if (filterMax && tx.amount > parseFloat(filterMax)) return false;
      if (filterCategory && tx.category !== filterCategory) return false;
      return true;
    };
  }, [activeFilterCount, filterType, filterMin, filterMax, filterCategory]);

  function clearFilters() {
    setFilterType('all');
    setFilterMin('');
    setFilterMax('');
    setFilterCategory('');
  }

  return (
    <SafeAreaView
      key={_layoutCycle}
      className="flex-1 bg-gray-50 dark:bg-gray-950"
      edges={['top']}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Header ── */}
        <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-xs text-gray-400 dark:text-gray-500 font-medium">{t(getGreeting())}</Text>
            <Text className="text-xl font-black text-gray-900 dark:text-white">{t('home.my_finances')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
            className="w-9 h-9 rounded-full bg-green-600 items-center justify-center overflow-hidden"
          >
            {userProfile.avatar ? (
              <Image
                source={{ uri: userProfile.avatar }}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
            ) : (
              <Text className="text-white font-bold text-sm">
                {(userProfile.name || 'U').charAt(0).toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Green Summary Card ── */}
        <TourHighlight active={greenCardActive} style={{ marginHorizontal: 16 }}>
          <GreenCard
            year={viewYear}
            month={viewMonth}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onYearChange={setViewYear}
            statsHighlightActive={statsActive}
            numbersHidden={numbersHidden}
            onToggleHide={() => setNumbersHidden(h => !h)}
          />
        </TourHighlight>

        {/* ── Goal Tracker Card ── */}
        <View style={{ marginHorizontal: 16 }}>
          <GoalTrackerCard year={viewYear} month={viewMonth} />
        </View>

        {/* ── Action buttons ── */}
        <View className="mx-4 mt-4 gap-y-3">
          <View className="flex-row gap-3">
            {/* Add Transaction */}
            <TourHighlight active={addTxActive} style={{ flex: 1 }} borderRadius={18}>
            <TouchableOpacity
              onPress={() => setShowEntry(true)}
              activeOpacity={0.8}
              accessibilityLabel={t('accessibility.add_transaction')}
              className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3.5 flex-row items-center gap-2.5"
            >
              <View className="w-7 h-7 rounded-full bg-green-600 items-center justify-center">
                <Plus size={15} color="white" strokeWidth={2.5} />
              </View>
              <Text className="text-gray-900 dark:text-white text-sm font-semibold flex-shrink flex-1" numberOfLines={1}>
                {t('home.add_transaction')}
              </Text>
            </TouchableOpacity>
            </TourHighlight>

            {/* Budget status */}
            <TourHighlight active={budgetBtnActive} style={{ flex: 1 }} borderRadius={18}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/budget')}
              activeOpacity={0.8}
              className={`rounded-2xl px-4 py-3.5 flex-row items-center gap-2.5 ${
                !hasBudget
                  ? 'bg-gray-100 dark:bg-gray-800'
                  : isOverBudget
                  ? 'bg-red-50 dark:bg-red-900/30'
                  : 'bg-green-50 dark:bg-green-900/30'
              }`}
            >
              <View className={`w-7 h-7 rounded-full items-center justify-center ${
                !hasBudget ? 'bg-gray-400 dark:bg-gray-600' : isOverBudget ? 'bg-red-500' : 'bg-green-600'
              }`}>
                <Target size={14} color="white" strokeWidth={2.5} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className={`text-sm font-semibold leading-tight ${
                  !hasBudget ? 'text-gray-700 dark:text-white'
                    : isOverBudget ? 'text-red-600 dark:text-red-400'
                    : 'text-green-700 dark:text-green-400'
                }`} numberOfLines={1}>
                  {!hasBudget
                    ? t('home.set_budget')
                    : isOverBudget
                    ? t('home.over_budget')
                    : t('home.on_track')}
                </Text>
                {hasBudget && (
                  <Text className={`text-[11px] font-semibold mt-0.5 ${isOverBudget ? 'text-red-500' : 'text-green-500'}`}>
                    {budgetUsedPct.toFixed(0)}{t('home.pct_used')}
                  </Text>
                )}
              </View>
              {hasBudget && (
                isOverBudget
                  ? <TrendingDown size={14} color="#ef4444" />
                  : <TrendingUp size={14} color="#22c55e" />
              )}
            </TouchableOpacity>
            </TourHighlight>
          </View>

          {/* Search + Filter row */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => { setShowSearch(s => !s); if (showFilter) setShowFilter(false); }}
              activeOpacity={0.8}
              className={`flex-1 rounded-2xl px-4 py-3 flex-row items-center gap-2 ${
                showSearch
                  ? 'bg-green-600'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}
            >
              <Search size={15} color={showSearch ? 'white' : '#6b7280'} />
              <Text className={`text-sm font-semibold ${showSearch ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                {t('common.search')}
              </Text>
              {showSearch && q ? (
                <Text className="ml-auto text-white/80 text-xs">{searchResults.length}</Text>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setShowFilter(f => !f); if (showSearch) setShowSearch(false); }}
              activeOpacity={0.8}
              className={`flex-1 rounded-2xl px-4 py-3 flex-row items-center gap-2 ${
                showFilter
                  ? 'bg-green-600'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}
            >
              <SlidersHorizontal size={15} color={showFilter ? 'white' : (activeFilterCount > 0 ? '#22c55e' : '#6b7280')} />
              <Text className={`text-sm font-semibold ${showFilter ? 'text-white' : (activeFilterCount > 0 ? 'text-green-600 dark:text-green-500' : 'text-gray-600 dark:text-gray-300')}`}>
                {t('home.filter')}
              </Text>
              {activeFilterCount > 0 && (
                <View className={`ml-auto w-5 h-5 rounded-full items-center justify-center ${showFilter ? 'bg-white' : 'bg-green-600'}`}>
                  <Text className={`text-[10px] font-bold ${showFilter ? 'text-green-600' : 'text-white'}`}>
                    {activeFilterCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Search panel ── */}
        {showSearch && (
          <View className="mx-4 mt-2 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
            <View className="flex-row items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 mb-3">
              <Search size={14} color="#9ca3af" />
              <TextInput
                className="flex-1 text-sm text-gray-900 dark:text-white"
                placeholder={t('home.search_placeholder')}
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {q ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={14} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </View>

            {!q && (
              <Text className="text-xs text-gray-400 text-center">{t('home.search_desc')}</Text>
            )}

            {q && searchResults.length === 0 && (
              <Text className="text-xs text-gray-400 text-center py-1">{t('home.no_transactions')}</Text>
            )}

            {searchResults.length > 0 && (
              <View className="gap-1.5" style={{ maxHeight: 220 }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {searchResults.map(tx => {
                    const cat = ALL_CATEGORIES.find(c => c.id === tx.category);
                    return (
                      <View key={tx.id} className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 mb-1.5">
                        <View className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color ?? '#9ca3af' }} />
                        <View className="flex-1 min-w-0">
                          <Text className="text-xs font-medium text-gray-900 dark:text-white" numberOfLines={1}>
                            {tx.description || translateCategoryLabel(t, cat)}
                          </Text>
                          <Text className="text-[10px] text-gray-400">{translateCategoryLabel(t, cat)} · {formatDate(tx.date)}</Text>
                        </View>
                        <Text className={`text-xs font-bold flex-shrink-0 ${tx.type === 'income' ? 'text-green-600' : 'text-gray-700 dark:text-gray-300'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* ── Filter panel ── */}
        {showFilter && (
          <View className="mx-4 mt-2 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 gap-4">
            {/* Type */}
            <View>
              <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t('common.type')}</Text>
              <View className="flex-row gap-2">
                {(['all', 'income', 'expense'] as const).map(ft => (
                  <TouchableOpacity key={ft} onPress={() => setFilterType(ft)}
                    className={`flex-1 py-2 rounded-xl items-center ${filterType === ft ? 'bg-green-600' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Text className={`text-xs font-bold ${filterType === ft ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      {ft === 'all' ? t('common.all') : ft === 'income' ? t('common.income') : t('common.expense')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Amount range */}
            <View>
              <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t('home.amount_range')}</Text>
              <View className="flex-row gap-2">
                <TextInput
                  className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700"
                  placeholder={t('home.filter_min')}
                  placeholderTextColor="#9ca3af"
                  value={filterMin}
                  onChangeText={setFilterMin}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700"
                  placeholder={t('home.filter_max')}
                  placeholderTextColor="#9ca3af"
                  value={filterMax}
                  onChangeText={setFilterMax}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Category */}
            <View>
              <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t('common.categories')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setFilterCategory('')}
                    className={`px-3 py-1.5 rounded-xl ${filterCategory === '' ? 'bg-green-600' : 'bg-gray-100 dark:bg-gray-800'}`}
                  >
                    <Text className={`text-xs font-semibold ${filterCategory === '' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      {t('home.all_categories')}
                    </Text>
                  </TouchableOpacity>
                  {ALL_CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setFilterCategory(cat.id === filterCategory ? '' : cat.id)}
                      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl ${filterCategory === cat.id ? '' : 'bg-gray-100 dark:bg-gray-800'}`}
                      style={filterCategory === cat.id ? { backgroundColor: cat.color + '25', borderWidth: 1, borderColor: cat.color } : {}}
                    >
                      <CategoryIconRaw icon={cat.icon} color={filterCategory === cat.id ? cat.color : '#9ca3af'} size={11} />
                      <Text
                        className={`text-xs font-semibold ${filterCategory === cat.id ? '' : 'text-gray-500 dark:text-gray-400'}`}
                        style={filterCategory === cat.id ? { color: cat.color } : {}}
                      >
                        {t(`cat.${cat.id}` as any)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={clearFilters}
                className="py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 items-center">
                <Text className="text-xs font-semibold text-red-500 dark:text-red-400">
                  {t('home.clear_n_filters', { n: activeFilterCount, s: activeFilterCount !== 1 ? 's' : '' })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Transactions header ── */}
        <View className="mx-4 mt-5 mb-3 flex-row items-center justify-between">
          <Text className="text-base font-bold text-gray-900 dark:text-white">
            {activeFilterCount > 0
              ? t('home.filtered')
              : viewMode === 'date'
              ? t('home.by_date')
              : viewMode === 'calendar'
              ? 'Calendar'
              : t('common.categories')}
          </Text>
          <TourHighlight active={toggleActive} borderRadius={8}><View className="flex-row items-center gap-1">
            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={clearFilters} className="mr-2">
                <Text className="text-xs font-semibold text-green-600">{t('home.clear')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setViewMode('category')}
              className={`p-1.5 rounded-lg ${viewMode === 'category' ? 'bg-green-100 dark:bg-green-900/30' : ''}`}
            >
              <LayoutGrid size={16} color={viewMode === 'category' ? '#16a34a' : '#9ca3af'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('date')}
              className={`p-1.5 rounded-lg ${viewMode === 'date' ? 'bg-green-100 dark:bg-green-900/30' : ''}`}
            >
              <List size={16} color={viewMode === 'date' ? '#16a34a' : '#9ca3af'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg ${viewMode === 'calendar' ? 'bg-green-100 dark:bg-green-900/30' : ''}`}
            >
              <CalendarDays size={16} color={viewMode === 'calendar' ? '#16a34a' : '#9ca3af'} />
            </TouchableOpacity>
          </View></TourHighlight>
        </View>

        {/* ── Transaction List / Empty State ── */}
        <View className="mb-32">
          {transactions.length === 0 ? (
            <View className="items-center py-12 px-8">
              <Image source={savingsJarImg} style={{ width: 110, height: 110 }} resizeMode="contain" />
              <Text className="text-base font-bold text-gray-900 dark:text-white mt-4 text-center">
                {t('home.empty_title')}
              </Text>
              <Text className="text-sm text-gray-400 dark:text-gray-500 mt-1.5 text-center">
                {t('home.empty_desc')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowEntry(true)}
                className="mt-5 bg-green-600 rounded-2xl px-6 py-3 flex-row items-center gap-2"
                activeOpacity={0.85}
              >
                <Plus size={16} color="white" strokeWidth={2.5} />
                <Text className="text-white font-semibold text-sm">{t('home.add_transaction')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Categories
              year={viewYear}
              month={viewMonth}
              view={viewMode === 'calendar' ? 'date' : viewMode}
              filterFn={filterFn}
              onEdit={(tx) => { setEditTx(tx); setShowEntry(true); }}
            />
          )}
        </View>
      </ScrollView>

      <ManualEntryModal
        visible={showEntry}
        onClose={() => { setShowEntry(false); setEntryPrefill(undefined); setEditTx(null); }}
        prefill={editTx ?? entryPrefill}
        transactionId={editTx?.id}
      />

      {/* ── Camera FAB ── */}
      <TourHighlight active={captureActive} style={{ position: 'absolute', bottom: 24, right: 20 }} borderRadius={28}>
        <TouchableOpacity
          onPress={() => { if (!isPro) { showPaywall(); return; } router.push('/capture'); }}
          className="w-14 h-14 bg-green-600 rounded-full items-center justify-center shadow-lg"
          activeOpacity={0.85}
          accessibilityLabel={t('accessibility.scan_receipt')}
          style={{ elevation: 6 }}
        >
          <Camera size={22} color="white" />
        </TouchableOpacity>
      </TourHighlight>

      {viewMode === 'calendar' && (
        <CalendarModal
          year={viewYear}
          month={viewMonth}
          transactions={transactions}
          formatCurrency={formatCurrency}
          onClose={() => setViewMode('category')}
        />
      )}
    </SafeAreaView>
  );
}
