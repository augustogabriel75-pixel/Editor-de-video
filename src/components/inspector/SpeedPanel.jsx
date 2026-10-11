import { useRef } from 'react';
import { Gauge, RotateCcw } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { SPEED_CURVES, evalCurve, curveAverage } from '../../lib/speedCurves';
import { clamp, formatTime } from '../../lib/utils';
import { Section, Segmented, Slider, Button, cx } from '../ui/primitives';

const toLog = (v) => Math.log10(v);
const fromLog = (l) => Math.pow(10, l);

function CurveThumb({ points, active }) {
  const d = Array.from({ length: 33 }, (_, i) => {
    const x = i / 32;
    const y = 1 - (toLog(clamp(evalCurve(points, x), 0.1, 10)) + 1) / 2;
    return `${i ? 'L' : 'M'}${(x * 60).toFixed(1)},${(4 + y * 24).toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 60 32" className="w-full h-8">
      <line x1="0" x2="60" y1="16" y2="16" stroke="#353c4c" strokeDasharray="2 2" />
      <path d={d} fill="none" stroke={active ? '#22d3ee' : '#b9c0cf'} strokeWidth="1.8" />
    </svg>
  );
}

function CurveEditor({ clip }) {
  const setCurve = useEditorStore((s) => s.setSpeedCurve);
  const now = useEditorStore((s) => s.currentTime);
  const svgRef = useRef(null);
  const W = 280;
  const H = 130;
  const P = 10;
  const pts = clip.speedCurve.points;
  const toXY = ([x, v]) => [P + x * (W - 2 * P), P + (1 - (toLog(clamp(v, 0.1, 10)) + 1) / 2) * (H - 2 * P)];
  const path = Array.from({ length: 81 }, (_, i) => {
    const x = i / 80;
    const [px, py] = toXY([x, evalCurve(pts, x)]);
    return `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');
  const ph = clamp((now - clip.start) / clip.duration, 0, 1);

  const drag = (i) => (e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const move = (ev) => {
      const x = clamp(((ev.clientX - rect.left) / rect.width) * (W / (W - 2 * P)) - P / (W - 2 * P), 0, 1);
      const yN = clamp(((ev.clientY - rect.top) / rect.height) * (H / (H - 2 * P)) - P / (H - 2 * P), 0, 1);
      const v = +fromLog((1 - yN) * 2 - 1).toFixed(2);
      const next = pts.map((p) => [...p]);
      const lo = i === 0 ? 0 : next[i - 1][0] + 0.03;
      const hi = i === next.length - 1 ? 1 : next[i + 1][0] - 0.03;
      next[i] = [i === 0 ? 0 : i === next.length - 1 ? 1 : clamp(x, lo, hi), v];
      setCurve(clip.id, clip.speedCurve.id, next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="rounded-lg bg-ink-900 border border-ink-700 p-2">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none">
        {[10, 5, 2, 1, 0.5, 0.2, 0.1].map((v) => {
          const y = toXY([0, v])[1];
          return (
            <g key={v}>
              <line x1={P} x2={W - P} y1={y} y2={y} stroke={v === 1 ? '#586174' : '#262c39'} strokeDasharray={v === 1 ? '4 3' : '0'} />
              <text x={W - P - 2} y={y - 2} fontSize="8" fill="#586174" textAnchor="end">
                {v}x
              </text>
            </g>
          );
        })}
        <line x1={P + ph * (W - 2 * P)} x2={P + ph * (W - 2 * P)} y1={P} y2={H - P} stroke="#ffffff" strokeOpacity="0.5" />
        <path d={`${path} L${W - P},${H - P} L${P},${H - P} Z`} fill="url(#cg)" opacity="0.25" />
        <defs>
          <linearGradient id="cg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2.2" />
        {pts.map((p, i) => {
          const [x, y] = toXY(p);
          return <circle key={i} cx={x} cy={y} r="5.5" fill="#0a0c11" stroke="#22d3ee" strokeWidth="2" className="cursor-grab" onPointerDown={drag(i)} />;
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-ink-400 px-1">
        <span>Arraste os pontos para editar a curva</span>
        <span>média {(curveAverage(pts) * (clip.speed || 1)).toFixed(2)}x</span>
      </div>
    </div>
  );
}

export default function SpeedPanel({ clip }) {
  const setSpeed = useEditorStore((s) => s.setSpeed);
  const setCurve = useEditorStore((s) => s.setSpeedCurve);
  const mode = clip.speedCurve ? 'curve' : 'normal';
  return (
    <Section title="Velocidade" icon={Gauge}>
      <Segmented
        value={mode}
        onChange={(m) => (m === 'normal' ? setCurve(clip.id, 'none') : setCurve(clip.id, 'montage'))}
        options={[
          { id: 'normal', label: 'Normal' },
          { id: 'curve', label: 'Curva' },
        ]}
      />
      {mode === 'normal' ? (
        <>
          <Slider
            label="Velocidade"
            value={toLog(clip.speed || 1)}
            min={-1}
            max={1}
            step={0.01}
            format={(l) => `${fromLog(l).toFixed(2)}x`}
            onChange={(l) => setSpeed(clip.id, +fromLog(l).toFixed(2), `spd:${clip.id}`)}
            onReset={() => setSpeed(clip.id, 1)}
          />
          <div className="grid grid-cols-6 gap-1">
            {[0.25, 0.5, 1, 1.5, 2, 4].map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setSpeed(clip.id, v)}
                className={cx('py-1 rounded-md text-[11px] border', Math.abs((clip.speed || 1) - v) < 0.01 ? 'border-brand bg-brand/15 text-white' : 'border-ink-600 text-ink-300 hover:text-white')}
              >
                {v}x
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {SPEED_CURVES.filter((c) => c.id !== 'none').map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setCurve(clip.id, c.id)}
                className={cx('rounded-lg border px-1 pt-1 pb-1.5', clip.speedCurve.id === c.id ? 'border-brand bg-brand/10' : 'border-ink-700 bg-ink-900 hover:border-ink-500')}
              >
                <CurveThumb points={c.points} active={clip.speedCurve.id === c.id} />
                <div className="text-[9.5px] text-ink-200 truncate">{c.name}</div>
              </button>
            ))}
          </div>
          <CurveEditor clip={clip} />
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setCurve(clip.id, clip.speedCurve.id)}>
            Redefinir curva
          </Button>
        </>
      )}
      <div className="text-[11px] text-ink-400">
        Duração resultante: <span className="text-ink-100 font-mono">{formatTime(clip.duration)}</span>
      </div>
    </Section>
  );
}
