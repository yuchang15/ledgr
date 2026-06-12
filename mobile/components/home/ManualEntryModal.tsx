import { useState, useEffect, useRef } from 'react';

const paymentMascotImg = require('../../assets/m_payment.png');
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playCoinSound } from '../../utils/sounds';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshCw, Calendar, Plus, X, ChevronDown, ChevronUp, Image as ImageIcon, ChevronRight } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../context/LanguageContext';
import { usePurchases } from '../../context/PurchasesContext';
import { usePaywall } from '../../context/PaywallContext';
import { TransactionType, AutoDebitPeriod, CustomCategory, CURRENCIES } from '../../types';
import CategoryIcon from './CategoryIcon';
import QuickAddCategorySheet from '../QuickAddCategorySheet';
import { fetchExchangeRate } from '../../utils/exchangeRate';

interface Props {
  visible: boolean;
  onClose: () => void;
  prefill?: {
    type?: TransactionType;
    amount?: number;
    category?: string;
    description?: string;
    date?: string;
    receiptImage?: string;
    isAutoDebit?: boolean;
    autoDebitPeriod?: AutoDebitPeriod;
    linkedGoalId?: string;
    paymentMethod?: string;
  };
  transactionId?: string;
}

const DESCRIPTION_SUGGESTIONS: Record<string, string[]> = {
  food:          ['tx.suggest.food.breakfast', 'tx.suggest.food.lunch', 'tx.suggest.food.dinner', 'tx.suggest.food.coffee', 'tx.suggest.food.brunch', 'tx.suggest.food.snack', 'tx.suggest.food.takeaway', 'tx.suggest.food.groceries', 'tx.suggest.food.meal_prep'],
  transport:     ['tx.suggest.transport.fuel', 'tx.suggest.transport.bus', 'tx.suggest.transport.train', 'tx.suggest.transport.taxi', 'tx.suggest.transport.rideshare', 'tx.suggest.transport.parking', 'tx.suggest.transport.toll', 'tx.suggest.transport.airplane', 'tx.suggest.transport.ferry'],
  shopping:      ['tx.suggest.shopping.clothing', 'tx.suggest.shopping.electronics', 'tx.suggest.shopping.home_goods', 'tx.suggest.shopping.online_order', 'tx.suggest.shopping.gift_purchase'],
  entertainment: ['tx.suggest.entertainment.movie', 'tx.suggest.entertainment.concert', 'tx.suggest.entertainment.gaming', 'tx.suggest.entertainment.streaming', 'tx.suggest.entertainment.books', 'tx.suggest.entertainment.night_out', 'tx.suggest.entertainment.studio'],
  health:        ['tx.suggest.health.gym', 'tx.suggest.health.doctor_visit', 'tx.suggest.health.pharmacy', 'tx.suggest.health.dentist', 'tx.suggest.health.vitamins', 'tx.suggest.health.therapy', 'tx.suggest.health.optician', 'tx.suggest.health.lab_test'],
  housing:       ['tx.suggest.housing.rent', 'tx.suggest.housing.mortgage', 'tx.suggest.housing.repairs', 'tx.suggest.housing.furniture', 'tx.suggest.housing.cleaning', 'tx.suggest.housing.renovation'],
  utilities:     ['tx.suggest.utilities.electricity', 'tx.suggest.utilities.water', 'tx.suggest.utilities.gas', 'tx.suggest.utilities.internet', 'tx.suggest.utilities.phone_bill'],
  education:     ['tx.suggest.education.tuition', 'tx.suggest.education.course', 'tx.suggest.education.books', 'tx.suggest.education.workshop', 'tx.suggest.education.online_class', 'tx.suggest.education.exam_fee'],
  travel:        ['tx.suggest.travel.flight', 'tx.suggest.travel.hotel', 'tx.suggest.travel.car_rental', 'tx.suggest.travel.visa_fee', 'tx.suggest.travel.activities'],
  personal:      ['tx.suggest.personal.haircut', 'tx.suggest.personal.salon', 'tx.suggest.personal.skincare', 'tx.suggest.personal.spa', 'tx.suggest.personal.personal_care'],
  subscriptions: ['tx.suggest.subscriptions.netflix', 'tx.suggest.subscriptions.spotify', 'tx.suggest.subscriptions.software', 'tx.suggest.subscriptions.cloud_storage', 'tx.suggest.subscriptions.app_subscription'],
  insurance:     ['tx.suggest.insurance.health', 'tx.suggest.insurance.car', 'tx.suggest.insurance.life', 'tx.suggest.insurance.home'],
  savings:       ['tx.suggest.savings.emergency_fund', 'tx.suggest.savings.retirement', 'tx.suggest.savings.holiday_fund', 'tx.suggest.savings.house_deposit'],
  investment:    ['tx.suggest.investment.stocks', 'tx.suggest.investment.etf', 'tx.suggest.investment.crypto', 'tx.suggest.investment.bonds', 'tx.suggest.investment.index_fund'],
  others:        ['tx.suggest.others.miscellaneous', 'tx.suggest.others.gift', 'tx.suggest.others.charity', 'tx.suggest.others.fees'],
  salary:        ['tx.suggest.income.monthly_salary', 'tx.suggest.income.base_pay', 'tx.suggest.income.paycheck', 'tx.suggest.income.wages'],
  freelance:     ['tx.suggest.income.design_project', 'tx.suggest.income.consulting', 'tx.suggest.income.writing', 'tx.suggest.income.development'],
  business:      ['tx.suggest.income.revenue', 'tx.suggest.income.sales', 'tx.suggest.income.invoice_payment', 'tx.suggest.income.client_payment'],
  gift:          ['tx.suggest.income.birthday_gift', 'tx.suggest.income.holiday_gift', 'tx.suggest.income.cash_gift'],
  other_income:  ['tx.suggest.income.bonus', 'tx.suggest.income.refund', 'tx.suggest.income.cashback', 'tx.suggest.income.side_hustle', 'tx.suggest.income.rental_income', 'tx.suggest.income.dividend'],
};

