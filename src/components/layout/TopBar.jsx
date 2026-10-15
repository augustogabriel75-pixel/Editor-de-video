import { Undo2, Redo2, Download, Sparkles, LoaderCircle, Keyboard, Cpu, Check, ChevronLeft, Save, CloudCheck } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { IconButton, cx } from '../ui/primitives';

function AIRenderIndicator({ compact = false }) {
  const ai = useEditorStore((s) => s.ai);
  const count = useEditorStore((s) => s.clips.reduce((n, c) => n + (c.kind === 'motion' && c.ai ? 1 : 0), 0));
  const setLeftTab = useEditorStore((s) => s.setLeftTab);
  let content;
  let tone = 'idle';
  if (ai.status === 'analyzing') {
    tone = 'busy';
    const step = ai.steps.find((s) => s.status === 'running');
    content = (
      <>
        <LoaderCircle size={14} className="animate-spin" />
        {!compact && <span className="hidden xl:inline truncate max-w-[200px]">{step?.label || 'Analisando'}</span>}
        <span className="font-mono">{Math.round(ai.progress * 100)}%</span>
      </>
    );
  } else if (ai.render) {
    tone = 'busy';
    content = (
      <>
        <Cpu size={14} className="animate-pulse" />
        {!compact && <span>Render IA</span>}
        <span className="font-mono">
          {ai.render.done}/{ai.render.total}
        </span>
      </>
    );
  } else if (count) {
    tone = 'ready';
    content = (
      <>
        <Check size={14} />
        <span>{compact ? `${count} IA` : <>{count} motions IA <span className="hidden xl:inline">renderizados</span></>}</span>
      </>
    );
  } else {
    content = (
      <>
        <Sparkles size={14} />
        <span>{compact ? 'IA' : 'IA Motion pronta'}</span>
      </>
    );
  }
  const pct = ai.status === 'analyzing' ? ai.progress : ai.render ? ai.render.done / ai.render.total : 0;
  return (
    <button
      type="button"
      onClick={() => setLeftTab('ai')}
      title="Indicador do motor de IA Motion"
      className={cx(
        'relative overflow-hidden flex items-center gap-1.5 rounded-full font-medium border transition-colors shrink-0',
        compact ? 'h-7 px-2 text-[11px]' : 'h-8 px-3 text-[12px] gap-2',
        tone === 'busy' && 'border-ai/60 text-white bg-ai/15 animate-pulse-glow',
        tone === 'ready' && 'border-emerald-400/40 text-emerald-200 bg-emerald-400/10',
        tone === 'idle' && 'border-ink-600 text-ink-200 bg-ink-800 hover:border-ai/50',
      )}
    >
      {tone === 'busy' && <span className="absolute left-0 bottom-0 h-0.5 ai-gradient transition-all" style={{ width: `${pct * 100}%` }} />}
      {content}
    </button>
  );
}

function SaveStatus({ compact }) {
  const st = useEditorStore((s) => s.saveState);
  const save = useEditorStore((s) => s.saveProject);
  const label = st === 'saving' ? 'Salvando…' : st === 'dirty' ? 'Salvar' : st === 'error' ? 'Erro ao salvar' : 'Salvo';
  return (
    <button
      type="button"
      onClick={save}
      title="Salvar projeto (Ctrl+S) — salva automaticamente"
      className={cx('shrink-0 flex items-center gap-1 rounded-md text-[11px] px-1.5 h-7', st === 'error' ? 'text-red-300' : st === 'dirty' ? 'text-amber-200 hover:bg-ink-700' : 'text-ink-300 hover:bg-ink-700')}
    >
      {st === 'saving' ? <LoaderCircle size={14} className="animate-spin" /> : st === 'dirty' ? <Save size={14} /> : <CloudCheck size={14} />}
      {!compact && <span>{label}</span>}
    </button>
  );
}

