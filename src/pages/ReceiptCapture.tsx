import { useState, useRef, useCallback } from 'react';
import { Camera, X, RefreshCw, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ManualEntryModal from '../components/home/ManualEntryModal';
import { TransactionType } from '../types';

type Stage = 'preview' | 'capturing' | 'processing' | 'review';

interface ParsedReceipt {
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
}

// Simulates AI receipt parsing
function parseReceiptMock(imageDataUrl: string): Promise<ParsedReceipt> {
  return new Promise(resolve => {
    setTimeout(() => {
      // Deterministic mock based on "image content"
      const hash = imageDataUrl.length % 5;
      const mocks: ParsedReceipt[] = [
        { type: 'expense', amount: 42.50, category: 'food', description: 'Restaurant meal' },
        { type: 'expense', amount: 89.99, category: 'shopping', description: 'Retail purchase' },
        { type: 'expense', amount: 15.00, category: 'transport', description: 'Ride service' },
        { type: 'expense', amount: 120.00, category: 'health', description: 'Pharmacy' },
        { type: 'expense', amount: 65.75, category: 'utilities', description: 'Service bill' },
      ];
      resolve(mocks[hash]);
    }, 2000);
  });
}

export default function ReceiptCapture() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stage, setStage] = useState<Stage>('preview');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      setCameraError('Camera access denied or not available. Please allow camera access and try again.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    stopCamera();
    setCapturedImage(dataUrl);
    setStage('processing');
    const result = await parseReceiptMock(dataUrl);
    setParsed(result);
    setStage('review');
  }, [stopCamera]);

  const reset = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setParsed(null);
    setCameraError(null);
    setStage('preview');
    setCameraActive(false);
  }, [stopCamera]);

  // Show entry modal after AI parse
  if (stage === 'review' && parsed) {
    return (
      <ManualEntryModal
        prefill={parsed}
        onClose={() => { navigate('/'); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col max-w-[430px] mx-auto">
      {/* Camera viewfinder or placeholder */}
      <div className="flex-1 relative overflow-hidden">
        {cameraActive ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {/* Receipt overlay guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-2/3 border-2 border-white/60 rounded-2xl" style={{
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)'
              }} />
            </div>
            <p className="absolute bottom-36 left-0 right-0 text-center text-white/80 text-xs">
              Align receipt within frame
            </p>
          </>
        ) : stage === 'processing' && capturedImage ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <img src={capturedImage} alt="Captured" className="w-3/4 rounded-2xl opacity-50 object-contain max-h-64" />
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" style={{ borderWidth: 3 }} />
              <p className="text-white font-medium text-sm">Analyzing receipt...</p>
              <p className="text-white/60 text-xs">AI is reading your receipt</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-8">
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-2">
              <Camera size={40} className="text-white/60" />
            </div>
            <p className="text-white font-semibold text-lg text-center">Receipt Capture</p>
            <p className="text-white/60 text-sm text-center leading-relaxed">
              Point your camera at a receipt and our AI will automatically extract the transaction details.
            </p>
            {cameraError && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-2xl px-4 py-3 w-full">
                <p className="text-red-300 text-xs text-center">{cameraError}</p>
              </div>
            )}
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="bg-black/80 px-6 py-6 pb-24 flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/')}
          className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"
        >
          <X size={22} className="text-white" />
        </button>

        {cameraActive ? (
          <button
            onClick={capturePhoto}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
          >
            <div className="w-16 h-16 rounded-full border-4 border-black/20 bg-white" />
          </button>
        ) : (
          <button
            onClick={startCamera}
            className="flex-1 py-4 rounded-2xl bg-green-600 text-white font-bold text-base active:scale-[0.98] transition-transform shadow-lg shadow-green-600/30 flex items-center justify-center gap-2"
          >
            <Camera size={20} />
            Open Camera
          </button>
        )}

        {cameraActive ? (
          <button
            onClick={reset}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"
          >
            <RefreshCw size={18} className="text-white" />
          </button>
        ) : (
          <div className="w-12" />
        )}
      </div>
    </div>
  );
}
