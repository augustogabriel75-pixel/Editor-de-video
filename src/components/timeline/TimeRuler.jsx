import { useMemo, useRef } from 'react';
import { useTimeSubscription } from '../../hooks/useTimeSubscription';
import { useEditorStore } from '../../store/useEditorStore';
import { formatTime } from '../../lib/utils';
import { RULER_H } from './constants';

const STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60];

function PlayheadHead() {
  const ref = useRef(null);
  useTimeSubscription((t, pps) => {
    if (ref.current) ref.current.style.transform = `translateX(${t * pps - 6}px)`;
  });
  return (
    <div ref={ref} className="absolute left-0 top-0 pointer-events-none will-change-transform">
      <svg width="12" height={RULER_H} viewBox={`0 0 12 ${RULER_H}`}>
        <path d={`M0 ${RULER_H - 12} h12 v4 l-6 8 l-6 -8z`} fill="#ffffff" />
        <line x1="6" x2="6" y1="0" y2={RULER_H} stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export default function TimeRuler({ width, hideHead = false }) {
  const pps = useEditorStore((s) => s.pxPerSec);
  const analysis = useEditorStore((s) => s.ai.analysis);
  const seek = useEditorStore((s) => s.seek);
  const pause = useEditorStore((s) => s.pause);
  const major = STEPS.find((s) => s * pps >= 72) || 60;
  const minor = major * pps >= 120 ? major / 10 : major / 5;
  const seconds = width / pps;

  const ticks = useMemo(() => {
    const out = [];
    const n = Math.ceil(seconds / minor);
    for (let i = 0; i <= n; i++) {
      const t = +(i * minor).toFixed(4);
      const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
      out.push({ t, isMajor });
    }
    return out;
  }, [seconds, minor, major]);

  const onDown = (e) => {
    if (hideHead) return; // celular: o playhead é fixo e a timeline é que desliza
    pause();
    const r = e.currentTarget.getBoundingClientRect();
    const at = (x) => Math.max(0, (x - r.left) / pps);
    seek(at(e.clientX));
    const move = (ev) => seek(at(ev.clientX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className={`relative ${hideHead ? 'bg-ink-950' : 'bg-ink-900 border-b border-ink-700 cursor-pointer touch-none'}`} style={{ width, height: RULER_H }} onPointerDown={onDown}>
      <svg width={width} height={RULER_H} className="absolute inset-0">
        {ticks.map(({ t, isMajor }) => (
          <g key={t}>
            <line x1={t * pps + 0.5} x2={t * pps + 0.5} y1={isMajor ? 12 : 20} y2={RULER_H} stroke={isMajor ? '#586174' : '#353c4c'} />
            {isMajor && (
              <text x={t * pps + 4} y={11} fontSize="9.5" fill="#8a93a7" fontFamily="JetBrains Mono, monospace">
                {formatTime(t, false)}
              </text>
            )}
          </g>
        ))}
        {analysis?.beats?.map((b, i) => <circle key={`b${i}`} cx={b.t * pps} cy={RULER_H - 3} r={1 + b.strength * 1.6} fill="#22d3ee" opacity={0.35 + b.strength * 0.5} />)}
        {analysis?.emphasis?.map((e, i) => <rect key={`e${i}`} x={e.t * pps - 2} y={RULER_H - 9} width="4" height="4" transform={`rotate(45 ${e.t * pps} ${RULER_H - 7})`} fill="#ec4899" opacity="0.85" />)}
      </svg>
      {!hideHead && <PlayheadHead />}
    </div>
  );
}
