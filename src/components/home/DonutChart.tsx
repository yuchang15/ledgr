import { useState } from 'react';
import { EXPENSE_CATEGORIES } from '../../types';

interface Slice {
  category: string;
  amount: number;
  color: string;
  label: string;
}

interface Props {
  slices: Slice[];
  total: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function DonutChart({ slices, total }: Props) {
  const [activeSlice, setActiveSlice] = useState<string | null>(null);

  const cx = 80, cy = 80, outerR = 68, innerR = 44;
  let currentAngle = 0;

  const paths = slices.map((slice) => {
    const portion = total > 0 ? (slice.amount / total) * 360 : 0;
    const start = currentAngle;
    const end = currentAngle + portion;
    currentAngle = end;
    return { ...slice, start, end };
  });

  const active = paths.find(p => p.category === activeSlice);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width={160} height={160} viewBox="0 0 160 160">
          {paths.length === 0 ? (
            <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={outerR - innerR} />
          ) : (
            paths.map((p) => (
              <path
                key={p.category}
                d={arcPath(cx, cy, (outerR + innerR) / 2, p.start, p.end)}
                fill="none"
                stroke={p.color}
                strokeWidth={outerR - innerR}
                strokeLinecap="butt"
                opacity={activeSlice && activeSlice !== p.category ? 0.4 : 1}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                onClick={() => setActiveSlice(activeSlice === p.category ? null : p.category)}
              />
            ))
          )}
        </svg>
        {/* Center total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-white/70 font-medium">Total</span>
          <span className="text-white font-bold text-sm leading-tight">
            ${total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Legend tooltip — shown only when a slice is active */}
      <div className={`transition-all duration-200 overflow-hidden ${active ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0'}`}>
        {active && (
          <div className="flex items-center gap-2 glass rounded-full px-3 py-1">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: active.color }} />
            <span className="text-white text-xs font-medium">{active.label}</span>
            <span className="text-white/80 text-xs">${active.amount.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export type { Slice };
