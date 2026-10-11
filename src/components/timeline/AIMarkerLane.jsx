import { useMemo } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { getTemplate, MOTION_CATEGORIES } from '../../engine/motionTemplates';
import { formatTime } from '../../lib/utils';
import { iconFor } from '../ui/icons';
import { AI_LANE_H } from './constants';
import { cx } from '../ui/primitives';

/** Linha do tempo dedicada: um badge brilhante onde a IA aplicou cada motion. */
export default function AIMarkerLane({ width }) {
  const clips = useEditorStore((s) => s.clips);
  const pps = useEditorStore((s) => s.pxPerSec);
  const selectedId = useEditorStore((s) => s.selectedClipId);
  const select = useEditorStore((s) => s.select);
  const seek = useEditorStore((s) => s.seek);
  const list = useMemo(() => clips.filter((c) => c.kind === 'motion' && c.ai).sort((a, b) => a.start - b.start), [clips]);
  let lastRight = -Infinity;
  return (
    <div className="relative bg-gradient-to-r from-ai/[0.07] via-ink-900 to-hot/[0.05] border-b border-ai/20" style={{ width, height: AI_LANE_H }}>
      {list.map((c) => {
        const tpl = getTemplate(c.motion.templateId);
        const Icon = iconFor(tpl.icon);
        const color = MOTION_CATEGORIES[tpl.category].color;
        const x = c.start * pps;
        const compact = x < lastRight + 4;
        lastRight = Math.max(lastRight, x + (compact ? 18 : 46));
        return (
          <button
            type="button"
            key={c.id}
            title={`✨ IA Motion Generated\n${c.name} · ${formatTime(c.start)}\n${c.motion.reason || ''}`}
            onClick={() => {
              select(c.id);
              seek(c.start + 0.02);
            }}
            className={cx(
              'absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-full text-[9px] font-bold text-white whitespace-nowrap transition-transform hover:scale-110 hover:z-10',
              compact ? 'w-4 h-4 justify-center' : 'h-[18px] pl-1 pr-1.5',
              c.disabled && 'opacity-35 grayscale',
              selectedId === c.id && 'ring-2 ring-white z-10',
            )}
            style={{ left: x, background: `linear-gradient(135deg, ${color}, #a855f7)`, boxShadow: `0 0 10px ${color}aa` }}
          >
            <Icon size={10} />
            {!compact && <span>✨ IA</span>}
          </button>
        );
      })}
    </div>
  );
}