function getCategoryLabel(t: (key: any, params?: Record<string, string | number>) => string, cat: { id: string; label: string }) {
  const key = `cat.${cat.id}` as any;
  const translation = t(key);
  return translation !== key ? translation : cat.label;
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToDateString(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr: string) {
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function CalendarDateModal({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const calInsets = useSafeAreaInsets();
  const initial = new Date(`${value}T12:00:00`);
  const [viewDate, setViewDate] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );

  useEffect(() => {
    if (!visible) return;
    const next = new Date(`${value}T12:00:00`);
    setViewDate(new Date(next.getFullYear(), next.getMonth(), 1));
  }, [value, visible]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const selected = new Date(`${value}T12:00:00`);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, idx) => idx + 1),
  ];

  function toIso(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white dark:bg-gray-900 rounded-t-3xl px-5 pt-5" style={{ paddingBottom: calInsets.bottom + 16 }}>
          <View className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700 self-center mb-4" />
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              onPress={() => setViewDate(new Date(year, month - 1, 1))}
              className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
            >
              <Text className="text-lg text-gray-600 dark:text-gray-300">‹</Text>
            </TouchableOpacity>
            <View className="items-center">
              <Text className="text-base font-bold text-gray-900 dark:text-white">
                {t(`month.${['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][month]}` as any)} {year}
              </Text>
              <Text className="text-xs text-gray-400">{t('tx.select_date')}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setViewDate(new Date(year, month + 1, 1))}
              className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
            >
              <Text className="text-lg text-gray-600 dark:text-gray-300">›</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
              <Text key={`${d}-${idx}`} className="flex-1 text-center text-[11px] font-bold text-gray-400">
                {d}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {cells.map((day, idx) => {
              const iso = day ? toIso(day) : '';
              const isSelected =
                day &&
                selected.getFullYear() === year &&
                selected.getMonth() === month &&
                selected.getDate() === day;
              return (
                <View key={`${idx}-${day ?? 'blank'}`} style={{ width: `${100 / 7}%`, padding: 3 }}>
                  {day ? (
                    <TouchableOpacity
                      onPress={() => {
                        onSelect(iso);
                        onClose();
                      }}
                      className={`aspect-square rounded-2xl items-center justify-center ${
                        isSelected ? 'bg-green-600' : 'bg-gray-50 dark:bg-gray-800'
                      }`}
                    >
                      <Text className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View className="aspect-square" />
                  )}
                </View>
              );
            })}
          </View>

          <TouchableOpacity onPress={onClose} className="mt-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 items-center">
            <Text className="font-semibold text-gray-600 dark:text-gray-300">{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ManualEntryModal({ visible, onClose, transactionId, prefill }: Props) {
  const { addTransaction, updateTransaction, getCurrencySymbol, formatCurrency, expenseCategories, incomeCategories, budget, updateCustomGoal, transactions, userProfile } = useApp();
  const { t } = useTranslation();
  const { isPro } = usePurchases();
  const { showPaywall } = usePaywall();
  const insets = useSafeAreaInsets();

  const PERIODS: { value: AutoDebitPeriod; label: string }[] = [
    { value: 'daily',    label: t('period.daily') },
    { value: 'weekly',   label: t('period.weekly') },
    { value: 'biweekly', label: t('period.biweekly') },
    { value: 'monthly',  label: t('period.monthly') },
    { value: 'yearly',   label: t('period.yearly') },
  ];

  const [type, setType] = useState<TransactionType>(prefill?.type ?? 'expense');
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : '');
  const [date, setDate] = useState(prefill?.date ? isoToDateString(prefill.date) : todayString());
  const [category, setCategory] = useState(prefill?.category ?? '');
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [isAutoDebit, setIsAutoDebit] = useState(prefill?.isAutoDebit ?? false);
  const [period, setPeriod] = useState<AutoDebitPeriod>(prefill?.autoDebitPeriod ?? 'monthly');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [viewReceipt, setViewReceipt] = useState(false);
  const [linkedGoalId, setLinkedGoalId] = useState(prefill?.linkedGoalId ?? '');
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customDateInput, setCustomDateInput] = useState(date);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAddTxHint, setShowAddTxHint] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(prefill?.paymentMethod ?? 'cash');

  // Transaction currency (may differ from user's default)
  const userCurrency = userProfile?.currency ?? 'USD';
  const [txCurrency, setTxCurrency] = useState(userCurrency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [rateError, setRateError] = useState(false);
  const rateReqRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const nextDate = prefill?.date ? isoToDateString(prefill.date) : todayString();
    setType(prefill?.type ?? 'expense');
    setAmount(prefill?.amount ? String(prefill.amount) : '');
    setDate(nextDate);
    setCustomDateInput(nextDate);
    setCategory(prefill?.category ?? '');
    setDescription(prefill?.description ?? '');
    setIsAutoDebit(prefill?.isAutoDebit ?? false);
    setPeriod(prefill?.autoDebitPeriod ?? 'monthly');
    setLinkedGoalId(prefill?.linkedGoalId ?? '');
    setPaymentMethod(prefill?.paymentMethod ?? 'cash');
    setTxCurrency(userCurrency);
    setExchangeRate(null);
    setRateError(false);
    setShowCurrencyPicker(false);
    setCurrencySearch('');
    setShowCategoryPicker(false);
    setShowPeriodPicker(false);
    setShowAddCategory(false);
    setViewReceipt(false);
    setCustomDateMode(false);
    setShowDatePicker(false);
  }, [visible, prefill]);

  // Fetch exchange rate when txCurrency differs from user's default currency
  useEffect(() => {
    if (txCurrency === userCurrency) {
      setExchangeRate(null);
      setRateError(false);
      return;
    }
    const reqId = ++rateReqRef.current;
    setIsFetchingRate(true);
    setRateError(false);
    fetchExchangeRate(txCurrency, userCurrency).then(rate => {
      if (reqId !== rateReqRef.current) return;
      setIsFetchingRate(false);
      if (rate === null) {
        setRateError(true);
        setExchangeRate(null);
      } else {
        setExchangeRate(rate);
        setRateError(false);
      }
    });
  }, [txCurrency, userCurrency]);

  useEffect(() => {
    AsyncStorage.getItem('ledgr_addtx_hint_seen').then(val => {
      if (!val) setShowAddTxHint(true);
    });
  }, []);

  const categories = type === 'expense' ? expenseCategories : incomeCategories;
  const selectedCategory = categories.find(c => c.id === category);

  const isSavings = type === 'expense' && category === 'savings';
  const saveOptions: Array<{ id: string; name: string }> = [];
  if (budget.savingsGoal?.enabled) saveOptions.push({ id: '__monthly__', name: t('tx.monthly_savings_goal') });
  (budget.customGoals ?? []).forEach(g => saveOptions.push({ id: g.id, name: g.name }));
  const savingsBlocked = isSavings && saveOptions.length > 0 && !linkedGoalId;

  const canSubmit = !!(amount && category && !savingsBlocked);

  const currencySymbol = getCurrencySymbol();

  function handleTypeChange(newType: TransactionType) {
    setType(newType);
    setCategory('');
    setLinkedGoalId('');
  }

  function handleDateShortcut(which: 'today' | 'yesterday') {
    const s = which === 'today' ? todayString() : yesterdayString();
    setDate(s);
    setCustomDateInput(s);
    setCustomDateMode(false);
  }

  function handleCustomDateConfirm() {
    // Accept YYYY-MM-DD or DD/MM/YYYY
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(customDateInput)
      ? customDateInput
      : customDateInput; // fall through as-is; validate leniently
    setDate(iso);
    setCustomDateMode(false);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const rawAmount = parseFloat(amount);
    // If a foreign currency was selected and we have a rate, convert to user's default
    const finalAmount = txCurrency !== userCurrency && exchangeRate !== null
      ? Math.round(rawAmount * exchangeRate * 100) / 100
      : rawAmount;
    const data = {
      type,
      amount: finalAmount,
      originalAmount: txCurrency !== userCurrency && exchangeRate !== null ? rawAmount : undefined,
      originalCurrency: txCurrency !== userCurrency && exchangeRate !== null ? txCurrency : undefined,
      category,
      description,
      date: new Date(date + 'T12:00:00').toISOString(),
      isAutoDebit,
      autoDebitPeriod: isAutoDebit ? period : undefined,
      receiptImage: prefill?.receiptImage,
      linkedGoalId: (category === 'savings' && linkedGoalId) ? linkedGoalId : undefined,
      paymentMethod,
    };
    if (transactionId) {
      updateTransaction(transactionId, data);
    } else {
      if (!isPro) {
        const now = new Date();
        const monthCount = transactions.filter(tx => {
          const d = new Date(tx.date);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }).length;
        if (monthCount >= 50) {
          showPaywall();
          return;
        }
      }
      addTransaction(data);
      playCoinSound();
      if (category === 'savings' && linkedGoalId && linkedGoalId !== '__monthly__') {
        const g = (budget.customGoals ?? []).find(g => g.id === linkedGoalId);
        if (g) updateCustomGoal(linkedGoalId, { savedAmount: g.savedAmount + parseFloat(amount) });
      }
      // Reset form so the next opening starts clean
      setType('expense');
      setAmount('');
      setDate(todayString());
      setCategory('');
      setDescription('');
      setIsAutoDebit(false);
      setPeriod('monthly');
      setLinkedGoalId('');
      setPaymentMethod('cash');
      setTxCurrency(userCurrency);
      setExchangeRate(null);
      setCustomDateMode(false);
      setCustomDateInput(todayString());
      setShowCategoryPicker(false);
      setShowPeriodPicker(false);
    }
    onClose();
  }

  function handleNewCategoryCreated(cat: CustomCategory) {
    setShowAddCategory(false);
    setCategory(cat.id);
  }

  const suggestions = (DESCRIPTION_SUGGESTIONS[category] ?? []).map(suggestion => t(suggestion));

  const buttonLabel = !amount || !category
    ? t('tx.fill')
    : savingsBlocked
      ? t('tx.select_goal_first')
      : transactionId
        ? t('tx.edit')
        : t('tx.confirm');

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-white dark:bg-gray-900"
        >
          {/* Drag pill */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-3">
            <View className="flex-row items-center gap-2">
              <Image source={paymentMascotImg} style={{ width: 52, height: 52 }} resizeMode="contain" />
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                {transactionId ? t('tx.edit') : t('tx.new')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel={t('accessibility.close')}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
            >
              <X size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            className="flex-1 px-5"
            contentContainerStyle={{ paddingBottom: 16 + Math.max(insets.bottom, 60) }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Receipt thumbnail */}
            {prefill?.receiptImage && (
              <TouchableOpacity
                onPress={() => setViewReceipt(true)}
                className="w-full flex-row items-center gap-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-3 mb-4"
              >
                <Image
                  source={{ uri: prefill.receiptImage }}
                  className="w-14 h-14 rounded-xl"
                  resizeMode="cover"
                />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-900 dark:text-white">{t('tx.receipt')}</Text>
                  <Text className="text-xs text-gray-400">{t('tx.tap_view')}</Text>
                </View>
                <ImageIcon size={16} color="#d1d5db" />
              </TouchableOpacity>
            )}

            {showAddTxHint && (
              <View className="mt-3 mb-1 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40 rounded-2xl p-3 flex-row gap-3 items-start">
                <Text className="text-lg flex-shrink-0">💡</Text>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-green-800 dark:text-green-300 mb-0.5">{t('tx.quick_tip')}</Text>
                  <Text className="text-[11px] text-green-700 dark:text-green-400 leading-relaxed">{t('tx.tip_body')}</Text>
                </View>
                <TouchableOpacity onPress={() => { setShowAddTxHint(false); AsyncStorage.setItem('ledgr_addtx_hint_seen', '1'); }}>
                  <X size={14} color="#16a34a" />
                </TouchableOpacity>
              </View>
            )}

            {/* Type toggle */}
            <View className="flex-row rounded-2xl border border-gray-100 dark:border-gray-800 p-1 bg-gray-50 dark:bg-gray-800 mb-4">
              <TouchableOpacity
                onPress={() => handleTypeChange('expense')}
                className={`flex-1 py-2.5 rounded-xl items-center ${type === 'expense' ? 'bg-red-500' : ''}`}
              >
                <Text className={`text-sm font-semibold ${type === 'expense' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  {t('common.expense')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleTypeChange('income')}
                className={`flex-1 py-2.5 rounded-xl items-center ${type === 'income' ? 'bg-green-600' : ''}`}
              >
                <Text className={`text-sm font-semibold ${type === 'income' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  {t('common.income')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1.5">{t('common.amount')}</Text>
              <View className="flex-row items-center border-2 border-gray-100 dark:border-gray-800 rounded-2xl px-3 py-3 bg-gray-50 dark:bg-gray-800 gap-2">
                {/* Currency selector chip */}
                <TouchableOpacity
                  onPress={() => { setShowCurrencyPicker(true); setCurrencySearch(''); }}
                  className="flex-row items-center gap-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-2.5 py-1.5"
                  activeOpacity={0.7}
                >
                  <Text className="text-xs font-bold text-gray-700 dark:text-gray-200">{txCurrency}</Text>
                  <ChevronDown size={10} color="#9ca3af" />
                </TouchableOpacity>
                <TextInput
                  placeholder="0.00"
                  placeholderTextColor="#d1d5db"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  className="flex-1 text-xl font-bold text-gray-900 dark:text-white"
                />
              </View>

              {/* Conversion row — shown when foreign currency selected */}
              {txCurrency !== userCurrency && (
                <View className="flex-row items-center gap-2 mt-1.5 px-1">
                  {isFetchingRate ? (
                    <>
                      <ActivityIndicator size="small" color="#16a34a" />
                      <Text className="text-xs text-gray-400">{t('tx.rate_loading')}</Text>
                    </>
                  ) : rateError ? (
                    <Text className="text-xs text-red-400">{t('tx.rate_error')}</Text>
                  ) : exchangeRate !== null && amount && parseFloat(amount) > 0 ? (
                    <>
                      <Text className="text-xs text-green-600 dark:text-green-400 font-semibold">
                        {t('tx.converts_to', {
                          amount: formatCurrency(Math.round(parseFloat(amount) * exchangeRate * 100) / 100),
                        })}
                      </Text>
                      <Text className="text-[10px] text-gray-400">({userCurrency})</Text>
                    </>
                  ) : exchangeRate !== null ? (
                    <Text className="text-[10px] text-gray-400">
                      1 {txCurrency} = {formatCurrency(exchangeRate)}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>

            {/* Date */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1.5">{t('common.date')}</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => handleDateShortcut('today')}
                  className={`flex-1 py-2.5 rounded-xl items-center border ${
                    date === todayString() && !customDateMode
                      ? 'bg-green-600 border-green-600'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${date === todayString() && !customDateMode ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                    {t('common.today')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDateShortcut('yesterday')}
                  className={`flex-1 py-2.5 rounded-xl items-center border ${
                    date === yesterdayString() && !customDateMode
                      ? 'bg-green-600 border-green-600'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${date === yesterdayString() && !customDateMode ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                    {t('common.yesterday')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setCustomDateMode(true);
                    setShowDatePicker(true);
                  }}
                  className={`flex-1 py-2.5 rounded-xl items-center border ${
                    customDateMode
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${customDateMode ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                    {customDateMode ? formatDateDisplay(date) : t('common.custom')}
                  </Text>
                </TouchableOpacity>
              </View>
              {customDateMode && (
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="mt-2 flex-row items-center border-2 border-blue-300 dark:border-blue-700 rounded-2xl px-4 py-3 bg-gray-50 dark:bg-gray-800 gap-2"
                >
                  <Calendar size={16} color="#6b7280" />
                  <Text className="flex-1 text-sm font-medium text-gray-900 dark:text-white">
                    {formatDateDisplay(date)}
                  </Text>
                  <Text className="text-sm font-semibold text-blue-500">{t('tx.change_date')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Payment Method */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1.5">{t('tx.payment_method')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {((): Array<{ id: string; label: string; emoji: string }> => {
                  const isUSD = (userProfile?.currency ?? 'USD') === 'USD';
                  return [
                    { id: 'cash',    label: t('tx.pm.cash'),                  emoji: '💵' },
                    { id: 'card',    label: t('tx.pm.card'),                  emoji: '💳' },
                    { id: 'bank',    label: t('tx.pm.bank'),                  emoji: '🏦' },
                    { id: 'ewallet', label: isUSD ? t('tx.pm.cashapp') : t('tx.pm.ewallet'), emoji: '📱' },
                    { id: 'other',   label: t('tx.pm.other'),                 emoji: '➕' },
                  ];
                })().map(pm => (
                  <TouchableOpacity
                    key={pm.id}
                    onPress={() => setPaymentMethod(pm.id)}
                    className={`flex-row items-center gap-1 px-3 py-2 rounded-xl border ${
                      paymentMethod === pm.id
                        ? 'bg-green-600 border-green-600'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <Text style={{ fontSize: 13 }}>{pm.emoji}</Text>
                    <Text className={`text-xs font-semibold ${paymentMethod === pm.id ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                      {pm.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Category */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1.5">{t('tx.category_label')}</Text>
              <TouchableOpacity
                onPress={() => { setShowCategoryPicker(v => !v); setShowPeriodPicker(false); }}
                className="flex-row items-center justify-between border-2 border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 bg-gray-50 dark:bg-gray-800"
              >
                {selectedCategory ? (
                  <View className="flex-row items-center gap-2">
                    <CategoryIcon icon={selectedCategory.icon} color={selectedCategory.color} size={16} />
                    <Text className="text-sm font-medium text-gray-900 dark:text-white ml-1">{getCategoryLabel(t, selectedCategory)}</Text>
                  </View>
                ) : (
                  <Text className="text-sm text-gray-400">{t('tx.select_category')}</Text>
                )}
                {showCategoryPicker
                  ? <ChevronUp size={16} color="#9ca3af" />
                  : <ChevronDown size={16} color="#9ca3af" />
                }
              </TouchableOpacity>

              {showCategoryPicker && (
                <View className="mt-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => {
                          setCategory(cat.id);
                          setShowCategoryPicker(false);
                          if (cat.id !== 'savings') setLinkedGoalId('');
                        }}
                        className="flex-row items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-700"
                      >
                        <CategoryIcon icon={cat.icon} color={cat.color} size={16} />
                        <Text className="flex-1 text-sm text-gray-800 dark:text-white ml-1">{getCategoryLabel(t, cat)}</Text>
                        {category === cat.id && (
                          <Text className="text-green-600 font-bold">✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                    {/* Add new category */}
                    <TouchableOpacity
                      onPress={() => { setShowCategoryPicker(false); setShowAddCategory(true); }}
                      className="flex-row items-center gap-3 px-4 py-3"
                    >
                      <View className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 items-center justify-center">
                        <Plus size={14} color="#16a34a" strokeWidth={3} />
                      </View>
                      <Text className="text-sm font-semibold text-green-600 dark:text-green-400">{t('tx.add_category')}</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Description */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1.5">
                {t('common.description')}{' '}
                <Text className="text-gray-300">({t('common.optional')})</Text>
              </Text>
              <TextInput
                placeholder={t('tx.add_note')}
                placeholderTextColor="#d1d5db"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                className="border-2 border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                style={{ minHeight: 72 }}
              />
              {/* Quick suggestion chips */}
              {suggestions.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5 mt-2">
                  {suggestions.map(label => (
                    <TouchableOpacity
                      key={label}
                      onPress={() => setDescription(label)}
                      className={`px-2.5 py-1 rounded-full border ${
                        description === label
                          ? 'bg-green-600 border-green-600'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <Text className={`text-xs font-medium ${description === label ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Savings goal selector */}
            {isSavings && (
              <View className="mb-4">
                <Text className="text-xs font-semibold mb-1.5 text-green-700 dark:text-green-400">
                  {t('tx.save_to')} <Text className="text-red-400">*</Text>
                </Text>
                {saveOptions.length === 0 ? (
                  <View className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 px-4 py-3">
                    <Text className="text-xs text-gray-400 text-center">{t('tx.no_goals')}</Text>
                  </View>
                ) : (
                  <View className="gap-1.5">
                    {saveOptions.map(opt => (
                      <TouchableOpacity
                        key={opt.id}
                        onPress={() => setLinkedGoalId(opt.id)}
                        className={`flex-row items-center gap-2 px-3 py-2.5 rounded-xl border-2 ${
                          linkedGoalId === opt.id
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-100 dark:border-gray-800'
                        }`}
                      >
                        <Text className={`flex-1 text-sm font-medium ${linkedGoalId === opt.id ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}`}>
                          {opt.name}
                        </Text>
                        {linkedGoalId === opt.id && (
                          <Text className="text-green-500 font-bold">✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Auto-debit toggle */}
            <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <RefreshCw size={16} color="#16a34a" />
                  <View>
                    <Text className="text-sm font-medium text-gray-900 dark:text-white">{t('tx.auto_debit')}</Text>
                    <Text className="text-xs text-gray-400">{t('tx.repeat')}</Text>
                  </View>
                </View>
                <Switch
                  value={isAutoDebit}
                  onValueChange={setIsAutoDebit}
                  trackColor={{ false: '#e5e7eb', true: '#16a34a' }}
                  thumbColor="#ffffff"
                />
              </View>

              {isAutoDebit && (
                <View className="mt-3">
                  <TouchableOpacity
                    onPress={() => { setShowPeriodPicker(v => !v); setShowCategoryPicker(false); }}
                    className="flex-row items-center justify-between border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-900"
                  >
                    <Text className="text-sm text-gray-800 dark:text-white">
                      {PERIODS.find(p => p.value === period)?.label}
                    </Text>
                    {showPeriodPicker
                      ? <ChevronUp size={14} color="#9ca3af" />
                      : <ChevronDown size={14} color="#9ca3af" />
                    }
                  </TouchableOpacity>

                  {showPeriodPicker && (
                    <View className="mt-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                      {PERIODS.map(p => (
                        <TouchableOpacity
                          key={p.value}
                          onPress={() => { setPeriod(p.value); setShowPeriodPicker(false); }}
                          className="flex-row items-center justify-between px-3 py-2.5 border-b border-gray-50 dark:border-gray-800"
                        >
                          <Text className="text-sm text-gray-800 dark:text-white">{p.label}</Text>
                          {period === p.value && <Text className="text-green-600 font-bold">✓</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer save button */}
          <View
            className="px-5 pt-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              className={`w-full py-4 rounded-2xl items-center ${canSubmit ? 'bg-green-600' : 'bg-green-600 opacity-40'}`}
            >
              <Text className="text-white font-bold text-base">{buttonLabel}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Transaction currency picker ── */}
      <Modal
        visible={showCurrencyPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View
            className="bg-white dark:bg-gray-900 rounded-t-3xl"
            style={{ maxHeight: '80%', paddingBottom: insets.bottom + 8 }}
          >
            {/* Handle */}
            <View className="items-center pt-3 pb-2">
              <View className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pb-3">
              <Text className="text-base font-bold text-gray-900 dark:text-white">
                {t('tx.select_tx_currency')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowCurrencyPicker(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
              >
                <X size={14} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View className="flex-row items-center gap-2 mx-4 mb-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
              <Text className="text-gray-400 text-sm">🔍</Text>
              <TextInput
                value={currencySearch}
                onChangeText={setCurrencySearch}
                placeholder={t('tx.search_currency')}
                placeholderTextColor="#9ca3af"
                className="flex-1 text-sm text-gray-900 dark:text-white"
                autoCapitalize="characters"
              />
              {currencySearch ? (
                <TouchableOpacity onPress={() => setCurrencySearch('')}>
                  <X size={13} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* List */}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* User's default currency pinned at top */}
              {!currencySearch && (
                <TouchableOpacity
                  onPress={() => { setTxCurrency(userCurrency); setShowCurrencyPicker(false); }}
                  className={`flex-row items-center justify-between px-5 py-3 border-b border-gray-50 dark:border-gray-800 ${txCurrency === userCurrency ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                >
                  <View className="flex-row items-center gap-3">
                    <Text className="text-sm font-bold text-gray-900 dark:text-white w-12">{userCurrency}</Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400 flex-shrink">{CURRENCIES.find(c => c.code === userCurrency)?.name ?? userCurrency}</Text>
                    <View className="bg-green-100 dark:bg-green-900/30 rounded-full px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-green-700 dark:text-green-400">Default</Text>
                    </View>
                  </View>
                  {txCurrency === userCurrency && <Text className="text-green-600 font-bold">✓</Text>}
                </TouchableOpacity>
              )}
              {CURRENCIES.filter(c => {
                if (!currencySearch) return c.code !== userCurrency;
                const q = currencySearch.toLowerCase();
                return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
              }).map(c => (
                <TouchableOpacity
                  key={c.code}
                  onPress={() => { setTxCurrency(c.code); setShowCurrencyPicker(false); }}
                  className={`flex-row items-center justify-between px-5 py-3 border-b border-gray-50 dark:border-gray-800 ${txCurrency === c.code ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                >
                  <View className="flex-row items-center gap-3 flex-1 mr-3">
                    <Text className="text-sm font-bold text-gray-900 dark:text-white w-12">{c.code}</Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400 flex-1" numberOfLines={1}>{c.name}</Text>
                  </View>
                  {txCurrency === c.code && <Text className="text-green-600 font-bold">✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CalendarDateModal
        visible={showDatePicker}
        value={date}
        onSelect={(nextDate) => {
          setDate(nextDate);
          setCustomDateInput(nextDate);
          setCustomDateMode(true);
        }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Receipt full-screen viewer */}
      <Modal
        visible={viewReceipt && !!prefill?.receiptImage}
        animationType="fade"
        onRequestClose={() => setViewReceipt(false)}
        transparent
      >
        <Pressable
          className="flex-1 bg-black/90 items-center justify-center p-4"
          onPress={() => setViewReceipt(false)}
        >
          {prefill?.receiptImage && (
            <Image
              source={{ uri: prefill.receiptImage }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            onPress={() => setViewReceipt(false)}
            className="absolute top-12 right-6 w-10 h-10 rounded-full bg-white/10 items-center justify-center"
          >
            <X size={20} color="#ffffff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {/* Quick add category */}
      {showAddCategory && (
        <QuickAddCategorySheet
          visible={showAddCategory}
          defaultType={type}
          onSave={handleNewCategoryCreated}
          onClose={() => setShowAddCategory(false)}
        />
      )}
    </>
  );
}
