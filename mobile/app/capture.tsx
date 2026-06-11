import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Linking,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useFocusEffect } from 'expo-router';
import { Camera, X, ImageIcon } from 'lucide-react-native';
import { useTranslation } from '../context/LanguageContext';
import { usePurchases } from '../context/PurchasesContext';
import { usePaywall } from '../context/PaywallContext';
import { trackEvent } from '../utils/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Stage = 'preview' | 'processing' | 'review';

interface ParsedReceipt {
  type: 'expense' | 'income';
  amount: number;
  category: string;
  description: string;
}

const PENDING_RECEIPT_KEY = 'kachingo_pending_receipt';

const RECEIPT_SYSTEM_PROMPT = `You are a receipt and invoice parser. Extract transaction details from the provided image.

Return ONLY a valid JSON object with no extra text, explanation, or markdown. Use exactly this structure:
{
  "type": "expense" or "income",
  "amount": <number, the total amount paid>,
  "category": <one of the category IDs listed below>,
  "description": <short merchant name or item description, max 40 chars>
}

Expense category IDs (pick the closest match):
food, transport, shopping, entertainment, health, housing, utilities, education, travel, personal, subscriptions, insurance, savings, investment, others

Income category IDs:
salary, freelance, business, gift, other_income

Rules:
- amount must be a plain number (e.g. 42.50), never a string
- If the image is not a receipt or invoice, still return a best-effort guess with type "expense" and category "others"
- description should be concise: merchant name or item (e.g. "Starbucks", "Grocery run", "Uber ride")`;

function parseReceiptJson(text: string): ParsedReceipt {
  try {
    return JSON.parse(text.trim());
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse receipt data');
    return JSON.parse(match[0]);
  }
}

