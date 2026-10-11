import { Check, Shuffle } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { TRANSITIONS } from '../../lib/catalog';
import { cx } from '../ui/primitives';
import { PanelHeader } from './shared';

const PREVIEW = {
  fade: 'group-hover:[&>.b]:opacity-100',
  black: 'group-hover:[&>.b]:opacity-100',
  'white-flash': 'group-hover:[&>.b]:opacity-100',
  'slide-left': 'group-hover:[&>.b]:translate-x-0',
  'slide-up': 'group-hover:[&>.b]:translate-y-0',
  whip: 'group-hover:[&>.b]:translate-x-0',
  'zoom-in': 'group-hover:[&>.b]:scale-100 group-hover:[&>.b]:opacity-100',
  'zoom-out': 'group-hover:[&>.b]:scale-100 group-hover:[&>.b]:opacity-100',
  spin: 'group-hover:[&>.b]:rotate-0 group-hover:[&>.b]:scale-100',
  wipe: 'group-hover:[&>.b]:[clip-path:inset(0_0_0_0)]',
  circle: 'group-hover:[&>.b]:[clip-path:circle(75%)]',
  glitch: 'group-hover:[&>.b]:opacity-100',
  blur: 'group-hover:[&>.b]:opacity-100 group-hover:[&>.b]:blur-none',
};

const START = {
  fade: 'opacity-0',
  black: 'opacity-0',
  'white-flash': 'opacity-0',
  'slide-left': 'translate-x-full',
  'slide-up': 'translate-y-full',
  whip: 'translate-x-full',
  'zoom-in': 'scale-150 opacity-0',
  'zoom-out': 'scale-50 opacity-0',
  spin: 'rotate-180 scale-0',
  wipe: '[clip-path:inset(0_100%_0_0)]',
  circle: '[clip-path:circle(0%)]',
  glitch: 'opacity-0',
  blur: 'opacity-0 blur-sm',
};

export default function TransitionsTab() {
  const apply = useEditorStore((s) => s.applyTransition);
  const selected = useEditorStore((s) => s.clips.find((c) => c.id === s.selectedClipId) || null);
  return (
    <div className="pb-6">
      <PanelHeader title="Transições" subtitle="Aplicadas na entrada do clipe selecionado (ou no corte mais próximo do playhead).">
        <div className="text-[11px] rounded-lg px-3 py-2 bg-ink-900 border border-ink-700 text-ink-300">
          {selected && (selected.kind === 'video' || selected.kind === 'image') ? (
            <>
              Clipe: <span className="text-white font-medium">{selected.name}</span>
              {selected.transitionIn && <span className="text-brand"> · atual: {TRANSITIONS.find((t) => t.id === selected.transitionIn.id)?.name}</span>}
            </>
          ) : (
            'Dica: passe o mouse para pré-visualizar · clique para aplicar.'
          )}
        </div>
      </PanelHeader>
      <div className="px-4 grid grid-cols-3 gap-2">
        {TRANSITIONS.map((t) => {
          const on = selected?.transitionIn?.id === t.id;
          return (
            <button type="button" key={t.id} onClick={() => apply(t.id)} className="group text-left" title={t.name}>
              <div className={cx('relative aspect-square rounded-lg overflow-hidden border-2', on ? 'border-brand' : 'border-transparent group-hover:border-ink-400', PREVIEW[t.id])}>
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-sky-700 flex items-center justify-center text-white/80 text-[18px] font-black">A</div>
                <div
                  className={cx(
                    'b absolute inset-0 flex items-center justify-center text-white/90 text-[18px] font-black transition-all duration-500',
                    t.id === 'black' ? 'bg-black' : t.id === 'white-flash' ? 'bg-white text-ink-900' : 'bg-gradient-to-br from-fuchsia-500 to-orange-400',
                    START[t.id],
                  )}
                >
                  B
                </div>
                <Shuffle size={12} className="absolute bottom-1 right-1 text-white/70" />
                {on && (
                  <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-brand text-ink-950 flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="text-[10px] text-ink-200 mt-1 truncate">{t.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
