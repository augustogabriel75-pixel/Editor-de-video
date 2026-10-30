import { useEffect, useRef, useState } from 'react';
import { Check, Upload, CopyCheck } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { LUTS, lutThumb } from '../../lib/luts';
import { cx, Slider, Button } from '../ui/primitives';
import { PanelHeader, Chips } from './shared';
import { useTargetClip, TargetHint } from './useTargetClip';

const NO_LUTS = [];

function LutCard({ lut, img, on, onPick }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    if (img) lutThumb(img, lut.id, 132).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [img, lut.id]);
  return (
    <button type="button" onClick={onPick} className="group text-left min-w-0" title={lut.desc}>
      <div className={cx('relative aspect-[4/5] rounded-lg overflow-hidden border-2 bg-ink-800', on ? 'border-brand' : 'border-transparent group-hover:border-ink-400')}>
        {src ? <img src={src} alt="" className="w-full h-full object-cover" draggable={false} /> : <div className="w-full h-full animate-pulse bg-ink-700" />}
        {on && (
          <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-brand text-ink-950 flex items-center justify-center">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
        {lut.custom && <span className="absolute bottom-1 left-1 text-[8.5px] font-bold px-1 rounded bg-black/60 text-white">.cube</span>}
      </div>
      <div className={cx('text-[10.5px] mt-1 truncate', on ? 'text-white font-semibold' : 'text-ink-200')}>{lut.name}</div>
    </button>
  );
}

export default function LutTab() {
  const apply = useEditorStore((s) => s.applyLut);
  const applyAll = useEditorStore((s) => s.applyLutToAll);
  const importLut = useEditorStore((s) => s.importLut);
  const updateDeep = useEditorStore((s) => s.updateClipDeep);
  const custom = useEditorStore((s) => s.project.customLuts) || NO_LUTS;
  const demoThumb = useEditorStore((s) => s.assets.find((a) => a.id === 'demo-presenter')?.thumb);
  const target = useTargetClip();
  const targetThumb = useEditorStore((s) => (target ? s.assets.find((a) => a.id === target.assetId)?.thumb : null));
  const img = targetThumb || demoThumb;
  const [cat, setCat] = useState('Todos');
  const fileRef = useRef(null);

  const all = [...LUTS, ...custom.map((c) => ({ ...c, category: 'Importados', custom: true, desc: 'LUT importado (.cube)' }))];
  const cats = ['Todos', ...new Set(all.filter((l) => l.id !== 'none').map((l) => l.category))];
  const shown = all.filter((l) => cat === 'Todos' || l.id === 'none' || l.category === cat);
  const current = target?.lut?.id || 'none';

  return (
    <div className="pb-6">
      <PanelHeader title="LUT" subtitle="Correção e color grading cinematográfico com LUTs 3D (GPU). Importe também seus arquivos .cube.">
        <TargetHint clip={target} what="o LUT" />
        {target && current !== 'none' && (
          <Slider
            label="Intensidade do LUT"
            value={target.lut.intensity ?? 100}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => updateDeep(target.id, 'lut', { intensity: v }, `lut:${target.id}`)}
            onReset={() => updateDeep(target.id, 'lut', { intensity: 100 })}
          />
        )}
        <div className="flex gap-2">
          <Button size="sm" icon={Upload} className="flex-1" onClick={() => fileRef.current?.click()}>
            Importar .cube
          </Button>
          <Button size="sm" icon={CopyCheck} className="flex-1" disabled={!target} onClick={applyAll}>
            Aplicar a todos
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".cube,.CUBE,text/plain"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const id = await importLut(f);
            if (id && target) apply(id);
          }}
        />
        <Chips options={cats} value={cat} onChange={setCat} />
      </PanelHeader>
      <div className="px-4 grid grid-cols-[repeat(auto-fill,minmax(78px,1fr))] gap-2">
        {shown.map((l) => (
          <LutCard key={l.id} lut={l} img={img} on={current === l.id} onPick={() => apply(l.id)} />
        ))}
      </div>
      {current !== 'none' && <p className="px-4 mt-3 text-[11px] text-ink-400">{all.find((l) => l.id === current)?.desc}</p>}
    </div>
  );
}
