import { Check } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { FILTERS, buildFilterString } from '../../lib/catalog';
import { cx, Slider } from '../ui/primitives';
import { PanelHeader } from './shared';
import { useTargetClip, TargetHint } from './useTargetClip';

export default function FiltersTab() {
  const apply = useEditorStore((s) => s.applyFilter);
  const updateDeep = useEditorStore((s) => s.updateClipDeep);
  const thumb = useEditorStore((s) => s.assets.find((a) => a.id === 'demo-presenter')?.thumb);
  const target = useTargetClip();
  const targetThumb = useEditorStore((s) => (target ? s.assets.find((a) => a.id === target.assetId)?.thumb : null));
  const img = targetThumb || thumb;
  return (
    <div className="pb-6">
      <PanelHeader title="Filtros" subtitle="Correção de cor cinematográfica com intensidade ajustável.">
        <TargetHint clip={target} what="filtro" />
        {target && target.filter?.id !== 'none' && (
          <Slider label="Intensidade do filtro" value={target.filter.intensity} min={0} max={100} suffix="%" onChange={(v) => updateDeep(target.id, 'filter', { intensity: v }, `filter:${target.id}`)} />
        )}
      </PanelHeader>
      <div className="px-4 grid grid-cols-3 gap-2">
        {FILTERS.map((f) => {
          const on = (target?.filter?.id || 'none') === f.id;
          return (
            <button type="button" key={f.id} onClick={() => apply(f.id)} className="group text-left">
              <div className={cx('relative aspect-square rounded-lg overflow-hidden border-2', on ? 'border-brand' : 'border-transparent group-hover:border-ink-400')}>
                {img && <img src={img} alt="" className="w-full h-full object-cover" style={{ filter: buildFilterString(f.id, 100) }} draggable={false} />}
                {f.tint && <div className="absolute inset-0" style={{ background: f.tint.color, opacity: f.tint.alpha, mixBlendMode: 'soft-light' }} />}
                {on && (
                  <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-brand text-ink-950 flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="text-[10px] text-ink-200 mt-1 truncate">{f.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