function HomeButton({ compact }) {
  const goHome = useEditorStore((s) => s.goHome);
  return (
    <button type="button" onClick={goHome} title="Meus projetos" className="shrink-0 flex items-center gap-0.5 h-8 pl-1 pr-2 rounded-lg text-ink-200 hover:bg-ink-700 hover:text-white text-[12px] font-medium">
      <ChevronLeft size={18} />
      {!compact && 'Projetos'}
    </button>
  );
}

export default function TopBar({ compact = false }) {
  const title = useEditorStore((s) => s.project.title);
  const setProject = useEditorStore((s) => s.setProject);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const openModal = useEditorStore((s) => s.openModal);

  if (compact) {
    return (
      <header className="h-11 shrink-0 flex items-center gap-1 pl-0.5 pr-1.5 bg-ink-900 border-b border-ink-700">
        <HomeButton compact />
        <input
          value={title}
          onChange={(e) => setProject({ title: e.target.value }, 'title')}
          className="flex-1 min-w-0 bg-transparent focus:bg-ink-800 rounded-md px-1.5 py-1 text-[12.5px] font-semibold text-ink-100 outline-none truncate"
          aria-label="Título do projeto"
        />
        <IconButton icon={Undo2} label="Desfazer" onClick={undo} disabled={!canUndo} />
        <IconButton icon={Redo2} label="Refazer" onClick={redo} disabled={!canRedo} />
        <SaveStatus compact />
        <AIRenderIndicator compact />
        <button
          type="button"
          onClick={() => openModal('export')}
          className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11.5px] font-bold text-ink-950 bg-gradient-to-r from-cyan-300 via-brand to-fuchsia-400"
        >
          <Download size={13} />
          Exportar
        </button>
      </header>
    );
  }

  return (
    <header className="h-12 shrink-0 flex items-center gap-3 px-3 bg-ink-900 border-b border-ink-700">
      <HomeButton />
      <div className="flex items-center gap-2 pr-2">
        <div className="relative w-8 h-8 rounded-xl bg-ink-950 border border-ink-600 flex items-center justify-center overflow-hidden">
          <svg viewBox="0 0 64 64" className="w-6 h-6">
            <defs>
              <linearGradient id="mcg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#22d3ee" />
                <stop offset="1" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            <path d="M12 48V16l12 15 12-15v32" fill="none" stroke="url(#mcg)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M43 22l10-5v30l-10-5z" fill="url(#mcg)" />
          </svg>
        </div>
        <div className="leading-none">
          <div className="text-[15px] font-extrabold tracking-tight">
            Motion<span className="ai-text">Cut</span>
          </div>
          <div className="text-[9px] text-ink-400 font-medium tracking-wider uppercase mt-0.5">Editor com IA</div>
        </div>
      </div>

      <div className="h-6 w-px bg-ink-700" />

      <input
        value={title}
        onChange={(e) => setProject({ title: e.target.value }, 'title')}
        className="w-[260px] max-w-[30vw] bg-transparent hover:bg-ink-800 focus:bg-ink-800 border border-transparent focus:border-ink-600 rounded-md px-2 py-1 text-[13px] font-medium text-ink-100 outline-none truncate"
        aria-label="Título do projeto"
      />

      <div className="flex items-center gap-0.5">
        <IconButton icon={Undo2} label="Desfazer (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
        <IconButton icon={Redo2} label="Refazer (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} />
        <SaveStatus />
      </div>

      <div className="flex-1" />

      <AIRenderIndicator />
      <IconButton icon={Keyboard} label="Atalhos de teclado" onClick={() => openModal('shortcuts')} />
      <button
        type="button"
        onClick={() => openModal('export')}
        className="relative overflow-hidden inline-flex items-center gap-2 h-8 px-4 rounded-full text-[13px] font-bold text-ink-950 bg-gradient-to-r from-cyan-300 via-brand to-fuchsia-400 hover:brightness-110 shadow-lg shadow-cyan-500/20"
      >
        <span className="absolute inset-0 ai-shimmer" />
        <Download size={15} className="relative" />
        <span className="relative">Exportar 4K Grátis</span>
      </button>
    </header>
  );
}
