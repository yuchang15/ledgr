import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, ScrollView, PanResponder, Animated, Image, Dimensions } from 'react-native';
import { Trash2, Edit2, RefreshCw, ChevronDown, ChevronRight, ChevronLeft, X, ImageIcon } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../context/LanguageContext';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Transaction } from '../../types';
import CategoryIcon from './CategoryIcon';

const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function translateCategoryLabel(
  t: (key: any, params?: Record<string, string | number>) => string,
  cat?: { id: string; label: string },
): string {
  if (!cat) return '';
  const key = `cat.${cat.id}` as any;
  const translated = t(key);
  return translated !== key ? translated : cat.label;
}

export interface CategoriesProps {
  year: number;
  month: number;
  view: 'category' | 'date';
  filterFn?: (t: Transaction) => boolean;
  onEdit?: (tx: Transaction) => void;
}

function formatDayLabel(dateStr: string, t: (key: any, params?: Record<string, string | number>) => string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const toStr = (dt: Date) => dt.toISOString().slice(0, 10);
  if (dateStr === toStr(today)) return t('common.today');
  if (dateStr === toStr(yesterday)) return t('common.yesterday');
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) {
    const dayIndex = d.getDay();
    const dayKeys = ['day.sunday', 'day.monday', 'day.tuesday', 'day.wednesday', 'day.thursday', 'day.friday', 'day.saturday'];
    return t(dayKeys[dayIndex] as any);
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Calendar Overlay (exported for use in parent) ─────────────────────────────
export function CalendarModal({
  year, month, transactions, formatCurrency, onClose,
}: {
  year: number; month: number; transactions: Transaction[];
  formatCurrency: (n: number) => string; onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const dark = colorScheme === 'dark';
  const c = {
    surface: dark ? '#1f2937' : '#fff',
    handle: dark ? '#4b5563' : '#e5e7eb',
    border: dark ? '#374151' : '#f3f4f6',
    borderFaint: dark ? '#374151' : '#f9fafb',
    textPrimary: dark ? '#f9fafb' : '#111827',
    textSecondary: dark ? '#e5e7eb' : '#374151',
    textMuted: dark ? '#9ca3af' : '#6b7280',
    icon: dark ? '#e5e7eb' : '#374151',
    closeBtn: dark ? '#374151' : '#f3f4f6',
    closeIcon: dark ? '#9ca3af' : '#6b7280',
  };

  const [calYear, setCalYear] = useState(year);
  const [calMonth, setCalMonth] = useState(month);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const dayHeaders = useMemo(
    () => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(key =>
      t(`day.${key}` as any),
    ),
    [t],
  );

  // Sync when parent month changes
  useEffect(() => { setCalYear(year); setCalMonth(month); }, [year, month]);

  const spendByDay: Record<number, number> = {};
  const incomeByDay: Record<number, number> = {};
  transactions.forEach(tx => {
    const d = new Date(tx.date);
    if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
      const day = d.getDate();
      if (tx.type === 'expense') spendByDay[day] = (spendByDay[day] || 0) + tx.amount;
      else incomeByDay[day] = (incomeByDay[day] || 0) + tx.amount;
    }
  });
  const maxSpend = Math.max(...Object.values(spendByDay), 1);

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
    setSelectedDay(null);
  }

  const today = new Date();
  const selectedDayTxs = selectedDay
    ? transactions.filter(tx => {
        const d = new Date(tx.date);
        return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === selectedDay;
      })
    : [];

  const cellWidth = `${100 / 7}%` as any;

  // ── Swipe-to-dismiss ──────────────────────────────────────────────────────────
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollYRef = useRef(0);
  const dragAtTopRef = useRef(false);

  // Reset sheet position each time the modal mounts
  useEffect(() => { translateY.setValue(0); }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.5 && scrollYRef.current <= 0,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) translateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 130 || vy > 1.2) {
          Animated.timing(translateY, {
            toValue: 700, duration: 220, useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(translateY, {
            toValue: 0, tension: 80, friction: 12, useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  // Backdrop fades from 0.5 → 0 as the sheet is pulled down
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, 300],
    outputRange: [0.5, 0],
    extrapolate: 'clamp',
  });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'black', opacity: backdropOpacity }}
        pointerEvents="none" />

      <Animated.View
        {...panResponder.panHandlers}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          backgroundColor: c.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
          transform: [{ translateY }],
          maxHeight: Dimensions.get('window').height * 0.87,
        }}
      >
        {/* Drag handle */}
        <View
          style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 16 }}
        >
          <View style={{ width: 36, height: 4, backgroundColor: c.handle, borderRadius: 2 }} />
        </View>

        <ScrollView
          scrollEventThrottle={16}
          onScrollBeginDrag={(e) => {
            dragAtTopRef.current = e.nativeEvent.contentOffset.y <= 0;
          }}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
            if (e.nativeEvent.contentOffset.y > 5) dragAtTopRef.current = false;
          }}
          onScrollEndDrag={(e) => {
            const vel = (e.nativeEvent as any).velocity?.y;
            if (dragAtTopRef.current && vel != null && vel > 0.3) {
              dragAtTopRef.current = false;
              Animated.timing(translateY, {
                toValue: 600, duration: 250, useNativeDriver: true,
              }).start(() => onClose());
            } else {
              dragAtTopRef.current = false;
            }
          }}
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 14 + bottomInset }}
        >
          {/* Month navigation */}
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 }}
          >
            <TouchableOpacity onPress={prevMonth} style={{ padding: 8 }}>
              <ChevronLeft size={20} color={c.icon} />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.textPrimary }}>
              {t(`month.${MONTH_KEYS[calMonth]}` as any)} {calYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
              <ChevronRight size={20} color={c.icon} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 10, marginBottom: 4 }}>
            {dayHeaders.map(d => (
              <Text key={d} style={{ width: cellWidth, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#9ca3af', letterSpacing: 0.5 }}>
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingBottom: 4 }}>
            {cells.map((day, i) => {
              if (day === null) return <View key={`empty-${i}`} style={{ width: cellWidth, aspectRatio: 1 }} />;
              const spend = spendByDay[day] || 0;
              const income = incomeByDay[day] || 0;
              const isSelected = selectedDay === day;
              const hasSpend = spend > 0;
              const hasIncome = income > 0;
              const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
              const intensity = hasSpend ? Math.max(0.2, spend / maxSpend) : 0;

              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => setSelectedDay(isSelected ? null : day)}
                  style={{ width: cellWidth, aspectRatio: 1, padding: 2 }}
                  activeOpacity={0.7}
                >
                  <View style={{
                    flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSelected ? '#16a34a'
                      : hasSpend ? `rgba(239,68,68,${intensity * 0.3})`
                      : hasIncome ? 'rgba(34,197,94,0.12)' : 'transparent',
                    borderWidth: isToday && !isSelected ? 1.5 : 0, borderColor: '#16a34a',
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: isToday ? '700' : '400', color: isSelected ? '#fff' : c.textPrimary }}>
                      {day}
                    </Text>
                    {(hasSpend || hasIncome) && !isSelected && (
                      <View style={{ flexDirection: 'row', gap: 2, marginTop: 1 }}>
                        {hasSpend && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#ef4444' }} />}
                        {hasIncome && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#22c55e' }} />}
                      </View>
                    )}
                    {isSelected && spend > 0 && (
                      <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>
                        {formatCurrency(spend).replace(/\.\d+$/, '')}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 20, paddingVertical: 10, justifyContent: 'center', borderTopWidth: 1, borderTopColor: c.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {[0.2, 0.4, 0.65, 0.9].map((o, i) => (
                  <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: `rgba(239,68,68,${o})` }} />
                ))}
              </View>
              <Text style={{ fontSize: 11, color: c.textMuted }}>{t('calendar.legend_spend')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
              <Text style={{ fontSize: 11, color: c.textMuted }}>{t('common.income')}</Text>
            </View>
          </View>

          {/* Selected day transactions */}
          {selectedDay !== null && (
            <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.textMuted, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t(`month.${MONTH_KEYS[calMonth]}` as any)} {selectedDay}
                {selectedDayTxs.length === 0 ? ` — ${t('home.no_transactions')}` : ''}
              </Text>
              {selectedDayTxs.map(tx => (
                <View key={tx.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.borderFaint }}>
                  <Text style={{ flex: 1, fontSize: 13, color: c.textSecondary }} numberOfLines={1}>
                    {tx.description || tx.category}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: tx.type === 'income' ? '#16a34a' : '#ef4444' }}>
                    {tx.type === 'income' ? '+' : '-'}{tx.originalCurrency && tx.originalAmount != null
                      ? `${tx.originalAmount} ${tx.originalCurrency}`
                      : formatCurrency(tx.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Close */}
          <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.closeBtn, alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} color={c.closeIcon} />
            </View>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── Main Categories Component ─────────────────────────────────────────────────
export default function Categories({ year, month, view, filterFn, onEdit }: CategoriesProps) {
  const { transactions, expenseCategories, incomeCategories, removeTransaction, formatCurrency } = useApp();
  const { t } = useTranslation();
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const c = {
    surface: dark ? '#1f2937' : '#fff',
    border: dark ? '#374151' : '#f3f4f6',
    borderFaint: dark ? '#374151' : '#f9fafb',
    dateBadge: dark ? '#374151' : '#f3f4f6',
    textPrimary: dark ? '#f9fafb' : '#111827',
    textSecondary: dark ? '#e5e7eb' : '#374151',
    textMuted: '#9ca3af',
  };

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const allCategories = useMemo(() => [...expenseCategories, ...incomeCategories], [expenseCategories, incomeCategories]);

  const monthTxs = useMemo(
    () => transactions
      .filter(tx => {
        const d = new Date(tx.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .filter(filterFn ?? (() => true))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions, year, month, filterFn],
  );

  function handleDelete(tx: Transaction) {
    setDeletingTx(tx);
  }

  function cancelDelete() {
    setDeletingTx(null);
  }

  function confirmDelete() {
    if (!deletingTx) return;
    removeTransaction(deletingTx.id);
    setDeletingTx(null);
  }

  function TxRow({ tx }: { tx: Transaction }) {
    const cat = allCategories.find(c => c.id === tx.category);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: (cat?.color ?? '#94a3b8') + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CategoryIcon icon={cat?.icon ?? 'MoreHorizontal'} color={cat?.color ?? '#94a3b8'} size={16} />
        </View>
        <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: c.textPrimary }} numberOfLines={1}>
            {tx.description || translateCategoryLabel(t, cat)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <Text style={{ fontSize: 11, color: c.textMuted }}>{translateCategoryLabel(t, cat)}</Text>
            {tx.isAutoDebit && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <RefreshCw size={9} color="#9ca3af" />
                <Text style={{ fontSize: 10, color: '#9ca3af' }}>{t('misc.recurring' as any)}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: tx.type === 'income' ? '#16a34a' : '#ef4444', marginRight: 2 }}>
          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
        </Text>
        {tx.receiptImage && (
          <TouchableOpacity
            onPress={() => setViewingReceipt(tx.receiptImage!)}
            style={{ padding: 7 }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <ImageIcon size={13} color="#16a34a" />
          </TouchableOpacity>
        )}
        {onEdit && (
          <TouchableOpacity onPress={() => onEdit(tx)} style={{ padding: 7 }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            <Edit2 size={13} color="#9ca3af" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => handleDelete(tx)} style={{ padding: 7 }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
          <Trash2 size={13} color="#ef4444" />
        </TouchableOpacity>
      </View>
    );
  }

  if (monthTxs.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 }}>
        <Modal visible={!!deletingTx} transparent animationType="fade" onRequestClose={cancelDelete}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ width: '86%', backgroundColor: c.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: c.border }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: c.textPrimary, marginBottom: 8 }}>{t('tx.delete_title' as any)}</Text>
              <Text style={{ fontSize: 14, color: c.textSecondary, marginBottom: 14 }}>{deletingTx ? t('tx.delete_confirm' as any, { name: deletingTx.description || deletingTx.category }) : ''}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <TouchableOpacity onPress={cancelDelete} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                  <Text style={{ color: '#6b7280' }}>{t('common.cancel' as any)}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmDelete} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                  <Text style={{ color: '#ef4444', fontWeight: '700' }}>{t('common.delete' as any)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <Modal visible={!!viewingReceipt} transparent animationType="fade" onRequestClose={() => setViewingReceipt(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setViewingReceipt(null)}
              style={{ position: 'absolute', top: 48, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color="#fff" />
            </TouchableOpacity>
            {viewingReceipt && (
              <Image source={{ uri: viewingReceipt }} style={{ width: '90%', height: '75%' }} resizeMode="contain" />
            )}
          </View>
        </Modal>
        <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center' }}>{t('misc.no_tx_month' as any)}</Text>
      </View>
    );
  }

  // ── Category view ──────────────────────────────────────────────────────────
  if (view === 'category') {
    const rows = allCategories
      .map(cat => {
        const catTxs = monthTxs.filter(tx => tx.category === cat.id);
        const expTotal = catTxs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
        const incTotal = catTxs.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
        return { ...cat, txs: catTxs, expTotal, incTotal };
      })
      .filter(r => r.txs.length > 0)
      .sort((a, b) => (b.expTotal + b.incTotal) - (a.expTotal + a.incTotal));

    return (
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Modal visible={!!deletingTx} transparent animationType="fade" onRequestClose={cancelDelete}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ width: '86%', backgroundColor: c.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: c.border }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: c.textPrimary, marginBottom: 8 }}>{t('tx.delete_title' as any)}</Text>
              <Text style={{ fontSize: 14, color: c.textSecondary, marginBottom: 14 }}>{deletingTx ? t('tx.delete_confirm' as any, { name: deletingTx.description || deletingTx.category }) : ''}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <TouchableOpacity onPress={cancelDelete} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                  <Text style={{ color: '#6b7280' }}>{t('common.cancel' as any)}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmDelete} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                  <Text style={{ color: '#ef4444', fontWeight: '700' }}>{t('common.delete' as any)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <Modal visible={!!viewingReceipt} transparent animationType="fade" onRequestClose={() => setViewingReceipt(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setViewingReceipt(null)}
              style={{ position: 'absolute', top: 48, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color="#fff" />
            </TouchableOpacity>
            {viewingReceipt && (
              <Image source={{ uri: viewingReceipt }} style={{ width: '90%', height: '75%' }} resizeMode="contain" />
            )}
          </View>
        </Modal>
        {rows.map(row => {
          const isExp = expanded[row.id] === true;
          const displayTotal = row.expTotal > 0 ? row.expTotal : row.incTotal;
          const isIncome = row.expTotal === 0;
          return (
            <View key={row.id} style={{ marginBottom: 6 }}>
              <TouchableOpacity
                onPress={() => setExpanded(prev => ({ ...prev, [row.id]: !isExp }))}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: c.surface, borderRadius: 16,
                  paddingHorizontal: 14, paddingVertical: 11,
                  borderWidth: 1, borderColor: c.border,
                }}
                activeOpacity={0.7}
              >
                <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: row.color + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <CategoryIcon icon={row.icon} color={row.color} size={19} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.textPrimary }}>{translateCategoryLabel(t, row)}</Text>
                  <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 1 }}>
                    {row.txs.length} {t(row.txs.length === 1 ? 'common.transaction' : 'common.transactions')}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: isIncome ? '#16a34a' : '#ef4444', marginRight: 8 }}>
                  {isIncome ? '+' : '-'}{formatCurrency(displayTotal)}
                </Text>
                {isExp ? <ChevronDown size={14} color="#d1d5db" /> : <ChevronRight size={14} color="#d1d5db" />}
              </TouchableOpacity>

              {isExp && (
                <View style={{ backgroundColor: c.surface, borderRadius: 12, marginTop: 2, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
                  {row.txs.map((tx, i) => (
                    <View key={tx.id} style={i < row.txs.length - 1 ? { borderBottomWidth: 1, borderBottomColor: c.borderFaint } : {}}>
                      <TxRow tx={tx} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  // ── Date view ──────────────────────────────────────────────────────────────
  const byDate: Record<string, Transaction[]> = {};
  monthTxs.forEach(tx => {
    const key = tx.date.slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(tx);
  });
  const dateRows = Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateStr, dayTxs]) => ({
      dateStr,
      dayTxs,
      expenses: dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      income: dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    }));

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      <Modal visible={!!deletingTx} transparent animationType="fade" onRequestClose={cancelDelete}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ width: '86%', backgroundColor: c.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.textPrimary, marginBottom: 8 }}>{t('tx.delete_title' as any)}</Text>
            <Text style={{ fontSize: 14, color: c.textSecondary, marginBottom: 14 }}>{deletingTx ? t('tx.delete_confirm' as any, { name: deletingTx.description || deletingTx.category }) : ''}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <TouchableOpacity onPress={cancelDelete} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                <Text style={{ color: '#6b7280' }}>{t('common.cancel' as any)}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDelete} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                <Text style={{ color: '#ef4444', fontWeight: '700' }}>{t('common.delete' as any)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={!!viewingReceipt} transparent animationType="fade" onRequestClose={() => setViewingReceipt(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setViewingReceipt(null)}
            style={{ position: 'absolute', top: 48, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>
          {viewingReceipt && (
            <Image source={{ uri: viewingReceipt }} style={{ width: '90%', height: '75%' }} resizeMode="contain" />
          )}
        </View>
      </Modal>
      {dateRows.map(({ dateStr, dayTxs, expenses, income }) => {
        const isExp = expanded[dateStr] === true;
        const label = formatDayLabel(dateStr, t);
        const d = new Date(dateStr + 'T12:00:00');
        const dayIndex = d.getDay();
        const dayKeys = ['day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat'];
        const dayName = t(dayKeys[dayIndex] as any);
        const dayNum = String(d.getDate());

        return (
          <View key={dateStr} style={{ marginBottom: 6 }}>
            <TouchableOpacity
              onPress={() => setExpanded(prev => ({ ...prev, [dateStr]: !isExp }))}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
              activeOpacity={0.7}
            >
              {/* Date badge */}
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.dateBadge, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.4 }}>{dayName}</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: c.textPrimary, lineHeight: 20 }}>{dayNum}</Text>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.textPrimary }}>{label}</Text>
                <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 1 }}>
                  {dayTxs.length} {t(dayTxs.length === 1 ? 'common.transaction' : 'common.transactions')}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                {expenses > 0 && (
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#ef4444' }}>-{formatCurrency(expenses)}</Text>
                )}
                {income > 0 && (
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#16a34a' }}>+{formatCurrency(income)}</Text>
                )}
              </View>
              {isExp ? <ChevronDown size={14} color="#d1d5db" /> : <ChevronRight size={14} color="#d1d5db" />}
            </TouchableOpacity>

            {isExp && (
              <View style={{ backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
                {dayTxs.map((tx, i) => (
                  <View key={tx.id} style={i < dayTxs.length - 1 ? { borderBottomWidth: 1, borderBottomColor: c.borderFaint } : {}}>
                    <TxRow tx={tx} />
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
