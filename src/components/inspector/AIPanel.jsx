import { useState } from 'react';
import { WandSparkles, Sparkles, ScanFace, Crop, Wand2, Waves, Captions, Type, Music2, RefreshCw } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { MOTION_TEMPLATES, MOTION_CATEGORIES, getTemplate } from '../../engine/motionTemplates';
import { STYLE_LIST } from '../../engine/motionStyles';
import { iconFor } from '../ui/icons';
import { AIBadge, Section, Slider, Toggle, Button, ColorField, cx } from '../ui/primitives';
import { uid } from '../../lib/utils';

export function MotionAIPanel({ clip }) {
  const updateClip = useEditorStore((s) => s.updateClip);
  const regenerate = useEditorStore((s) => s.regenerateMotionClip);
  const toggleDisabled = useEditorStore((s) => s.toggleClipDisabled);
  const rendering = useEditorStore((s) => s.ai.render?.pending?.includes(clip.id));
  const m = clip.motion;
  const tpl = getTemplate(m.templateId);
  const cat = MOTION_CATEGORIES[tpl.category];
  const [prompt, setPrompt] = useState(m.prompt || '');
  const setMotion = (patch, key) => updateClip(clip.id, (c) => ({ motion: { ...c.motion, ...patch } }), key);

  return (
    <>
      <div className="px-4 py-3 border-b border-ink-700/70 space-y-2 bg-gradient-to-b from-ai/10 to-transparent">
        <div className="flex items-center justify-between">
          <AIBadge />
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${cat.color}22`, color: cat.color }}>
            {cat.label}
          </span>
        </div>
        <div className="text-[11.5px] text-ink-200 leading-relaxed">{rendering ? 'Renderizando motion…' : m.reason}</div>
        <div className="flex items-center gap-2 text-[10.5px] text-ink-400">
          Confiança
          <div className="flex-1 h-1.5 rounded-full bg-ink-700 overflow-hidden">
            <div className="h-full ai-gradient" style={{ width: `${(m.confidence ?? 1) * 100}%` }} />
          </div>
          <span className="font-mono text-ink-200">{Math.round((m.confidence ?? 1) * 100)}%</span>
        </div>
      </div>

      <Section title="Prompt deste motion" icon={WandSparkles} accent="ai">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Ex.: estilo neon intenso em rosa"
          className="w-full resize-none rounded-lg bg-ink-900 border border-ai/40 focus:border-ai px-2.5 py-2 text-[12px] outline-none"
        />
        <Button variant="ai" size="sm" icon={RefreshCw} className="w-full" onClick={() => regenerate(clip.id, prompt)}>
          Regenerar com prompt
        </Button>
      </Section>

      <Section title="Modelo de motion" icon={Sparkles} accent="ai">
        <div className="grid grid-cols-3 gap-1.5">
          {MOTION_TEMPLATES.filter((t) => t.category === tpl.category).map((t) => {
            const Icon = iconFor(t.icon);
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => updateClip(clip.id, (c) => ({ name: t.name, motion: { ...c.motion, templateId: t.id } }))}
                className={cx('flex flex-col items-center gap-1 rounded-lg border px-1 py-2', t.id === m.templateId ? 'border-ai bg-ai/15' : 'border-ink-700 bg-ink-900 hover:border-ink-500')}
              >
                <Icon size={15} style={{ color: cat.color }} />
                <span className="text-[9.5px] text-ink-200 text-center leading-tight">{t.name}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Estilo visual" icon={WandSparkles} accent="ai">
        <div className="flex flex-wrap gap-1.5">
          {STYLE_LIST.map((st) => {
            const on = (m.styleIds || []).includes(st.id);
            return (
              <button
                type="button"
                key={st.id}
                onClick={() => {
                  const cur = m.styleIds || [];
                  const next = on ? cur.filter((x) => x !== st.id) : [...cur, st.id];
                  setMotion({ styleIds: next.length ? next : ['vibrante'] });
                }}
                className={cx('px-2 py-1 rounded-full text-[10.5px] border', on ? 'border-ai bg-ai/25 text-white' : 'border-ink-600 text-ink-300 hover:text-white')}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: st.primary }} />
                {st.name}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <ColorField label="Cor principal" value={m.color || '#facc15'} onChange={(color) => setMotion({ color }, `mc:${clip.id}`)} />
          {m.color && (
            <button type="button" className="text-[10px] text-ink-400 hover:text-white" onClick={() => setMotion({ color: null })}>
              usar do estilo
            </button>
          )}
        </div>
        <Slider ai label="Intensidade" value={m.intensity ?? 70} min={10} max={140} suffix="%" onChange={(intensity) => setMotion({ intensity }, `mi:${clip.id}`)} />
      </Section>

      {tpl.category === 'typography' && (
        <Section title="Texto animado" icon={Type} accent="ai">
          <textarea
            value={m.text || ''}
            onChange={(e) => setMotion({ text: e.target.value }, `mt:${clip.id}`)}
            rows={2}
            className="w-full resize-none rounded-lg bg-ink-900 border border-ink-600 focus:border-ai px-2.5 py-2 text-[12px] outline-none"
          />
          <label className="block">
            <span className="text-[11px] text-ink-300">Palavras em destaque (separe por vírgula)</span>
            <input
              value={(m.highlights || []).join(', ')}
              onChange={(e) =>
                setMotion(
                  {
                    highlights: e.target.value
                      .split(',')
                      .map((w) => w.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''))
                      .filter(Boolean),
                  },
                  `mh:${clip.id}`,
                )
              }
              className="mt-1 w-full rounded-lg bg-ink-900 border border-ink-600 focus:border-ai px-2.5 py-1.5 text-[12px] outline-none"
            />
          </label>
        </Section>
      )}
      {tpl.category === 'sticker' && (
        <Section title="Rótulo" icon={Type} accent="ai">
          <input
            value={m.label || ''}
            onChange={(e) => setMotion({ label: e.target.value || null }, `ml:${clip.id}`)}
            placeholder="Sem rótulo"
            className="w-full rounded-lg bg-ink-900 border border-ink-600 focus:border-ai px-2.5 py-1.5 text-[12px] outline-none"
          />
        </Section>
      )}
      <div className="px-4 py-3">
        <Toggle ai checked={!clip.disabled} onChange={() => toggleDisabled(clip.id)} label="Motion ativo" description="Desative para comparar o antes/depois sem excluir." />
      </div>
    </>
  );
}

export function ClipAIPanel({ clip }) {
  const updateDeep = useEditorStore((s) => s.updateClipDeep);
  const updateClip = useEditorStore((s) => s.updateClip);
  const generate = useEditorStore((s) => s.generateAIMotions);
  const genCaptions = useEditorStore((s) => s.generateCaptions);
  const setAspect = useEditorStore((s) => s.setAspect);
  const analysis = useEditorStore((s) => s.ai.analysis);
  const toast = useEditorStore((s) => s.toast);
  const checkpoint = useEditorStore((s) => s.checkpoint);
  const isVisual = clip.kind === 'video' || clip.kind === 'image';
  const isText = clip.kind === 'text' || clip.kind === 'caption';

  const toTypography = () => {
    const s = useEditorStore.getState();
    const words = (clip.text.content || '').split(/\s+/);
    const longest = [...words].sort((a, b) => b.length - a.length)[0] || '';
    const norm = longest.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    checkpoint();
    const motion = {
      ...clip,
      id: uid('clip'),
      trackId: 'trk-ai-typo',
      kind: 'motion',
      name: 'Tipografia IA',
      keyframes: [],
      ai: true,
      motion: { templateId: 'kinetic-pop', category: 'typography', styleIds: ['vibrante'], intensity: 70, text: clip.text.content, highlights: [norm], reason: 'Convertido de texto para Typography Motion', confidence: 0.9 },
    };
    delete motion.text;
    s.updateClip(clip.id, { disabled: true }, false);
    useEditorStore.setState((st) => ({ clips: [...st.clips, motion], selectedClipId: motion.id }));
    toast('✨ Texto convertido em tipografia animada', 'success');
  };

  return (
    <>
      <div className="px-4 py-3 border-b border-ink-700/70 text-[11.5px] text-ink-300 leading-relaxed">
        <div className="flex items-center gap-2 mb-1 text-white font-semibold text-[12px]">
          <Wand2 size={14} className="text-ai-soft" /> Propriedades de IA
        </div>
        Ferramentas inteligentes para este clipe. {analysis ? `Contexto analisado: ${analysis.keywords.length} palavras-chave.` : 'Rode “Analisar Contexto” na aba IA Motion para sugestões.'}
      </div>
      {(isVisual || clip.kind === 'audio') && (
        <Section title="Motions para este clipe" icon={WandSparkles} accent="ai">
          <p className="text-[11px] text-ink-400">Gera stickers, tipografia, zooms e transições apenas no intervalo deste clipe.</p>
          <Button variant="ai" size="sm" icon={WandSparkles} className="w-full" onClick={() => generate({ scope: 'selection' })}>
            Gerar Motion IA neste clipe
          </Button>
        </Section>
      )}
      {isVisual && (
        <Section title="Visão computacional" icon={ScanFace} accent="ai">
          <Toggle ai checked={clip.bg.mode === 'smart'} onChange={(v) => updateDeep(clip.id, 'bg', { mode: v ? 'smart' : 'none' })} label="Recorte Inteligente (Smart Cutout)" description="Remove o fundo e mantém a pessoa." />
          <Button
            size="sm"
            icon={Crop}
            className="w-full"
            onClick={() => {
              setAspect('9:16');
              const fx = analysis?.frames?.focusX ?? 0.5;
              updateClip(clip.id, (c) => ({ transform: { ...c.transform, scale: 1.0, x: (0.5 - fx) * 0.5 } }));
              toast('Auto Reframe 9:16 aplicado (enquadramento no assunto)', 'success');
            }}
          >
            Auto Reframe para 9:16
          </Button>
          <Button
            size="sm"
            icon={Sparkles}
            className="w-full"
            onClick={() => {
              updateClip(clip.id, (c) => ({ adjust: { brightness: 4, contrast: 10, saturation: 18 }, filter: { id: c.filter.id === 'none' ? 'vivid' : c.filter.id, intensity: 45 } }));
              toast('Cor aprimorada por IA', 'success');
            }}
          >
            Aprimorar cor automaticamente
          </Button>
        </Section>
      )}
      {(clip.kind === 'audio' || clip.kind === 'video') && (
        <Section title="Áudio inteligente" icon={Waves} accent="ai">
          <Toggle ai checked={clip.audio.denoise} onChange={(denoise) => updateDeep(clip.id, 'audio', { denoise, denoiseLevel: 70 })} label="Redução de ruído IA" description="Limpa a voz automaticamente." />
          {analysis?.bpm && (
            <div className="flex items-center gap-2 text-[11px] text-ink-300">
              <Music2 size={13} className="text-brand" /> {analysis.bpm} BPM · {analysis.beats.length} batidas detectadas (marcadas na régua)
            </div>
          )}
          <Button size="sm" icon={Captions} className="w-full" onClick={() => genCaptions('tiktok')}>
            Gerar legendas automáticas
          </Button>
        </Section>
      )}
      {isText && clip.kind === 'text' && (
        <Section title="Typography Motion" icon={Type} accent="ai">
          <p className="text-[11px] text-ink-400">Converte este texto em uma tipografia cinética da IA, com destaque automático de palavra-chave.</p>
          <Button variant="ai" size="sm" icon={WandSparkles} className="w-full" onClick={toTypography}>
            Transformar em Motion IA
          </Button>
        </Section>
      )}
    </>
  );
}
