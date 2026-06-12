import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTourTarget } from '../../context/TourContext';
import { isPinEnabled, removePin, removeSecurityQuestion, removeBiometricPref } from '../../utils/pin';
import PinSetupModal from '../../components/PinSetupModal';
import PinEntryModal from '../../components/PinEntryModal';
import TourHighlight from '../../components/TourHighlight';
import CategoryManagerSheet from '../../components/CategoryManagerSheet';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  Image,
  Linking,
  Share,
  InteractionManager,
  Platform,
} from 'react-native';

const happyMascotImg = require('../../assets/m_expression_happy.png');
const winkMascotImg  = require('../../assets/m_expression_wink.png');
const sadMascotImg   = require('../../assets/m_expression_sad.png');
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Moon,
  Sun,
  Camera,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  FileText,
  LogOut,
  Trash2,
  UserX,
  Edit3,
  TrendingUp,
  TrendingDown,
  X,
  Tag,
  Globe,
  Star,
  RotateCcw,
  Settings,
  Zap,
  Trophy,
  Bell,
  Link,
  Download,
  Lock,
  BarChart2,
  User,
  Check,
  ExternalLink,
  Mail,
  Share2,
} from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../context/LanguageContext';
import { usePurchases } from '../../context/PurchasesContext';
import SubscriptionSheet from '../../components/SubscriptionSheet';
import {
  CURRENCIES,
  LANGUAGES,
} from '../../types';
import { getCurrencyDisplayName } from '../../utils/currency';
import type { Transaction } from '../../types';
import { computeBadges, computeStreaks, BADGES, BadgeDef } from '../../utils/achievements';
import {
  NotifPrefs,
  DEFAULT_PREFS,
  loadNotifPrefs,
  saveNotifPrefs,
  syncNotificationSettings,
  sendLanguagePreviewNotification,
  getTranslationFunction,
  schedulePaymentReminderNotifications,
} from '../../utils/notifications';
import BadgeCelebration from '../../components/BadgeCelebration';
import StatusCelebration from '../../components/StatusCelebration';

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, onPress }: { score: number; onPress?: () => void }) {
  const { t, language } = useTranslation();
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const SIZE = 120;
  const BORDER = 10;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      className="items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
    >
      <View
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          borderWidth: BORDER,
          borderColor: '#e5e7eb',
          position: 'absolute',
        }}
      />
      <View
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          borderWidth: BORDER,
          borderColor: color,
          position: 'absolute',
          opacity: 0.25 + (score / 100) * 0.75,
        }}
      />
      <View className="items-center">
        <Text className="font-black text-3xl" style={{ color }}>{score}</Text>
        <Text className="text-gray-400 text-[10px] font-semibold uppercase tracking-widest">
          {t('profile.score')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Settings Row ─────────────────────────────────────────────────────────────
interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}
function SettingsRow({ icon, label, value, onPress, danger, right }: SettingsRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3.5 active:bg-gray-50"
      activeOpacity={0.7}
    >
      <View
        className={`w-9 h-9 rounded-2xl items-center justify-center ${
          danger ? 'bg-red-50' : 'bg-gray-100 dark:bg-gray-800'
        }`}
      >
        {icon}
      </View>
      <Text className={`flex-1 text-sm font-medium ${danger ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
        {label}
      </Text>
      {value ? <Text className="text-xs text-gray-400 dark:text-gray-500 mr-1">{value}</Text> : null}
      {right ?? (!danger ? <ChevronRight size={14} color="#d1d5db" /> : null)}
    </TouchableOpacity>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="bg-gray-50 dark:bg-gray-900 rounded-2xl overflow-hidden mb-2">
      <TouchableOpacity
        onPress={() => setOpen(v => !v)}
        className="flex-row items-center px-4 py-3.5"
        activeOpacity={0.7}
      >
        <Text className="flex-1 text-sm font-medium text-gray-900 dark:text-white pr-3">{q}</Text>
        <ChevronDown
          size={16}
          color="#9ca3af"
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>
      {open ? (
        <View className="px-4 pb-4">
          <Text className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{a}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Legal Sheet ──────────────────────────────────────────────────────────────
function LegalSheet({ type, onClose }: { type: 'terms' | 'privacy'; onClose: () => void }) {
  const { t } = useTranslation();
  const sections =
    type === 'terms'
      ? [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({
          title: t(`terms.t${n}` as any),
          body: t(`terms.b${n}` as any),
        }))
      : [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({
          title: t(`privacy.t${n}` as any),
          body: t(`privacy.b${n}` as any),
        }));

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <View>
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {type === 'terms' ? t('profile.terms') : t('profile.privacy')}
            </Text>
            {type === 'privacy' && (
              <TouchableOpacity
                onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://kachingo.app/privacy')}
                className="flex-row items-center gap-1 mt-0.5"
                activeOpacity={0.7}
              >
                <Text className="text-xs text-green-600 dark:text-green-400">View Online</Text>
                <ExternalLink size={10} color="#16a34a" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
          >
            <X size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-5 py-4">
          <Text className="text-xs text-gray-400 mb-4">{t('legal.last_updated')}</Text>
          {sections.map((s, i) => (
            <View key={i} className="mb-5">
              <Text className="text-sm font-bold text-gray-900 dark:text-white mb-1.5">{s.title}</Text>
              <Text className="text-sm text-gray-600 leading-relaxed">{s.body}</Text>
            </View>
          ))}
        </ScrollView>
        <View className="px-5 pb-6 pt-3 border-t border-gray-100 dark:border-gray-800">
          <TouchableOpacity
            onPress={onClose}
            className="w-full py-3.5 rounded-2xl bg-green-600 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold">{t('legal.i_understand')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Notifications Sheet ──────────────────────────────────────────────────────
function NotificationsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { transactions } = useApp();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotifPrefs().then(p => {
      setPrefs(p);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveNotifPrefs(prefs);
      await schedulePaymentReminderNotifications(transactions, prefs);
      Alert.alert('', t('notif.saved'), [{ text: t('common.ok'), onPress: onClose }]);
    } finally {
      setSaving(false);
    }
  }

  const TOGGLES: Array<{ key: keyof NotifPrefs; icon: string; title: string; desc: string }> = [
    {
      key: 'weeklySummary',
      icon: '📊',
      title: t('notif.weekly_summary'),
      desc: t('notif.weekly_summary_desc'),
    },
    {
      key: 'budgetAlerts',
      icon: '🔔',
      title: t('notif.budget_alerts'),
      desc: t('notif.budget_alerts_desc'),
    },
    {
      key: 'streakReminders',
      icon: '🔥',
      title: t('notif.streak_reminders'),
      desc: t('notif.streak_reminders_desc'),
    },
    {
      key: 'tips',
      icon: '💡',
      title: t('notif.tips'),
      desc: t('notif.tips_desc'),
    },
    {
      key: 'paymentReminders',
      icon: '💳',
      title: t('notif.payment_reminders'),
      desc: t('notif.payment_reminders_desc'),
    },
  ];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <Text className="text-lg font-bold text-gray-900 dark:text-white">{t('notif.title')}</Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
          >
            <X size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#16a34a" />
          </View>
        ) : (
          <ScrollView className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-gray-400 px-5 pt-4 pb-2">{t('notif.desc')}</Text>
            <View className="mx-4 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-sm">
              {TOGGLES.map(({ key, icon, title, desc }, i) => (
                <View
                  key={key}
                  className={`flex-row items-center gap-3 px-4 py-4 ${
                    i < TOGGLES.length - 1 ? 'border-b border-gray-50 dark:border-gray-900' : ''
                  }`}
                >
                  <Text style={{ fontSize: 22, width: 28 }}>{icon}</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-white">{title}</Text>
                    <Text className="text-xs text-gray-400 mt-0.5">{desc}</Text>
                  </View>
                  <Switch
                    value={prefs[key]}
                    onValueChange={v => setPrefs(p => ({ ...p, [key]: v }))}
                    trackColor={{ false: '#e5e7eb', true: '#16a34a' }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </View>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="mx-4 mt-6 mb-8 py-4 rounded-2xl bg-green-600 items-center"
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-bold">{t('notif.save')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Budget Streak Card ───────────────────────────────────────────────────────
function BudgetStreakCard({ transactions }: { transactions: Transaction[] }) {
  const { t } = useTranslation();
  const { current, best } = computeStreaks(transactions);

  const now = new Date();
  const dots = Array.from({ length: 12 }, (_, i) => {
    const monthOffset = 12 - i; // 12 = oldest, 1 = last month
    if (monthOffset === 0) return 'current';
    const d = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const txs = transactions.filter(tx => {
      const td = new Date(tx.date);
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
    });
    if (!txs.length) return 'empty';
    const income = txs.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
    const expenses = txs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
    return income > 0 && expenses < income ? 'good' : 'bad';
  });

  return (
    <View className="mb-2 rounded-2xl p-4" style={{ backgroundColor: '#052e16' }}>
      <Text className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3">
        {t('profile.budget_streak')}
      </Text>
      <View className="flex-row gap-1.5 mb-4 flex-wrap">
        {dots.map((dot, i) => (
          <View
            key={i}
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor:
                dot === 'good'
                  ? '#4ade80'
                  : dot === 'bad'
                  ? '#7f1d1d'
                  : '#166534',
              borderWidth: dot === 'current' ? 0 : 0,
            }}
          />
        ))}
      </View>
      <View className="flex-row gap-6 items-center">
        <View>
          <Text className="text-3xl font-black text-white">{current}</Text>
          <Text className="text-[11px] text-green-400/70 mt-0.5">{t('streak.current')}</Text>
        </View>
        <View className="w-px h-10 bg-green-900" />
        <View>
          <Text className="text-3xl font-black text-white">{best}</Text>
          <Text className="text-[11px] text-green-400/70 mt-0.5">{t('streak.best')}</Text>
        </View>
        {current > 0 && (
          <View className="ml-auto">
            <Text className="text-green-400 text-xs font-semibold">{t('streak.keep_going')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mx-4 mb-2 mt-1">
      {label}
    </Text>
  );
}

// ─── Main Profile Screen ──────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
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
  const {
    transactions,
    budget,
    userProfile,
    darkMode,
    toggleDarkMode,
    updateUserProfile,
    getCurrencySymbol,
    formatCurrency,
    signOut,
    deleteAccount,
  } = useApp();
  const { isPro } = usePurchases();

  // ── Defensive defaults: guard against async load gap on first launch ────────
  const safeLanguage = language ?? 'en';
  const safeCurrency = userProfile?.currency ?? 'USD';
  const safeProfile = userProfile ?? { name: 'User', email: '', avatar: null, plan: 'free', currency: 'USD', language: 'en' };

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const FileSystem = await import('expo-file-system/legacy');
        const dest = (FileSystem.documentDirectory ?? '') + 'kachingo_avatar.jpg';
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: dest });
        updateUserProfile({ avatar: dest });
      } catch {
        updateUserProfile({ avatar: result.assets[0].uri });
      }
    }
  }

  const FAQ_ITEMS = [
    { q: t('faq.q1'), a: t('faq.a1') },
    { q: t('faq.q2'), a: t('faq.a2') },
    { q: t('faq.q3'), a: t('faq.a3') },
    { q: t('faq.q4'), a: t('faq.a4') },
    { q: t('faq.q5'), a: t('faq.a5') },
    { q: t('faq.q6'), a: t('faq.a6') },
    { q: t('faq.q7'), a: t('faq.a7') },
    { q: t('faq.q8'), a: t('faq.a8') },
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userProfile?.name ?? '');
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [celebrationBadge, setCelebrationBadge] = useState<BadgeDef | null>(null);
  const [showStatusCelebration, setShowStatusCelebration] = useState(false);
  const [seenBadgeIds, setSeenBadgeIds] = useState<Set<string>>(new Set());
  const [seenBadgesLoaded, setSeenBadgesLoaded] = useState(false);

  // Re-trigger measurement when this tab gains focus after a cross-tab navigation.
  const streakActive     = useTourTarget('profile-streak',     { scrollRef, scrollY: 120 });
  const assessmentActive = useTourTarget('profile-assessment', { scrollRef, scrollY: 780 });

  // ── Financial score ────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const yearTxs = useMemo(() => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return transactions.filter(tx => {
      const d = new Date(tx.date);
      return d.getFullYear() === currentYear && d <= todayEnd;
    });
  }, [transactions, currentYear]);
  const yearIncome = yearTxs
    .filter(tx => tx.type === 'income')
    .reduce((s, tx) => s + tx.amount, 0);
  const yearExpenses = yearTxs
    .filter(tx => tx.type === 'expense')
    .reduce((s, tx) => s + tx.amount, 0);
  const monthsWithData = Math.max(
    new Set(
      yearTxs.map(tx => {
        const d = new Date(tx.date);
        return `${d.getFullYear()}-${d.getMonth()}`;
      }),
    ).size,
    1,
  );
  const avgIncome = yearIncome / monthsWithData;
  const avgExpenses = yearExpenses / monthsWithData;

  // Multi-factor score (0–100):
  // 1. Expense ratio: 0–60 pts — 60 at ≤50% spending, 0 at ≥100%
  // 2. Budget adherence: 0–25 pts (12 neutral when no budget set)
  // 3. Tracking completeness: 0–15 pts
  let expRatioScore = 0;
  if (yearIncome > 0) {
    const ratio = yearExpenses / yearIncome;
    expRatioScore = Math.max(0, Math.round(60 * (1 - Math.max(0, ratio - 0.5) / 0.5)));
  }
  let budgetScore = 12;
  if (budget.expectedIncome > 0) {
    const monthlyExpAvg = yearExpenses / monthsWithData;
    const savingsReserve = budget.savingsGoal?.enabled ? (budget.savingsGoal.amount ?? 0) : 0;
    const targetExp = Math.max(0, budget.expectedIncome - savingsReserve);
    budgetScore = monthlyExpAvg <= targetExp ? 25
      : monthlyExpAvg <= targetExp * 1.15 ? 15
      : monthlyExpAvg <= targetExp * 1.30 ? 7 : 0;
  }
  const trackingScore = yearIncome > 0 && yearExpenses > 0 ? 15
    : (yearIncome > 0 || yearExpenses > 0) ? 7 : 0;
  const score = Math.min(100, Math.max(0, expRatioScore + budgetScore + trackingScore));
  const earnedBadgeIds = useMemo(
    () => new Set(computeBadges(transactions, budget).map(b => b.id)),
    [transactions, budget],
  );

  useEffect(() => {
    AsyncStorage.getItem('kachingo_seen_badges').then(raw => {
      if (raw) setSeenBadgeIds(new Set(JSON.parse(raw)));
      setSeenBadgesLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!seenBadgesLoaded) return;
    const unseen = [...earnedBadgeIds].filter(id => !seenBadgeIds.has(id));
    if (unseen.length === 0) return;
    const badge = BADGES.find(b => b.id === unseen[unseen.length - 1]);
    if (badge) setCelebrationBadge(badge);
  }, [earnedBadgeIds, seenBadgeIds, seenBadgesLoaded]);

  const scoreLabel =
    score >= 80
      ? t('profile.excellent_health')
      : score >= 60
      ? t('profile.fair_health')
      : t('profile.needs_improvement');

  // ── Handlers ───────────────────────────────────────────────────────────────
  function confirmSignOut() {
    setShowSignOutModal(true);
  }

  function confirmClearData() {
    setShowClearDataModal(true);
  }

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [showClearedDoneModal, setShowClearedDoneModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // PIN lock
  const [pinEnabled, setPinEnabled] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinVerify, setShowPinVerify] = useState(false);

  // Export CSV date filter
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRange, setExportRange] = useState<'all' | 'this_month' | 'last_month' | 'last_week'>('all');

  useEffect(() => {
    isPinEnabled().then(setPinEnabled);
  }, []);

  async function handlePinToggle() {
    if (pinEnabled) {
      setShowPinVerify(true);
    } else {
      setShowPinSetup(true);
    }
  }

  async function handlePinVerified() {
    setShowPinVerify(false);
    await removePin();
    await removeSecurityQuestion();
    await removeBiometricPref();
    setPinEnabled(false);
  }

  async function doClearData() {
    const AsyncStorageLib = require('@react-native-async-storage/async-storage').default;
    await AsyncStorageLib.clear();
    setShowClearDataModal(false);
    setShowClearedDoneModal(true);
  }

  function doSignOut() {
    setShowSignOutModal(false);
    signOut();
  }

  function confirmDeleteAccount() {
    setShowDeleteAccountModal(true);
  }

  async function doDeleteAccount() {
    setIsDeletingAccount(true);
    try {
      await deleteAccount();
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteAccountModal(false);
    }
  }

  async function handleGenerateReport() {
    const { current, best } = computeStreaks(transactions);
    const scoreLabel2 = score >= 80 ? t('profile.score_excellent') : score >= 60 ? t('profile.score_fair') : t('profile.score_needs_imp');
    const scoreColor = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    const rTitle = t('profile.report_title');
    const rHealthScore = t('profile.financial_health_score');
    const rThisYear = t('profile.this_year');
    const rIncome = t('common.income');
    const rExpenses = t('common.expenses');
    const rNetBalance = t('profile.net_balance');
    const rSavingsRate = t('profile.savings_rate');
    const rBudgetStreak = t('profile.budget_streak');
    const rCurrentStreak = t('profile.current_streak');
    const rBestStreak = t('profile.best_streak');
    const rGeneratedWith = t('profile.generated_with');
    const rMonths = t('common.months');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,Arial,sans-serif;margin:0;padding:40px;color:#111827;background:#fff}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #f3f4f6}
  h1{color:#166534;font-size:22px;margin:0}
  .date{color:#9ca3af;font-size:12px;margin-top:4px}
  .score-row{display:flex;align-items:center;gap:16px;background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px}
  .score-circle{width:80px;height:80px;border-radius:50%;border:6px solid ${scoreColor};display:flex;align-items:center;justify-content:center;flex-direction:column;flex-shrink:0}
  .score-num{font-size:24px;font-weight:800;color:${scoreColor};line-height:1}
  .score-denom{font-size:11px;color:#9ca3af}
  .score-label{font-size:18px;font-weight:700;color:${scoreColor}}
  .score-sub{font-size:13px;color:#6b7280;margin-top:4px}
  h2{color:#374151;font-size:14px;font-weight:700;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.05em}
  table{width:100%;border-collapse:collapse}
  td{padding:10px 6px;border-bottom:1px solid #f3f4f6;font-size:14px}
  .label{color:#6b7280}.value{font-weight:600;text-align:right}
  .positive{color:#16a34a}.negative{color:#dc2626}
  footer{margin-top:40px;color:#9ca3af;font-size:11px;text-align:center;border-top:1px solid #f3f4f6;padding-top:16px}
</style></head><body>
<div class="header">
  <div><h1>📊 ${rTitle}</h1><div class="date">${dateStr}</div></div>
</div>
<div class="score-row">
  <div class="score-circle"><span class="score-num">${score}</span><span class="score-denom">/100</span></div>
  <div><div class="score-label">${scoreLabel2}</div><div class="score-sub">${rHealthScore}</div></div>
</div>
<h2>${rThisYear}</h2>
<table>
  <tr><td class="label">${rIncome}</td><td class="value positive">${formatCurrency(yearIncome)}</td></tr>
  <tr><td class="label">${rExpenses}</td><td class="value">${formatCurrency(yearExpenses)}</td></tr>
  <tr><td class="label">${rNetBalance}</td><td class="value ${yearIncome - yearExpenses >= 0 ? 'positive' : 'negative'}">${formatCurrency(yearIncome - yearExpenses)}</td></tr>
  <tr><td class="label">${rSavingsRate}</td><td class="value">${yearIncome > 0 ? Math.round((1 - yearExpenses / yearIncome) * 100) : 0}%</td></tr>
</table>
<h2>${rBudgetStreak}</h2>
<table>
  <tr><td class="label">${rCurrentStreak}</td><td class="value">${current} ${rMonths}</td></tr>
  <tr><td class="label">${rBestStreak}</td><td class="value">${best} ${rMonths}</td></tr>
</table>
<footer>${rGeneratedWith} · ${dateStr}</footer>
</body></html>`;

    try {
      const Print = await import('expo-print');
      const Sharing = await import('expo-sharing');
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('profile.generate_report') });
    } catch {
      Alert.alert(`📊 ${rTitle}`, `Score: ${score}/100 (${scoreLabel2})\n${rIncome}: ${formatCurrency(yearIncome)}\n${rExpenses}: ${formatCurrency(yearExpenses)}`);
    }
  }

  function getExportDateBounds(range: typeof exportRange): { from: Date; to: Date } | null {
    const now = new Date();
    if (range === 'this_month') {
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
      };
    }
    if (range === 'last_month') {
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      };
    }
    if (range === 'last_week') {
      const day = now.getDay();
      const from = new Date(now);
      from.setDate(now.getDate() - day - 7);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    return null;
  }

  async function doExportCSV() {
    setShowExportModal(false);
    const bounds = getExportDateBounds(exportRange);
    const filtered = bounds
      ? transactions.filter(tx => {
          const d = new Date(tx.date);
          return d >= bounds.from && d <= bounds.to;
        })
      : transactions;
    const header = 'Date,Type,Category,Amount,Description,PaymentMethod';
    const rows = filtered.map(tx => {
      const d = new Date(tx.date).toISOString().slice(0, 10);
      const desc = (tx.description || '').replace(/,/g, ';');
      return `${d},${tx.type},${tx.category},${tx.amount},${desc},${tx.paymentMethod ?? ''}`;
    });
    const csv = [header, ...rows].join('\n');
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const Sharing = await import('expo-sharing');
      const path = FileSystem.cacheDirectory + 'ledgr_transactions.csv';
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: t('export.title') });
    } catch {
      Alert.alert(t('export.title'), t('export.n_transactions', { n: rows.length }));
    }
  }

  function handleExportCSV() {
    setShowExportModal(true);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView key={_layoutCycle} className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >

        {/* ── Header ── */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">{t('profile.title')}</Text>
          <TouchableOpacity
            onPress={toggleDarkMode}
            className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 items-center justify-center shadow-sm"
          >
            {darkMode ? (
              <Sun size={18} color="#fbbf24" />
            ) : (
              <Moon size={18} color="#6b7280" />
            )}
          </TouchableOpacity>
        </View>

        {/* ── Avatar + Name ── */}
        <View className="items-center gap-2 pb-5">
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={{ position: 'relative' }}>
            {safeProfile.avatar ? (
              <Image
                source={{ uri: safeProfile.avatar }}
                style={{ width: 96, height: 96, borderRadius: 48 }}
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-green-600 items-center justify-center">
                <Text className="text-white font-black text-3xl">
                  {(safeProfile.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: darkMode ? '#111827' : '#f9fafb' }}>
              <Camera size={14} color="#fff" />
            </View>
          </TouchableOpacity>

          {editingName ? (
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              onBlur={() => {
                updateUserProfile({ name: nameInput });
                setEditingName(false);
              }}
              onSubmitEditing={() => {
                updateUserProfile({ name: nameInput });
                setEditingName(false);
              }}
              autoFocus
              className="border-b-2 border-green-600 text-center font-bold text-lg text-gray-900 w-48 pb-1"
            />
          ) : (
            <TouchableOpacity
              onPress={() => setEditingName(true)}
              className="flex-row items-center gap-1.5"
            >
              <Text className="text-lg font-bold text-gray-900 dark:text-white">{safeProfile.name}</Text>
              <Edit3 size={14} color="#9ca3af" />
            </TouchableOpacity>
          )}

          <Text className="text-xs text-gray-500">{safeProfile.email}</Text>

          {/* Plan pill */}
          {isPro ? (
            <View className="px-3 py-1 rounded-full bg-green-100 flex-row items-center gap-1">
              <Star size={10} color="#16a34a" fill="#16a34a" />
              <Text className="text-xs font-semibold text-green-700">Pro</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowSubscription(true)}
              className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 flex-row items-center gap-1.5"
            >
              <Zap size={10} color="#d97706" />
              <Text className="text-xs font-semibold text-amber-700">
                {t('profile.upgrade_banner')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── ACHIEVEMENTS ── */}
        <SectionHeader label={t('profile.achievements')} />

        {/* Budget Streak */}
        <TourHighlight active={streakActive} style={{ marginHorizontal: 16 }} borderRadius={16}>
          <BudgetStreakCard transactions={transactions} />

        {/* Badges */}
        <View className="mx-4 bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-gray-800 mb-2">
          <View className="flex-row flex-wrap gap-2">
            {BADGES.slice(0, 9).map(badge => {
              const earned = earnedBadgeIds.has(badge.id);
              return (
                <View
                  key={badge.id}
                  className={`items-center rounded-2xl py-3 px-2 ${
                    earned ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800'
                  }`}
                  style={{ width: '30.5%' }}
                >
                  <Text style={{ fontSize: 22, opacity: earned ? 1 : 0.25 }}>{badge.icon}</Text>
                  <Text
                    className={`text-[10px] font-bold text-center mt-1 ${
                      earned ? 'text-green-700 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                    }`}
                    numberOfLines={2}
                  >
                    {t(`badge.${badge.id}.label` as any)}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-3">
            {earnedBadgeIds.size}/{BADGES.length} {t('achieve.unlocked')}
          </Text>
        </View></TourHighlight>

        {/* Achievements link */}
        <TouchableOpacity
          onPress={() => router.push('/achievements' as any)}
          className="mx-4 mb-3 flex-row items-center justify-between bg-white dark:bg-gray-900 rounded-2xl px-4 py-3.5 shadow-sm border border-gray-50 dark:border-gray-800"
          activeOpacity={0.7}
        >
          <View className="flex-row items-center gap-2.5">
            <View className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/20 items-center justify-center">
              <Trophy size={15} color="#d97706" />
            </View>
            <Text className="text-sm font-semibold text-gray-900 dark:text-white">{t('profile.see_achievements')}</Text>
          </View>
          <ChevronRight size={14} color="#d1d5db" />
        </TouchableOpacity>

        {/* Share Kachingo */}
        <TouchableOpacity
          onPress={() => {
            const url = process.env.EXPO_PUBLIC_APP_STORE_URL ?? 'https://kachingo.app';
            Share.share({ message: `I've been tracking my finances with Kachingo — check it out: ${url}` });
          }}
          className="mx-4 mb-5 flex-row items-center justify-between bg-white dark:bg-gray-900 rounded-2xl px-4 py-3.5 shadow-sm border border-gray-50 dark:border-gray-800"
          activeOpacity={0.7}
        >
          <View className="flex-row items-center gap-2.5">
            <View className="w-8 h-8 rounded-xl bg-green-50 dark:bg-green-900/20 items-center justify-center">
              <Share2 size={15} color="#16a34a" />
            </View>
            <Text className="text-sm font-semibold text-gray-900 dark:text-white">{t('profile.share_app')}</Text>
          </View>
          <ChevronRight size={14} color="#d1d5db" />
        </TouchableOpacity>

        {/* ── FINANCIAL ASSESSMENT ── */}
        <SectionHeader label={t('profile.assessment')} />
        <TourHighlight active={assessmentActive} style={{ marginHorizontal: 16, marginBottom: 20 }} borderRadius={16}><View>
          {/* Income / Expense year cards */}
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1 bg-green-50 rounded-2xl p-4 border border-green-100">
              <View className="flex-row items-center gap-1.5 mb-2">
                <TrendingUp size={14} color="#16a34a" />
                <Text className="text-[11px] text-green-600 font-semibold uppercase tracking-wide">
                  {t('profile.income_year')}
                </Text>
              </View>
              <Text className="text-xl font-black text-green-700">
                {formatCurrency(yearIncome)}
              </Text>
              <Text className="text-[11px] text-green-600/70 mt-0.5">{t('profile.this_year')}</Text>
              <Text className="text-[11px] text-green-600 mt-1 font-medium">
                {t('profile.avg_income', { amount: formatCurrency(avgIncome) })}
              </Text>
            </View>
            <View className="flex-1 bg-red-50 rounded-2xl p-4 border border-red-100">
              <View className="flex-row items-center gap-1.5 mb-2">
                <TrendingDown size={14} color="#ef4444" />
                <Text className="text-[11px] text-red-500 font-semibold uppercase tracking-wide">
                  {t('profile.expenses_year')}
                </Text>
              </View>
              <Text className="text-xl font-black text-red-600">
                {formatCurrency(yearExpenses)}
              </Text>
              <Text className="text-[11px] text-red-500/70 mt-0.5">{t('profile.this_year')}</Text>
              <Text className="text-[11px] text-red-500 mt-1 font-medium">
                {t('profile.avg_income', { amount: formatCurrency(avgExpenses) })}
              </Text>
            </View>
          </View>

          {/* Score ring */}
          <View className="bg-white dark:bg-gray-900 rounded-2xl p-5 items-center gap-3 shadow-sm border border-gray-800 mb-3">
            <Image
              source={score >= 80 ? happyMascotImg : score >= 60 ? winkMascotImg : sadMascotImg}
              style={{ width: 72, height: 72 }}
              resizeMode="contain"
            />
            <ScoreRing score={score} onPress={() => setShowStatusCelebration(true)} />
            <View className="items-center">
              <Text className="font-bold text-base text-gray-900 dark:text-white">{scoreLabel}</Text>
              <Text className="text-xs text-gray-400 mt-1 text-center">
                {score >= 80
                  ? t('profile.saving_healthy')
                  : score >= 60
                  ? t('profile.managing_well')
                  : t('profile.expenses_high')}
              </Text>
            </View>
            <View className="flex-row gap-4 justify-center">
              {[
                { color: '#22c55e', range: '80–100', label: t('profile.assessment_excellent') },
                { color: '#eab308', range: '60–79', label: t('profile.assessment_fair') },
                { color: '#ef4444', range: '0–59', label: t('profile.assessment_critical') },
              ].map(b => (
                <View key={b.label} className="items-center">
                  <View className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: b.color }} />
                  <Text className="text-[10px] text-gray-400">{b.range}</Text>
                  <Text className="text-[10px] font-medium" style={{ color: b.color }}>
                    {b.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Generate Report button */}
          <TouchableOpacity
            onPress={handleGenerateReport}
            className="rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
            style={{ backgroundColor: '#111827' }}
            activeOpacity={0.8}
          >
            <BarChart2 size={16} color="#fff" />
            <Text className="text-white font-bold text-sm">{t('profile.generate_report')}</Text>
          </TouchableOpacity>
        </View></TourHighlight>

        {/* ── ACCOUNT ── */}
        <SectionHeader label={t('profile.account')} />
        <View className="mx-4 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-800 mb-5">
          <SettingsRow
            icon={<Link size={16} color="#6b7280" />}
            label={t('profile.linked_account')}
            onPress={() => router.push('/linked-account' as any)}
          />
          <SettingsRow
            icon={<Star size={16} color="#6b7280" />}
            label={t('profile.subscription_plan')}
            value={isPro ? 'Pro' : t('profile.free_trial')}
            onPress={() => setShowSubscription(true)}
          />
        </View>

        {/* ── PREFERENCES ── */}
        <SectionHeader label={t('profile.preferences')} />
        <View className="mx-4 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-800 mb-5">
          <SettingsRow
            icon={<Tag size={16} color="#6b7280" />}
            label={t('profile.categories')}
            onPress={() => setShowCategories(true)}
          />
          <SettingsRow
            icon={<Bell size={16} color="#6b7280" />}
            label={t('profile.notifications')}
            onPress={() => setShowNotifications(true)}
          />
          {/* Dark Mode */}
          <View className="flex-row items-center gap-3 px-4 py-3.5 border-t border-gray-50 dark:border-gray-900">
            <View className="w-9 h-9 rounded-2xl bg-gray-100 dark:bg-gray-800 items-center justify-center">
              {darkMode ? (
                <Moon size={16} color="#60a5fa" />
              ) : (
                <Sun size={16} color="#f59e0b" />
              )}
            </View>
            <Text className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{t('profile.dark_mode')}</Text>
            <Switch
              value={darkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: '#e5e7eb', true: '#16a34a' }}
              thumbColor="#fff"
            />
          </View>
          <SettingsRow
            icon={<Globe size={16} color="#6b7280" />}
            label={t('profile.currency')}
            value={`${safeCurrency} · ${getCurrencySymbol()}`}
            onPress={() => setShowCurrency(true)}
          />
          <SettingsRow
            icon={<Text style={{ fontSize: 16 }}>🌐</Text>}
            label={t('profile.language')}
            value={
              (LANGUAGES ?? []).find(l => l.code === (safeProfile.language ?? 'en'))?.nativeLabel ??
              'English'
            }
            onPress={() => setShowLanguage(true)}
          />
          <View className="flex-row items-center gap-3 px-4 py-3.5 border-t border-gray-50 dark:border-gray-900">
            <View className="w-9 h-9 rounded-2xl bg-gray-100 dark:bg-gray-800 items-center justify-center">
              <Lock size={16} color="#6b7280" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-900 dark:text-white">{t('pin.lock_title')}</Text>
              {pinEnabled && (
                <TouchableOpacity onPress={() => setShowPinSetup(true)}>
                  <Text className="text-xs text-green-600 mt-0.5">{t('pin.lock_desc')} · Change PIN →</Text>
                </TouchableOpacity>
              )}
            </View>
            <Switch
              value={pinEnabled}
              onValueChange={handlePinToggle}
              trackColor={{ false: '#e5e7eb', true: '#16a34a' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── DATA ── */}
        <SectionHeader label={t('profile.data')} />
        <View className="mx-4 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-800 mb-5">
          <SettingsRow
            icon={<Download size={16} color="#6b7280" />}
            label={t('profile.export_csv')}
            onPress={handleExportCSV}
          />
        </View>

        {/* ── LEGAL & SUPPORT ── */}
        <SectionHeader label={t('profile.legal')} />
        <View className="mx-4 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-800 mb-5">
          <SettingsRow
            icon={<FileText size={16} color="#6b7280" />}
            label={t('profile.terms')}
            onPress={() => setShowTerms(true)}
          />
          <SettingsRow
            icon={<FileText size={16} color="#6b7280" />}
            label={t('profile.privacy')}
            onPress={() => setShowPrivacy(true)}
          />
          <SettingsRow
            icon={<HelpCircle size={16} color="#6b7280" />}
            label={t('profile.help_faq')}
            onPress={() => setShowFAQ(true)}
          />
          <SettingsRow
            icon={<Mail size={16} color="#6b7280" />}
            label={t('profile.contact_support')}
            onPress={() => {
              const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@kachingo.app';
              Linking.openURL(`mailto:${email}?subject=Kachingo Support`);
            }}
          />
        </View>

        {/* FAQ inline */}
        {showFAQ ? (
          <View className="mx-4 bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-50 mb-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-bold text-gray-900 dark:text-white">{t('faq.title')}</Text>
              <TouchableOpacity onPress={() => setShowFAQ(false)}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            {FAQ_ITEMS.map((item, i) => (
              <FAQItem key={i} q={item.q} a={item.a} />
            ))}
          </View>
        ) : null}

        {/* ── Danger zone ── */}
        <View className="mx-4 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-50 mb-4">
          <SettingsRow
            icon={<Trash2 size={16} color="#ef4444" />}
            label={t('profile.clear_data')}
            danger
            onPress={confirmClearData}
          />
          <SettingsRow
            icon={<UserX size={16} color="#ef4444" />}
            label={t('profile.delete_account')}
            danger
            onPress={confirmDeleteAccount}
          />
          <SettingsRow
            icon={<LogOut size={16} color="#ef4444" />}
            label={t('profile.sign_out')}
            danger
            onPress={confirmSignOut}
          />
        </View>

        {/* Sign out modal */}
        <Modal visible={showSignOutModal} transparent animationType="fade" onRequestClose={() => setShowSignOutModal(false)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ width: '86%', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8 }}>{t('profile.sign_out')}</Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 14 }}>{t('profile.sign_out_confirm')}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <TouchableOpacity onPress={() => setShowSignOutModal(false)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                  <Text style={{ color: '#6b7280' }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={doSignOut} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                  <Text style={{ color: '#ef4444', fontWeight: '700' }}>{t('profile.sign_out')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Clear data modal */}
        <Modal visible={showClearDataModal} transparent animationType="fade" onRequestClose={() => setShowClearDataModal(false)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ width: '86%', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8 }}>{t('profile.clear_data')}</Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 14 }}>{t('profile.clear_confirm')}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <TouchableOpacity onPress={() => setShowClearDataModal(false)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                  <Text style={{ color: '#6b7280' }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={doClearData} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                  <Text style={{ color: '#ef4444', fontWeight: '700' }}>{t('profile.clear_data')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Cleared done modal */}
        <Modal visible={showClearedDoneModal} transparent animationType="fade" onRequestClose={() => setShowClearedDoneModal(false)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ width: '86%', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8 }}>{t('common.done')}</Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 14 }}>{t('profile.data_cleared_msg')}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity onPress={() => setShowClearedDoneModal(false)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                  <Text style={{ color: '#6b7280' }}>{t('common.ok')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete account modal */}
        <Modal visible={showDeleteAccountModal} transparent animationType="fade" onRequestClose={() => !isDeletingAccount && setShowDeleteAccountModal(false)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ width: '86%', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#ef4444', marginBottom: 8 }}>{t('profile.delete_account')}</Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 14 }}>{t('profile.delete_account_confirm')}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setShowDeleteAccountModal(false)}
                  disabled={isDeletingAccount}
                  style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}
                >
                  <Text style={{ color: '#6b7280' }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={doDeleteAccount}
                  disabled={isDeletingAccount}
                  style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#fef2f2' }}
                >
                  {isDeletingAccount
                    ? <ActivityIndicator size="small" color="#ef4444" />
                    : <Text style={{ color: '#ef4444', fontWeight: '700' }}>{t('profile.delete_account')}</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Text className="text-center text-[11px] text-gray-300 pb-8">{t('misc.version')} 1.0.0</Text>

        {/* ── Currency picker ── */}
        <Modal
          visible={showCurrency}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCurrency(false)}
        >
          <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">{t('profile.select_currency')}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCurrency(false);
                  setCurrencySearch('');
                }}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
              >
                <X size={16} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View className="flex-row items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl mx-4 my-3 px-3 py-2.5">
              <Text className="text-gray-400 text-sm">🔍</Text>
              <TextInput
                placeholder={t('profile.search_currency')}
                value={currencySearch}
                onChangeText={setCurrencySearch}
                className="flex-1 text-sm text-gray-900 dark:text-white"
                placeholderTextColor="#9ca3af"
                autoFocus
              />
              {currencySearch ? (
                <TouchableOpacity onPress={() => setCurrencySearch('')}>
                  <X size={14} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </View>
            <ScrollView className="flex-1">
              {(CURRENCIES ?? []).filter(c => {
                  if (!currencySearch) return true;
                  const q = currencySearch.toLowerCase();
                  const localized = getCurrencyDisplayName(c.code, safeLanguage).toLowerCase();
                  return (
                    c.code.toLowerCase().includes(q) ||
                    c.name.toLowerCase().includes(q) ||
                    localized.includes(q)
                  );
                }).map(c => {
                const selected = safeCurrency === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    onPress={() => {
                      updateUserProfile({ currency: c.code });
                      setShowCurrency(false);
                      setCurrencySearch('');
                    }}
                    className={`flex-row items-center gap-3 px-5 py-3.5 border-b border-gray-50 dark:border-gray-900 ${
                      selected ? 'bg-green-50' : ''
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text className={`w-12 text-xs font-bold ${selected ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>{c.code}</Text>
                    <Text
                      className={`flex-1 text-sm ${
                        selected ? 'font-semibold text-green-700' : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {getCurrencyDisplayName(c.code, safeLanguage)}
                    </Text>
                    {selected ? (
                      <Text className="text-green-600 text-sm font-bold">✓</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* ── Language picker ── */}
        <Modal
          visible={showLanguage}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowLanguage(false)}
        >
          <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">{t('profile.language')}</Text>
              <TouchableOpacity
                onPress={() => setShowLanguage(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
              >
                <X size={16} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView className="flex-1">
              {(LANGUAGES ?? []).map(lang => {
                const selected = (safeProfile.language ?? 'en') === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    onPress={async () => {
                      updateUserProfile({ language: lang.code });
                      // Re-schedule all recurring notifications in the new language
                      // (uses correct weekly/daily trigger types so none fire immediately).
                      // Then fire ONE immediate preview tip so the user can see
                      // how notifications look in the selected language.
                      const prefs = await loadNotifPrefs();
                      const tFn = await getTranslationFunction(lang.code);
                      await syncNotificationSettings(prefs, tFn);
                      if (prefs.tips) {
                        await sendLanguagePreviewNotification(lang.code);
                      }
                      setShowLanguage(false);
                    }}
                    className={`flex-row items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-900 ${
                      selected ? 'bg-green-50' : ''
                    }`}
                    activeOpacity={0.7}
                  >
                    <View className="flex-1">
                      <Text
                        className={`text-sm font-semibold ${
                          selected
                            ? 'text-green-700 dark:text-green-300'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {lang.nativeLabel}
                      </Text>
                      <Text className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">{lang.label}</Text>
                    </View>
                    {selected ? (
                      <Text className="text-green-600 dark:text-green-300 font-bold text-base">✓</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </ScrollView>

      {/* ── Modals ── */}
      {showTerms ? <LegalSheet type="terms" onClose={() => setShowTerms(false)} /> : null}
      {showPrivacy ? <LegalSheet type="privacy" onClose={() => setShowPrivacy(false)} /> : null}
      <CategoryManagerSheet visible={showCategories} onClose={() => setShowCategories(false)} />
      {showNotifications ? (
        <NotificationsSheet onClose={() => setShowNotifications(false)} />
      ) : null}
      {showSubscription ? (
        <SubscriptionSheet onClose={() => setShowSubscription(false)} />
      ) : null}

      {/* PIN setup (set new PIN) */}
      <PinSetupModal
        visible={showPinSetup}
        onSuccess={() => { setShowPinSetup(false); setPinEnabled(true); }}
        onClose={() => setShowPinSetup(false)}
      />

      {/* PIN verify (to disable PIN) */}
      <PinEntryModal
        visible={showPinVerify}
        onSuccess={handlePinVerified}
        onCancel={() => setShowPinVerify(false)}
      />

      {/* Export CSV date filter modal */}
      <Modal visible={showExportModal} transparent animationType="fade" onRequestClose={() => setShowExportModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: darkMode ? '#111827' : '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: darkMode ? '#374151' : '#e5e7eb', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: darkMode ? '#f9fafb' : '#111827', marginBottom: 4 }}>{t('export.title')}</Text>
            <Text style={{ fontSize: 13, color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: 16 }}>{t('export.choose_range')}</Text>
            {(
              [
                { key: 'all',        label: t('export.all_time'),   count: transactions.length },
                { key: 'this_month', label: t('export.this_month'), count: (() => { const n = new Date(); return transactions.filter(tx => { const d = new Date(tx.date); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth(); }).length; })() },
                { key: 'last_month', label: t('export.last_month'), count: (() => { const n = new Date(); const y = n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear(); const m = n.getMonth() === 0 ? 11 : n.getMonth() - 1; return transactions.filter(tx => { const d = new Date(tx.date); return d.getFullYear() === y && d.getMonth() === m; }).length; })() },
                { key: 'last_week',  label: t('export.last_week'),  count: (() => { const bounds = getExportDateBounds('last_week'); return bounds ? transactions.filter(tx => { const d = new Date(tx.date); return d >= bounds.from && d <= bounds.to; }).length : 0; })() },
              ] as const
            ).map(opt => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setExportRange(opt.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  padding: 14, borderRadius: 14, marginBottom: 8,
                  backgroundColor: exportRange === opt.key ? '#16a34a' : (darkMode ? '#1f2937' : '#f3f4f6'),
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: exportRange === opt.key ? '#ffffff' : (darkMode ? '#f9fafb' : '#111827') }}>
                  {opt.label}
                </Text>
                <Text style={{ fontSize: 12, color: exportRange === opt.key ? '#bbf7d0' : (darkMode ? '#6b7280' : '#9ca3af') }}>
                  {t('export.n_transactions', { n: opt.count })}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={doExportCSV}
              style={{ backgroundColor: '#16a34a', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>{t('export.btn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowExportModal(false)}
              style={{ alignItems: 'center', marginTop: 12 }}
            >
              <Text style={{ color: darkMode ? '#6b7280' : '#9ca3af', fontSize: 14 }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {celebrationBadge ? (
        <BadgeCelebration
          badge={celebrationBadge}
          earnedCount={earnedBadgeIds.size}
          onClose={() => {
            const updated = new Set([...seenBadgeIds, celebrationBadge.id]);
            setSeenBadgeIds(updated);
            AsyncStorage.setItem('kachingo_seen_badges', JSON.stringify([...updated]));
            setCelebrationBadge(null);
          }}
        />
      ) : null}

      {showStatusCelebration ? (
        <StatusCelebration
          status={score >= 80 ? 'excellent' : score >= 60 ? 'fair' : 'critical'}
          score={score}
          onClose={() => setShowStatusCelebration(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}
