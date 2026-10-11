import { Eraser, Pipette, SlidersHorizontal, Zap, Blend, Shuffle, X, ScanFace, Palette } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { getEffect, getFilter, getTransition } from '../../lib/catalog';
import { Section, Slider, Segmented, ColorField, SelectField, IconButton } from '../ui/primitives';
import TransformSection from './TransformSection';

export default function VideoPanel({ clip }) {
  const updateDeep = useEditorStore((s) => s.updateClipDeep);
  const update = useEditorStore((s) => s.updateClip);
  const setFxI = useEditorStore((s) => s.setEffectIntensity);
  const toggleEffect = useEditorStore((s) => s.toggleEffect);
  const isOverlay = useEditorStore((s) => s.tracks.find((t) => t.id === clip.trackId)?.kind === 'overlay');
  const bg = clip.bg;
  const k = (p) => `${p}:${clip.id}`;

  const eyedrop = async () => {
    if (!('EyeDropper' in window)) return;
    try {
      const res = await new window.EyeDropper().open();
      updateDeep(clip.id, 'bg', { color: res.sRGBHex });
    } catch {
      /* cancelado */
    }
  };

  return (
    <>
      <TransformSection clip={clip} />

      {isOverlay && (
        <Section title="Mistura" icon={Blend}>
          <SelectField
            label="Modo"
            value={clip.blend || 'normal'}
            onChange={(v) => update(clip.id, { blend: v })}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'screen', label: 'Tela (Screen)' },
              { value: 'multiply', label: 'Multiplicar' },
              { value: 'overlay', label: 'Sobrepor' },
              { value: 'lighten', label: 'Clarear' },
              { value: 'darken', label: 'Escurecer' },
              { value: 'add', label: 'Adição' },
            ]}
          />
        </Section>
      )}

      <Section title="Remoção de Fundo" icon={Eraser}>
        <Segmented
          size="sm"
          value={bg.mode}
          onChange={(mode) => updateDeep(clip.id, 'bg', { mode })}
          options={[
            { id: 'none', label: 'Nenhum' },
            { id: 'chroma', label: 'Chroma Key' },
            { id: 'smart', label: 'Recorte IA', icon: ScanFace },
          ]}
        />
        {bg.mode === 'chroma' && (
          <>
            <div className="flex items-center gap-2">
              <ColorField label="Cor-chave" value={bg.color} onChange={(color) => updateDeep(clip.id, 'bg', { color }, k('bgc'))} />
              <div className="flex-1" />
              {['#16c75a', '#0047bb'].map((c) => (
                <button type="button" key={c} title={c} onClick={() => updateDeep(clip.id, 'bg', { color: c })} className="w-6 h-6 rounded-md border border-ink-500" style={{ background: c }} />
              ))}
              {'EyeDropper' in window && <IconButton icon={Pipette} label="Conta-gotas (escolher cor da tela)" onClick={eyedrop} />}
            </div>
            <Slider label="Intensidade (similaridade)" value={bg.similarity} min={0} max={100} onChange={(v) => updateDeep(clip.id, 'bg', { similarity: v }, k('sim'))} />
            <Slider label="Suavização da borda" value={bg.smoothness} min={0} max={100} onChange={(v) => updateDeep(clip.id, 'bg', { smoothness: v }, k('smo'))} />
            <Slider label="Remover reflexo (spill)" value={bg.spill} min={0} max={100} onChange={(v) => updateDeep(clip.id, 'bg', { spill: v }, k('spill'))} />
          </>
        )}
        {bg.mode === 'smart' && (
          <p className="text-[11px] text-ink-300 leading-relaxed">
            <span className="text-ai-soft font-semibold">Smart Cutout IA:</span> segmenta a pessoa e remove o fundo automaticamente. Nas mídias demo usa a máscara exata do
            apresentador; em vídeos importados aplica uma máscara de segmentação suave (plugue MediaPipe Selfie Segmentation para matting real).
          </p>
        )}
      </Section>

      <Section title="Ajustes de cor" icon={SlidersHorizontal} defaultOpen={false}>
        <Slider label="Brilho" value={clip.adjust.brightness} min={-50} max={50} onChange={(v) => updateDeep(clip.id, 'adjust', { brightness: v }, k('br'))} onReset={() => updateDeep(clip.id, 'adjust', { brightness: 0 })} />
        <Slider label="Contraste" value={clip.adjust.contrast} min={-50} max={50} onChange={(v) => updateDeep(clip.id, 'adjust', { contrast: v }, k('ct'))} onReset={() => updateDeep(clip.id, 'adjust', { contrast: 0 })} />
        <Slider label="Saturação" value={clip.adjust.saturation} min={-100} max={100} onChange={(v) => updateDeep(clip.id, 'adjust', { saturation: v }, k('sat'))} onReset={() => updateDeep(clip.id, 'adjust', { saturation: 0 })} />
      </Section>

      {clip.filter.id !== 'none' && (
        <Section title={`Filtro · ${getFilter(clip.filter.id).name}`} icon={Palette} right={<IconButton icon={X} size={13} label="Remover filtro" onClick={() => updateDeep(clip.id, 'filter', { id: 'none' })} />}>
          <Slider label="Intensidade" value={clip.filter.intensity} min={0} max={100} suffix="%" onChange={(v) => updateDeep(clip.id, 'filter', { intensity: v }, k('fi'))} />
        </Section>
      )}

      {clip.effects.length > 0 && (
        <Section title={`Efeitos (${clip.effects.length})`} icon={Zap}>
          {clip.effects.map((e) => (
            <div key={e.id} className="flex items-end gap-2">
              <div className="flex-1">
                <Slider label={getEffect(e.id)?.name || e.id} value={e.intensity} min={0} max={100} suffix="%" onChange={(v) => setFxI(clip.id, e.id, v)} />
              </div>
              <IconButton icon={X} size={13} label="Remover efeito" onClick={() => toggleEffect(e.id)} />
            </div>
          ))}
        </Section>
      )}

      {clip.transitionIn && (
        <Section title={`Transição · ${getTransition(clip.transitionIn.id)?.name}`} icon={Shuffle} right={<IconButton icon={X} size={13} label="Remover transição" onClick={() => update(clip.id, { transitionIn: null })} />}>
          <Slider label="Duração" value={clip.transitionIn.duration} min={0.1} max={2} step={0.05} suffix="s" format={(v) => v.toFixed(2)} onChange={(v) => updateDeep(clip.id, 'transitionIn', { duration: v }, k('trd'))} />
        </Section>
      )}
    </>
  );
}
