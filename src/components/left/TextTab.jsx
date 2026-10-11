import { Plus, Captions, Scissors, Type } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { TEXT_STYLES, DEFAULT_TEXT_STYLE } from '../../lib/catalog';
import { PanelHeader } from './shared';
import { Button } from '../ui/primitives';

export function cssForTextStyle(st) {
  const s = { ...DEFAULT_TEXT_STYLE, ...st };
  const css = {
    fontFamily: `"${s.font}", Inter, sans-serif`,
    fontWeight: s.weight,
    color: s.color,
    textTransform: s.uppercase ? 'uppercase' : 'none',
    letterSpacing: s.letterSpacing ? `${s.letterSpacing / 2}px` : undefined,
    paintOrder: 'stroke fill',
    WebkitTextStroke: s.stroke ? `${Math.min(3, s.stroke / 2.5)}px ${s.strokeColor}` : undefined,
    textShadow: s.glow ? `0 0 8px ${s.glow}, 0 0 18px ${s.glow}` : s.shadow ? '0 2px 6px rgba(0,0,0,.65)' : 'none',
  };
  if (s.bg) Object.assign(css, { background: s.bgColor, padding: '0 6px', borderRadius: 6 });
  if (s.gradient) Object.assign(css, { backgroundImage: `linear-gradient(90deg, ${s.gradient.join(',')})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextStroke: undefined });
  return css;
}

const TEMPLATES = [
  { name: 'Título Pop', preset: 'impact', content: 'GRANDE NOVIDADE', anim: { in: { id: 'pop', duration: 0.45 }, out: { id: 'fade-out', duration: 0.35 }, loop: null } },
  { name: 'Neon Pulsante', preset: 'neon', content: 'Neon Vibes', anim: { in: { id: 'blur-in', duration: 0.6 }, out: null, loop: { id: 'pulse', duration: 0 } } },
  { name: 'Máquina de Escrever', preset: 'minimal', content: 'digitando uma ideia...', anim: { in: { id: 'typewriter', duration: 1.6 }, out: null, loop: null } },
  { name: 'Onda Divertida', preset: 'comic', content: 'UAU, QUE INCRÍVEL!', anim: { in: { id: 'wave', duration: 0.9 }, out: null, loop: { id: 'wiggle', duration: 0 } } },
  { name: 'Caixa Destaque', preset: 'box', content: 'OFERTA LIMITADA', anim: { in: { id: 'slide-up', duration: 0.4 }, out: null, loop: { id: 'heartbeat', duration: 0 } } },
  { name: 'Assinatura', preset: 'script', content: 'MotionCut', anim: { in: { id: 'fade-in', duration: 0.8 }, out: { id: 'fade-out', duration: 0.5 }, loop: null } },
];

export default function TextTab() {
  const addText = useEditorStore((s) => s.addText);
  const openModal = useEditorStore((s) => s.openModal);
  const autoCut = useEditorStore((s) => s.autoCutSilences);

  const addTemplate = (tpl) => {
    addText(tpl.preset, tpl.content);
    const st = useEditorStore.getState();
    if (st.selectedClipId) st.updateClip(st.selectedClipId, { animation: tpl.anim, name: tpl.name }, false);
  };

  return (
    <div className="pb-6">
      <PanelHeader title="Texto" subtitle="Títulos, estilos e legendas automáticas com realce palavra por palavra.">
        <Button variant="primary" icon={Plus} className="w-full" onClick={() => addText('classic')}>
          Adicionar texto
        </Button>
      </PanelHeader>

      <div className="px-4 space-y-2">
        <button
          type="button"
          onClick={() => openModal('captions')}
          className="w-full text-left relative overflow-hidden rounded-xl p-3.5 border border-ai/40 bg-gradient-to-br from-ai/20 via-ink-800 to-hot/10 hover:border-ai"
        >
          <span className="absolute inset-0 ai-shimmer opacity-40" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl ai-gradient flex items-center justify-center">
              <Captions size={18} />
            </div>
            <div>
              <div className="text-[13px] font-bold text-white">Legendas Automáticas</div>
              <div className="text-[11px] text-ink-200">Estilo TikTok/Reels · realce palavra por palavra</div>
            </div>
          </div>
        </button>
        <button type="button" onClick={() => autoCut()} className="w-full text-left rounded-xl p-3 border border-ink-600 bg-ink-800 hover:border-brand/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/15 text-brand flex items-center justify-center">
            <Scissors size={18} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-white">Auto Cut · Remover pausas</div>
            <div className="text-[11px] text-ink-300">Corta silêncios da fala em todas as trilhas (ripple)</div>
          </div>
        </button>
      </div>

      <div className="px-4 mt-5">
        <div className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold mb-2">Estilos</div>
        <div className="grid grid-cols-3 gap-2">
          {TEXT_STYLES.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => addText(s.id, s.name)}
              className="h-16 rounded-lg bg-ink-900 border border-ink-700 hover:border-brand/60 flex flex-col items-center justify-center gap-1 overflow-hidden"
              title={`Adicionar texto ${s.name}`}
            >
              <span className="text-[20px] leading-none" style={cssForTextStyle(s.style)}>
                Aa
              </span>
              <span className="text-[10px] text-ink-300">{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-5">
        <div className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold mb-2">Modelos animados</div>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => {
            const st = TEXT_STYLES.find((s) => s.id === t.preset).style;
            return (
              <button
                type="button"
                key={t.name}
                onClick={() => addTemplate(t)}
                className="group h-20 rounded-lg bg-gradient-to-br from-ink-800 to-ink-900 border border-ink-700 hover:border-brand/60 flex flex-col items-center justify-center gap-1.5 px-2"
              >
                <span className="text-[14px] leading-tight truncate max-w-full group-hover:animate-float" style={cssForTextStyle(st)}>
                  {t.content}
                </span>
                <span className="text-[10px] text-ink-300 flex items-center gap-1">
                  <Type size={10} /> {t.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
