import { useMemo, useState } from 'react';
import {
  ScanSearch, WandSparkles, LoaderCircle, CircleCheck, Circle, Music2, MessageSquareText, KeyRound, Clapperboard, Palette,
  Eye, EyeOff, Trash2, Crosshair, ChevronDown, FileText, Sparkles, RefreshCw,
} from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { parsePrompt } from '../../ai/promptParser';
import { STYLE_LIST } from '../../engine/motionStyles';
import { MOTION_TEMPLATES, MOTION_CATEGORIES, getTemplate } from '../../engine/motionTemplates';
import { formatTime } from '../../lib/utils';
import { iconFor } from '../ui/icons';
import { AIBadge, Button, Segmented, Slider, Toggle, cx } from '../ui/primitives';

function Steps() {
  const ai = useEditorStore((s) => s.ai);
  return (
    <div className="rounded-xl bg-ink-900 border border-ai/30 p-3 space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ai-soft font-semibold">Pipeline de IA</span>
        <span className="font-mono text-ink-200">{Math.round(ai.progress * 100)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
        <div className="h-full ai-gradient animate-shimmer transition-all duration-300" style={{ width: `${ai.progress * 100}%` }} />
      </div>
      <ul className="space-y-1.5 pt-1">
        {ai.steps.map((st) => (
          <li key={st.id} className={cx('flex items-center gap-2 text-[11.5px]', st.status === 'pending' ? 'text-ink-400' : st.status === 'running' ? 'text-white' : 'text-ink-200')}>
            {st.status === 'done' ? <CircleCheck size={14} className="text-emerald-400" /> : st.status === 'running' ? <LoaderCircle size={14} className="animate-spin text-ai-soft" /> : <Circle size={14} />}
            <span className="min-w-0">
              {st.label}
              {st.status === 'running' && ai.stepDetail && <span className="block text-[10.5px] text-ai-soft">{ai.stepDetail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContextSummary({ analysis }) {
  const seek = useEditorStore((s) => s.seek);
  // índice da palavra falada no playhead (muda por palavra, não por quadro)
  const activeIdx = useEditorStore((s) => analysis.transcript.words.findIndex((w) => s.currentTime >= w.start && s.currentTime < w.end + 0.05));
  const chips = [
    { icon: Music2, label: analysis.bpm ? `${analysis.bpm} BPM` : 'Sem música', title: 'Andamento detectado na trilha musical' },
    { icon: MessageSquareText, label: `${analysis.transcript.words.length} palavras`, title: `Transcrição: ${analysis.transcript.provider}` },
    { icon: KeyRound, label: `${analysis.keywords.length} palavras-chave` },
    { icon: Clapperboard, label: `${analysis.scenes.length} cortes/cenas` },
    { icon: Palette, label: analysis.frames.dominantColor, title: 'Cor dominante dos quadros' },
  ];
  const kwByTime = useMemo(() => new Map(analysis.keywords.map((k) => [k.t, k])), [analysis]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c.label} title={c.title} className="inline-flex items-center gap-1 rounded-full bg-ink-800 border border-ink-600 px-2 py-0.5 text-[10.5px] text-ink-100">
            <c.icon size={11} className="text-brand" />
            {c.label}
          </span>
        ))}
      </div>
      <div className="text-[11px] text-ink-300">
        Clima: <span className="text-white">{analysis.mood}</span>
        {analysis.topics.length > 0 && (
          <>
            {' '}
            · Tópicos: <span className="text-white">{analysis.topics.join(', ')}</span>
          </>
        )}
      </div>
      {analysis.transcript.words.length > 0 && (
        <div className="max-h-36 overflow-y-auto rounded-lg bg-ink-900 border border-ink-700 p-2.5 text-[12px] leading-relaxed">
          {analysis.transcript.words.map((w, i) => {
            const kw = kwByTime.get(w.start);
            const active = i === activeIdx;
            return (
              <span key={i}>
                <button
                  type="button"
                  onClick={() => seek(w.start)}
                  title={kw ? `${getTemplate(kw.template).name} · ${formatTime(w.start)}` : formatTime(w.start)}
                  className={cx(
                    'rounded px-0.5 transition-colors',
                    kw ? 'text-amber-300 font-semibold underline decoration-dotted underline-offset-2' : 'text-ink-200 hover:text-white',
                    active && 'bg-ai/40 text-white',
                  )}
                >
                  {w.w}
                </button>{' '}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PromptEditor() {
  const ai = useEditorStore((s) => s.ai);
  const setPrompt = useEditorStore((s) => s.setAIPrompt);
  const generate = useEditorStore((s) => s.generateAIMotions);
  const parsed = useMemo(() => parsePrompt(ai.prompt), [ai.prompt]);
  const [scope, setScope] = useState(null);
  const effScope = scope || parsed.scope;
  const busy = ai.status === 'analyzing';

  const toggleStyleWord = (st) => {
    const w = st.words[0];
    const has = parsed.styleIds.includes(st.id);
    if (has) {
      const re = new RegExp(`\\s*\\b(${st.words.join('|')})\\b`, 'gi');
      setPrompt(ai.prompt.replace(re, '').replace(/\s{2,}/g, ' ').trim());
    } else if (/estilo/i.test(ai.prompt)) setPrompt(ai.prompt.replace(/estilo/i, `estilo ${w}`));
    else setPrompt(`${ai.prompt.trim()} estilo ${w}`.trim());
  };

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <textarea
          value={ai.prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Ex.: Gere um motion estilo minimalista futurista para a fala atual"
          className="w-full resize-none rounded-xl bg-ink-900 border border-ai/40 focus:border-ai focus:ring-2 focus:ring-ai/20 px-3 py-2.5 text-[12.5px] leading-relaxed outline-none placeholder:text-ink-400"
        />
        <WandSparkles size={14} className="absolute right-2.5 bottom-2.5 text-ai-soft pointer-events-none" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STYLE_LIST.map((st) => {
          const on = parsed.styleIds.includes(st.id);
          return (
            <button
              type="button"
              key={st.id}
              onClick={() => toggleStyleWord(st)}
              className={cx('px-2 py-0.5 rounded-full text-[10.5px] border transition-colors', on ? 'border-ai bg-ai/25 text-white' : 'border-ink-600 text-ink-300 hover:text-white hover:border-ink-400')}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: st.primary }} />
              {st.name}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1">
        {parsed.chips.map((c) => (
          <span key={c.k} className="text-[10px] rounded-md bg-ink-800 border border-ink-700 px-1.5 py-0.5 text-ink-300">
            {c.k}: <span className="text-ink-100">{c.k === 'Cor' ? <span className="inline-block w-2.5 h-2.5 rounded-sm align-middle" style={{ background: c.v }} /> : c.v}</span>
          </span>
        ))}
      </div>
      <Segmented
        ai
        size="sm"
        value={effScope}
        onChange={setScope}
        options={[
          { id: 'current', label: 'Fala atual', icon: Crosshair },
          { id: 'all', label: 'Vídeo inteiro', icon: Clapperboard },
          { id: 'selection', label: 'Clipe selecionado' },
        ]}
      />
      <Button variant="ai" icon={busy ? LoaderCircle : WandSparkles} className="w-full" disabled={busy} onClick={() => generate({ prompt: ai.prompt, scope: effScope })}>
        Gerar Motion IA com este prompt
      </Button>
    </div>
  );
}

function GeneratedList() {
  const clips = useEditorStore((s) => s.clips);
  const pending = useEditorStore((s) => s.ai.render?.pending);
  const selectedId = useEditorStore((s) => s.selectedClipId);
  const select = useEditorStore((s) => s.select);
  const seek = useEditorStore((s) => s.seek);
  const toggle = useEditorStore((s) => s.toggleClipDisabled);
  const clear = useEditorStore((s) => s.clearAIMotions);
  const list = useMemo(() => clips.filter((c) => c.kind === 'motion').sort((a, b) => a.start - b.start), [clips]);
  const [filter, setFilter] = useState('all');
  const shown = filter === 'all' ? list : list.filter((c) => c.motion.category === filter);
  if (!list.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-white flex items-center gap-2">
          Motions gerados <span className="text-[10px] font-mono bg-ai/25 text-ai-soft rounded px-1.5">{list.length}</span>
        </div>
        <button type="button" onClick={clear} className="text-[11px] text-ink-300 hover:text-red-300 flex items-center gap-1">
          <Trash2 size={12} /> Limpar
        </button>
      </div>
      <div className="flex gap-1">
        {[['all', 'Todos'], ...Object.entries(MOTION_CATEGORIES).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <button
            type="button"
            key={k}
            onClick={() => setFilter(k)}
            className={cx('px-2 py-0.5 rounded text-[10px]', filter === k ? 'bg-ink-100 text-ink-950 font-semibold' : 'bg-ink-800 text-ink-300 hover:text-white')}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="space-y-1.5">
        {shown.map((c) => {
          const tpl = getTemplate(c.motion.templateId);
          const Icon = iconFor(tpl.icon);
          const color = MOTION_CATEGORIES[tpl.category].color;
          const rendering = pending?.includes(c.id);
          return (
            <li
              key={c.id}
              onClick={() => {
                select(c.id);
                seek(c.start + 0.05);
              }}
              className={cx(
                'group relative overflow-hidden flex gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors',
                selectedId === c.id ? 'border-ai bg-ai/10' : 'border-ink-700 bg-ink-800/60 hover:border-ink-500',
                c.disabled && 'opacity-45',
              )}
            >
              {rendering && <span className="absolute inset-0 ai-shimmer" />}
              <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center" style={{ background: `${color}26`, color }}>
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11.5px] text-white font-medium truncate">{c.name}</span>
                  <span className="text-[10px] font-mono text-ink-400 shrink-0">{formatTime(c.start)}</span>
                </div>
                <div className="text-[10.5px] text-ink-300 truncate" title={c.motion.reason}>
                  {rendering ? 'Renderizando…' : c.motion.reason}
                </div>
                <div className="mt-1 h-1 rounded-full bg-ink-700 overflow-hidden" title={`Confiança ${Math.round((c.motion.confidence ?? 1) * 100)}%`}>
                  <div className="h-full rounded-full" style={{ width: `${(c.motion.confidence ?? 1) * 100}%`, background: color }} />
                </div>
              </div>
              <button
                type="button"
                title={c.disabled ? 'Ativar' : 'Desativar'}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(c.id);
                }}
                className="self-center p-1 rounded text-ink-300 hover:text-white hover:bg-ink-600"
              >
                {c.disabled ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Collapsible({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-800/40">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2.5 text-[12px] font-semibold text-ink-100">
        <span className="flex items-center gap-2">
          {Icon && <Icon size={14} className="text-ai-soft" />}
          {title}
        </span>
        <ChevronDown size={14} className={cx('text-ink-400 transition-transform', !open && '-rotate-90')} />
      </button>
      {open && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

export default function AIMotionTab() {
  const ai = useEditorStore((s) => s.ai);
  const run = useEditorStore((s) => s.runAIAnalysis);
  const setOpt = useEditorStore((s) => s.setAIOption);
  const setScript = useEditorStore((s) => s.setAIScript);
  const addMotion = useEditorStore((s) => s.addMotionFromLibrary);
  const busy = ai.status === 'analyzing';
  const o = ai.options;

  return (
    <div className="pb-8">
      <div className="relative overflow-hidden px-4 pt-4 pb-4 border-b border-ai/20 bg-gradient-to-b from-ai/15 via-transparent to-transparent">
        <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-hot/20 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-2">
          <AIBadge>IA Motion Contextual</AIBadge>
        </div>
        <h2 className="relative text-[16px] font-extrabold text-white mt-2 leading-tight">
          Motions gerados pelo <span className="ai-text">contexto</span> do seu vídeo
        </h2>
        <p className="relative text-[11.5px] text-ink-300 mt-1 leading-relaxed">
          A IA lê a fala (speech-to-text) e os quadros, detecta batidas e ênfase e cria stickers animados, tipografia com destaques, zooms de câmera e transições no
          ritmo.
        </p>
        <Button variant="ai" size="lg" icon={busy ? LoaderCircle : ScanSearch} className={cx('w-full mt-3', busy && '[&>svg]:animate-spin')} disabled={busy} onClick={() => run()}>
          {busy ? 'Analisando contexto…' : ai.analysis ? 'Reanalisar e regenerar motions' : 'Analisar Contexto do Vídeo'}
        </Button>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {busy && <Steps />}
        {ai.status === 'error' && <div className="text-[12px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">Erro: {ai.error}</div>}

        {ai.analysis && !busy && (
          <Collapsible title="Contexto detectado" icon={Sparkles} defaultOpen>
            <ContextSummary analysis={ai.analysis} />
          </Collapsible>
        )}

        <div className="rounded-xl border border-ai/30 bg-ink-800/50 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-semibold text-white flex items-center gap-2">
              <WandSparkles size={14} className="text-ai-soft" /> Prompt da IA
            </div>
            {!ai.analysis && <span className="text-[10px] text-ink-400">analisa automaticamente</span>}
          </div>
          <PromptEditor />
        </div>

        <GeneratedList />

        <Collapsible title="Opções de geração" icon={RefreshCw}>
          <Toggle ai checked={o.stickers} onChange={(v) => setOpt('stickers', v)} label="Stickers & gráficos animados" description="Ex.: “dinheiro” → moedas 3D caindo" />
          <Toggle ai checked={o.typography} onChange={(v) => setOpt('typography', v)} label="Typography Motion" description="Frases-chave com realce de cor nas palavras" />
          <Toggle ai checked={o.camera} onChange={(v) => setOpt('camera', v)} label="Zooms & movimentos de câmera" description="Punch-zoom nos picos de ênfase da fala" />
          <Toggle ai checked={o.transitions} onChange={(v) => setOpt('transitions', v)} label="Transições na batida" description="Flash/glitch sincronizados com cortes e beats" />
          <Toggle ai checked={o.sfx} onChange={(v) => setOpt('sfx', v)} label="Efeitos sonoros sincronizados" description="Whoosh, caixa registradora, ding…" />
          <Slider ai label="Intensidade" value={o.intensity} min={20} max={130} suffix="%" onChange={(v) => setOpt('intensity', v)} />
          <label className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-ink-300">Idioma da fala</span>
            <select value={o.sttLanguage} onChange={(e) => setOpt('sttLanguage', e.target.value)} className="bg-ink-850 border border-ink-600 rounded-md text-[12px] px-2 py-1.5 outline-none focus:border-ai">
              <option value="portuguese">Português</option>
              <option value="english">Inglês</option>
              <option value="spanish">Espanhol</option>
              <option value="auto">Detectar automaticamente</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-ink-300">Modelo de fala</span>
            <select value={o.sttModel} onChange={(e) => setOpt('sttModel', e.target.value)} className="bg-ink-850 border border-ink-600 rounded-md text-[12px] px-2 py-1.5 outline-none focus:border-ai">
              <option value="base">Preciso (~80 MB)</option>
              <option value="tiny">Rápido (~40 MB)</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-ink-300">Estilo padrão</span>
            <select value={o.styleId} onChange={(e) => setOpt('styleId', e.target.value)} className="bg-ink-850 border border-ink-600 rounded-md text-[12px] px-2 py-1.5 outline-none focus:border-ai">
              <option value="auto">Automático (pelo contexto)</option>
              {STYLE_LIST.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </Collapsible>

        <Collapsible title="Transcrição / roteiro (opcional)" icon={FileText} defaultOpen={ai.analysis?.transcript?.source === 'none'}>
          <p className="text-[11px] text-ink-400 leading-relaxed">
            A fala dos vídeos importados é transcrita automaticamente pelo Whisper no próprio aparelho (na 1ª vez o modelo de ~40 MB é baixado e fica salvo). Se preferir, cole o roteiro aqui e ele será alinhado à voz.
          </p>
          <textarea
            value={ai.scriptText}
            onChange={(e) => setScript(e.target.value)}
            rows={4}
            placeholder="Cole aqui o texto falado no vídeo…"
            className="w-full resize-none rounded-lg bg-ink-900 border border-ink-600 focus:border-ai px-2.5 py-2 text-[12px] outline-none"
          />
        </Collapsible>

        <Collapsible title="Biblioteca de motions (manual)" icon={Sparkles}>
          {Object.entries(MOTION_CATEGORIES).map(([cat, meta]) => (
            <div key={cat}>
              <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: meta.color }}>
                {meta.label}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MOTION_TEMPLATES.filter((m) => m.category === cat).map((m) => {
                  const Icon = iconFor(m.icon);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => addMotion(m.id)}
                      title={`Adicionar “${m.name}” no playhead`}
                      className="flex flex-col items-center gap-1 rounded-lg bg-ink-900 border border-ink-700 hover:border-ai/60 px-1 py-2"
                    >
                      <Icon size={16} style={{ color: meta.color }} />
                      <span className="text-[9.5px] text-ink-200 text-center leading-tight">{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Collapsible>
      </div>
    </div>
  );
}
