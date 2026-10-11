import { Type, Paintbrush, Captions, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { FONTS, TEXT_STYLES, CAPTION_PRESETS, DEFAULT_TEXT_STYLE } from '../../lib/catalog';
import { Section, Slider, Toggle, ColorField, SelectField, Segmented, Button, cx } from '../ui/primitives';
import { cssForTextStyle } from '../left/TextTab';

export default function TextPanel({ clip }) {
  const updateClip = useEditorStore((s) => s.updateClip);
  const checkpoint = useEditorStore((s) => s.checkpoint);
  const toast = useEditorStore((s) => s.toast);
  const st = { ...DEFAULT_TEXT_STYLE, ...clip.text.style };
  const isCaption = clip.kind === 'caption';
  const k = (p) => `txt:${clip.id}:${p}`;
  const setStyle = (patch, key) => updateClip(clip.id, (c) => ({ text: { ...c.text, style: { ...c.text.style, ...patch } } }), key);

  const applyToAllCaptions = () => {
    const s = useEditorStore.getState();
    checkpoint();
    s.clips.filter((c) => c.kind === 'caption' && c.id !== clip.id).forEach((c) => s.updateClip(c.id, (x) => ({ text: { ...x.text, style: { ...clip.text.style }, highlight: clip.text.highlight } }), false));
    toast('Estilo aplicado a todas as legendas', 'success');
  };

  return (
    <>
      <Section title={isCaption ? 'Legenda' : 'Texto'} icon={isCaption ? Captions : Type}>
        {isCaption ? (
          <div className="rounded-lg bg-ink-900 border border-ink-700 p-2 text-[12px] leading-relaxed">
            {clip.text.words.map((w, i) => (
              <span key={i} className="mr-1">
                {w.w}
                <span className="text-[9px] text-ink-400 font-mono ml-0.5">{w.start.toFixed(1)}</span>
              </span>
            ))}
          </div>
        ) : (
          <textarea
            value={clip.text.content}
            onChange={(e) => updateClip(clip.id, (c) => ({ text: { ...c.text, content: e.target.value }, name: e.target.value.slice(0, 24) || 'Texto' }), k('content'))}
            rows={3}
            className="w-full resize-none rounded-lg bg-ink-900 border border-ink-600 focus:border-brand px-2.5 py-2 text-[13px] outline-none"
          />
        )}
        <div className="grid grid-cols-5 gap-1.5">
          {TEXT_STYLES.slice(0, 10).map((p) => (
            <button
              type="button"
              key={p.id}
              title={p.name}
              onClick={() => setStyle({ ...DEFAULT_TEXT_STYLE, ...p.style, size: st.size, highlightColor: st.highlightColor, align: st.align })}
              className="h-9 rounded-md bg-ink-900 border border-ink-700 hover:border-brand/60 text-[14px] overflow-hidden"
            >
              <span style={cssForTextStyle(p.style)}>Aa</span>
            </button>
          ))}
        </div>
      </Section>

      {isCaption && (
        <Section title="Realce palavra por palavra" icon={Captions}>
          <Segmented
            size="sm"
            value={clip.text.highlight}
            onChange={(highlight) => updateClip(clip.id, (c) => ({ text: { ...c.text, highlight } }))}
            options={[
              { id: 'pop', label: 'Pop' },
              { id: 'fill', label: 'Karaokê' },
              { id: 'box', label: 'Caixa' },
              { id: 'color', label: 'Cor' },
            ]}
          />
          <ColorField label="Cor do realce" value={st.highlightColor} onChange={(highlightColor) => setStyle({ highlightColor }, k('hl'))} />
          <div className="flex gap-1.5">
            {CAPTION_PRESETS.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => updateClip(clip.id, (c) => ({ text: { ...c.text, style: { ...DEFAULT_TEXT_STYLE, ...p.style }, highlight: p.highlight, preset: p.id } }))}
                className={cx('flex-1 rounded-md border py-1 text-[10px]', clip.text.preset === p.id ? 'border-brand text-white bg-brand/10' : 'border-ink-600 text-ink-300')}
              >
                {p.name}
              </button>
            ))}
          </div>
          <Button size="sm" className="w-full" onClick={applyToAllCaptions}>
            Aplicar estilo a todas as legendas
          </Button>
        </Section>
      )}

      <Section title="Estilo" icon={Paintbrush}>
        <SelectField label="Fonte" value={st.font} onChange={(font) => setStyle({ font })} options={FONTS.map((f) => ({ value: f, label: f }))} />
        <SelectField
          label="Peso"
          value={String(st.weight)}
          onChange={(w) => setStyle({ weight: +w })}
          options={[400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) }))}
        />
        <Slider label="Tamanho" value={st.size} min={16} max={200} onChange={(size) => setStyle({ size }, k('size'))} />
        <Segmented
          size="sm"
          value={st.align}
          onChange={(align) => setStyle({ align })}
          options={[
            { id: 'left', icon: AlignLeft, label: '', title: 'Esquerda' },
            { id: 'center', icon: AlignCenter, label: '', title: 'Centro' },
            { id: 'right', icon: AlignRight, label: '', title: 'Direita' },
          ]}
        />
        <ColorField label="Cor" value={st.color} onChange={(color) => setStyle({ color, gradient: null }, k('color'))} />
        <Toggle
          checked={!!st.gradient}
          onChange={(v) => setStyle({ gradient: v ? [st.color, st.highlightColor || '#a855f7'] : null })}
          label="Preenchimento gradiente"
        />
        <Slider label="Contorno" value={st.stroke} min={0} max={16} onChange={(stroke) => setStyle({ stroke }, k('stroke'))} />
        {st.stroke > 0 && <ColorField label="Cor do contorno" value={st.strokeColor} onChange={(strokeColor) => setStyle({ strokeColor }, k('sc'))} />}
        <Toggle checked={!!st.shadow} onChange={(shadow) => setStyle({ shadow })} label="Sombra" />
        <Toggle checked={!!st.glow} onChange={(v) => setStyle({ glow: v ? '#d946ef' : null })} label="Brilho neon" />
        {st.glow && <ColorField label="Cor do brilho" value={st.glow} onChange={(glow) => setStyle({ glow }, k('glow'))} />}
        <Toggle checked={!!st.bg} onChange={(bg) => setStyle({ bg })} label="Fundo (caixa)" />
        {st.bg && <ColorField label="Cor do fundo" value={st.bgColor} onChange={(bgColor) => setStyle({ bgColor }, k('bgc'))} />}
        <Toggle checked={!!st.uppercase} onChange={(uppercase) => setStyle({ uppercase })} label="CAIXA ALTA" />
        <Slider label="Espaçamento entre letras" value={st.letterSpacing} min={0} max={20} onChange={(letterSpacing) => setStyle({ letterSpacing }, k('ls'))} />
      </Section>
    </>
  );
}
