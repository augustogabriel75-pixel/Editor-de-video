import { useMemo, useState } from 'react';
import { Check, Zap } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { EFFECTS, EFFECT_CATEGORIES } from '../../lib/catalog';
import { cx } from '../ui/primitives';
import { SearchBox, Chips, PanelHeader } from './shared';
import { useTargetClip, TargetHint } from './useTargetClip';

const ANIM = {
  Glitch: 'group-hover:[transform:skewX(-8deg)]',
  Zoom: 'group-hover:scale-125',
  Flash: 'group-hover:brightness-200',
  Desfoque: 'group-hover:blur-[2px]',
  Retrô: 'group-hover:sepia',
  Luz: 'group-hover:brightness-150',
};

export default function EffectsTab() {
  const toggleEffect = useEditorStore((s) => s.toggleEffect);
  const target = useTargetClip();
  const [cat, setCat] = useState('Todos');
  const [q, setQ] = useState('');
  const list = useMemo(() => EFFECTS.filter((e) => (cat === 'Todos' || e.category === cat) && (!q || e.name.toLowerCase().includes(q.toLowerCase()))), [cat, q]);
  return (
    <div className="pb-6">
      <PanelHeader title="Efeitos" subtitle="Glitch, zoom, flashes, desfoques e luzes prontos para aplicar.">
        <SearchBox value={q} onChange={setQ} placeholder="Buscar efeitos" />
        <Chips options={EFFECT_CATEGORIES} value={cat} onChange={setCat} />
        <TargetHint clip={target} />
      </PanelHeader>
      <div className="px-4 grid grid-cols-3 gap-2">
        {list.map((e) => {
          const on = target?.effects?.some((x) => x.id === e.id);
          return (
            <button type="button" key={e.id} onClick={() => toggleEffect(e.id)} className="group text-left" title={e.name}>
              <div
                className={cx('relative aspect-square rounded-lg overflow-hidden border-2 transition-colors', on ? 'border-brand' : 'border-transparent group-hover:border-ink-400')}
                style={{ background: `linear-gradient(135deg, ${e.colors[0]}, ${e.colors[1]})` }}
              >
                <div className={cx('absolute inset-0 flex items-center justify-center transition-all duration-300', ANIM[e.category])}>
                  <Zap size={22} className="text-white/90 drop-shadow" />
                </div>
                {e.category === 'Glitch' && <div className="absolute inset-x-0 top-1/3 h-1.5 bg-white/30 mix-blend-overlay group-hover:translate-x-2 transition-transform" />}
                {on && (
                  <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-brand text-ink-950 flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="text-[10px] text-ink-200 mt-1 truncate">{e.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