async function parseReceiptWithClaude(base64: string, mediaType: string): Promise<ParsedReceipt> {
  const workerUrl = process.env.EXPO_PUBLIC_WORKER_URL;

  // ── Production path: proxy through Cloudflare Worker ──────────────────────
  if (workerUrl) {
    const res = await fetch(`${workerUrl}/api/scan-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mediaType }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Scan failed');
    }
    return res.json();
  }

  // ── Development fallback: call Anthropic API directly ─────────────────────
  // Blocked in production to prevent API key exposure in the app bundle.
  if (!__DEV__) {
    throw new Error('Receipt scanning is not configured for this build.');
  }
  const anthropicKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new Error('Receipt scanning is not configured for this build.');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      system: RECEIPT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: 'Extract the transaction details from this receipt and return JSON only.' },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';
  return parseReceiptJson(text);
}

export default function CaptureScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isPro } = usePurchases();
  const { showPaywall } = usePaywall();
  const cameraRef = useRef<CameraView>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  useFocusEffect(useCallback(() => {
    setIsCameraActive(true);
    return () => {
      setIsCameraActive(false);
      // Restore translucent (edge-to-edge) mode so SafeAreaProvider
      // reports stable insets on all tab screens after leaving camera.
      if (Platform.OS === 'android') {
        RNStatusBar.setTranslucent(true);
        RNStatusBar.setBackgroundColor('transparent', false);
      }
    };
  }, []));
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [stage, setStage] = useState<Stage>('preview');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);

  // Auto-request camera permission when screen opens
  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      requestCameraPermission();
    }
  }, [cameraPermission]);

  // ── Core: process an image (base64 string + mediaType) ────────────────────
  const processImage = useCallback(async (base64: string, mediaType: string, uri: string) => {
    if (!isPro) {
      showPaywall();
      return;
    }
    setCapturedUri(uri);
    setScanError(null);
    setStage('processing');

    try {
      const result = await parseReceiptWithClaude(base64, mediaType);
      setParsed(result);
      setStage('review');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed');
      setStage('preview');
    }
  }, [isPro, showPaywall]);

  // ── Camera capture ─────────────────────────────────────────────────────────
  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (!photo?.base64) {
        setScanError(t('camera.capture_failed'));
        return;
      }
      await processImage(photo.base64, 'image/jpeg', photo.uri);
    } catch {
      setScanError(t('camera.capture_failed'));
      setStage('preview');
    }
  }, [processImage, isCameraReady, t]);

  // ── Gallery picker ─────────────────────────────────────────────────────────
  const pickFromGallery = useCallback(async () => {
    // Explicitly request media library permission first
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setScanError(t('camera.gallery_required'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setScanError(t('camera.read_image_failed'));
      return;
    }
    const mediaType = (asset.mimeType || 'image/jpeg') as string;
    await processImage(asset.base64, mediaType, asset.uri);
  }, [processImage, t]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setCapturedUri(null);
    setParsed(null);
    setScanError(null);
    setMountError(null);
    setStage('preview');
  }, []);

  // ── Safe navigation: deactivate camera first so the surface is released
  //    before the next screen measures its insets (prevents layout glitch).
  //    On Android setState is async, so we delay navigation by 50ms to let
  //    CameraView unmount before the route transition begins.
  const goBack = useCallback(() => {
    setIsCameraActive(false);
    if (Platform.OS === 'android') {
      setTimeout(() => router.back(), 50);
    } else {
      router.back();
    }
  }, [router]);

  // ── Save result → AsyncStorage → navigate home ────────────────────────────
  const saveAndGoHome = useCallback(async () => {
    if (!parsed) return;
    setIsCameraActive(false);
    try {
      // Copy the temp camera/gallery URI to app's document directory so it
      // persists after the OS clears the camera cache.
      let permanentUri: string | undefined;
      if (capturedUri) {
        try {
          const FileSystem = await import('expo-file-system/legacy');
          const dir = `${FileSystem.documentDirectory}receipts/`;
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          const ext = capturedUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
          const dest = `${dir}receipt_${Date.now()}.${ext}`;
          await FileSystem.copyAsync({ from: capturedUri, to: dest });
          permanentUri = dest;
        } catch {
          permanentUri = capturedUri; // fallback to temp URI if copy fails
        }
      }
      await AsyncStorage.setItem(PENDING_RECEIPT_KEY, JSON.stringify({
        ...parsed,
        receiptImage: permanentUri,
      }));
      trackEvent('receipt_scanned', { category: parsed.category, amount: parsed.amount });
      if (Platform.OS === 'android') {
        setTimeout(() => router.replace('/(tabs)'), 50);
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      setIsCameraActive(true);
      Alert.alert(t('camera.error_title'), t('camera.save_failed_msg'));
    }
  }, [parsed, capturedUri, router, t]);

  // ── Permission not yet determined ──────────────────────────────────────────
  if (!cameraPermission) {
    return (
      <View style={StyleSheet.absoluteFillObject} className="bg-black items-center justify-center">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  // ── Permission denied (and can't ask again — needs settings) ───────────────
  if (!cameraPermission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center px-8">
        <StatusBar style="light" translucent={true} />
        <Image
          source={require('../assets/m_receipt.png')}
          style={{ width: 120, height: 120 }}
          resizeMode="contain"
        />
        <Text className="text-white font-semibold text-lg text-center mt-4 mb-2">
          {t('camera.permission_title')}
        </Text>
        <Text className="text-white/60 text-sm text-center leading-relaxed mb-8">
          {t('camera.permission_desc')}
        </Text>
        {cameraPermission.canAskAgain ? (
          <TouchableOpacity
            onPress={requestCameraPermission}
            className="w-full py-4 rounded-2xl bg-green-600 items-center mb-3"
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold">{t('camera.allow_camera')}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text className="text-white/60 text-sm text-center mb-5">
              {t('camera.permission_denied_desc')}
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              className="w-full py-4 rounded-2xl bg-white/15 border border-white/20 items-center mb-3"
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold">Open Settings</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          onPress={pickFromGallery}
          className="w-full py-4 rounded-2xl bg-white/15 border border-white/20 items-center mb-3"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold">{t('camera.gallery_button')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => goBack()} className="py-3">
          <Text className="text-white/50 text-sm">{t('common.cancel')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Review stage ───────────────────────────────────────────────────────────
  if (stage === 'review' && parsed) {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <StatusBar style="light" translucent={true} />
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4">
          <TouchableOpacity
            onPress={reset}
            className="w-10 h-10 rounded-full bg-white/15 items-center justify-center"
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white font-bold text-base">{t('camera.receipt_scanned')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Captured image thumbnail */}
        {capturedUri ? (
          <View className="mx-5 rounded-2xl overflow-hidden mb-5" style={{ height: 200 }}>
            <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
          </View>
        ) : null}

        {/* Parsed fields */}
        <View className="mx-5 bg-white/10 rounded-2xl p-5 gap-4">
          <Text className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1">
            {t('camera.review_details')}
          </Text>

          <View className="flex-row items-center justify-between">
            <Text className="text-white/70 text-sm">{t('common.type')}</Text>
            <View className={`px-3 py-1 rounded-full ${parsed.type === 'expense' ? 'bg-red-500/30' : 'bg-green-500/30'}`}>
              <Text className={`text-sm font-semibold capitalize ${parsed.type === 'expense' ? 'text-red-300' : 'text-green-300'}`}>
                {parsed.type === 'expense' ? t('common.expense') : t('common.income')}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-white/70 text-sm">{t('common.amount')}</Text>
            <Text className="text-white font-bold text-lg">{parsed.amount.toFixed(2)}</Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-white/70 text-sm">{t('tx.category_label')}</Text>
            <Text className="text-white font-semibold capitalize">{parsed.category}</Text>
          </View>

          <View>
            <Text className="text-white/70 text-sm mb-1">{t('common.description')}</Text>
            <Text className="text-white font-medium">{parsed.description}</Text>
          </View>
        </View>

        {/* Actions */}
        <View className="mx-5 mt-auto mb-6 gap-3">
          <TouchableOpacity
            onPress={saveAndGoHome}
            className="w-full py-4 rounded-2xl bg-green-600 items-center shadow-lg"
            activeOpacity={0.85}
          >
            <Text className="text-white font-bold text-base">{t('camera.save_transaction')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={reset}
            className="w-full py-3.5 rounded-2xl bg-white/15 border border-white/20 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold">{t('camera.scan_again')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => goBack()}
            className="w-full py-3.5 rounded-2xl bg-white/10 border border-white/20 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold">{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Processing stage ───────────────────────────────────────────────────────
  if (stage === 'processing') {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center gap-5">
        <StatusBar style="light" translucent={true} />
        {capturedUri ? (
          <Image
            source={{ uri: capturedUri }}
            className="w-3/4 rounded-2xl opacity-40"
            style={{ height: 240 }}
            resizeMode="contain"
          />
        ) : null}
        <ActivityIndicator size="large" color="#fff" />
        <Text className="text-white font-medium text-sm">{t('camera.analyzing_receipt')}</Text>
        <Text className="text-white/60 text-xs">{t('camera.ai_reading_receipt')}</Text>
      </SafeAreaView>
    );
  }

  // ── Preview / camera stage ─────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" translucent={true} />
      {/* Camera viewfinder — use style prop directly, not className, for native view sizing */}
      {/* Only mount CameraView while this screen is focused so it releases the */}
      {/* camera surface and window-inset state cleanly during the back transition. */}
      <View style={{ flex: 1, position: 'relative' }}>
        {isCameraActive && (
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="back"
            onCameraReady={() => setIsCameraReady(true)}
            onMountError={(e) => setMountError(e.message ?? t('camera.camera_failed'))}
          />
        )}

        {/* Camera mount error overlay */}
        {mountError ? (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
            <Camera size={40} color="rgba(255,255,255,0.5)" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 16, marginBottom: 8 }}>
              {t('camera.unavailable')}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
              {mountError}
            </Text>
            <TouchableOpacity onPress={pickFromGallery} style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 28 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{t('camera.gallery_button')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Receipt frame overlay */}
        {!mountError && (
          <View
            style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}
            pointerEvents="none"
          >
            <View
              style={{
                width: '78%',
                height: '62%',
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.65)',
                borderRadius: 16,
              }}
            />
          </View>
        )}

        {/* Align hint */}
        {!mountError && (
          <View style={{ position: 'absolute', bottom: 144, left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{t('camera.align_receipt')}</Text>
          </View>
        )}

        {/* Error banner */}
        {scanError ? (
          <View style={{ position: 'absolute', top: 64, left: 20, right: 20, backgroundColor: 'rgba(239,68,68,0.8)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: '500' }}>{scanError}</Text>
          </View>
        ) : null}
      </View>

      {/* Controls bar */}
      <View
        style={{ paddingHorizontal: 32, paddingTop: 24, paddingBottom: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.85)' }}
      >
        {/* Close */}
        <TouchableOpacity
          onPress={() => goBack()}
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 2, borderColor: 'rgba(239,68,68,0.6)', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.8}
        >
          <X size={22} color="#f87171" />
        </TouchableOpacity>

        {/* Shutter */}
        <TouchableOpacity
          onPress={capturePhoto}
          disabled={!isCameraReady || !!mountError}
          style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isCameraReady && !mountError ? '#fff' : 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.9}
        >
          <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: 'rgba(0,0,0,0.2)', backgroundColor: isCameraReady && !mountError ? '#fff' : 'transparent' }} />
        </TouchableOpacity>

        {/* Gallery */}
        <TouchableOpacity
          onPress={pickFromGallery}
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.8}
        >
          <ImageIcon size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
