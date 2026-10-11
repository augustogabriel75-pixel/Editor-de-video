import { useEffect, useRef, useState } from 'react';
import { Scissors, Trash2, Copy, Diamond, Gauge, Captions, WandSparkles, Magnet, ZoomIn, ZoomOut, Maximize2, LoaderCircle, ScissorsLineDashed, ChevronDown } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { IconButton, cx } from '../ui/primitives';

function ToolButton({ icon: Icon, label, shortcut, onClick, disabled, active }) {
  return (
    <button
      type="button"
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick}
      disabled={disabled}
      className={cx('flex items-center gap-1.5 h-7 px-2 rounded-md text-[11.5px] whitespace-nowrap transition-colors disabled:opacity-35', active ? 'bg-ink-600 text-white' : 'text-ink-200 hover:bg-ink-700 hover:text-white')}
    >
      <Icon size={14} />
      <span className="hidden 2xl:inline">{label}</span>
    </button>
  );
}

function SpeedMenu() {
  const clip = useEditorStore((s) => s.clips.find((c) => c.id === s.selectedClipId));
  const setSpeed = useEditorStore((s) => s.setSpeed);
  const setTab = useEditorStore((s) => s.setInspectorTab);
  const toast = useEditorStore((s) => s.toast);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, []);
  const ok = clip && (clip.kind === 'video' || clip.kind === 'audio');
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Velocidade"
        onClick={() => (ok ? setOpen(!open) : toast('Selecione um clipe de vídeo ou áudio', 'warn'))}
        className="flex items-center gap-1 h-7 px-2 rounded-md text-[11.5px] whitespace-nowrap text-ink-200 hover:bg-ink-700 hover:text-white"
      >
        <Gauge size={14} />
        <span className="hidden 2xl:inline">Velocidade</span>
        {ok && <span className="font-mono text-[10px] text-brand">{clip.speedCurve ? 'curva' : `${(clip.speed || 1).toFixed(1)}x`}</span>}
        <ChevronDown size={11} className="text-ink-400" />
      </button>
      {open && ok && (
        <div className="absolute top-8 left-0 z-50 w-44 rounded-lg bg-ink-800 border border-ink-600 shadow-xl p-1.5 grid grid-cols-3 gap-1">
          {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5].map((v) => (
            <button type="button" key={v} onClick={() => setSpeed(clip.id, v)} className={cx('py-1 rounded text-[11px]', Math.abs((clip.speed || 1) - v) < 0.01 && !clip.speedCurve ? 'bg-brand text-ink-950 font-bold' : 'bg-ink-700 hover:bg-ink-600')}>
              {v}x
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setTab('speed');
              setOpen(false);
            }}
            className="col-span-3 mt-1 py-1.5 rounded text-[11px] bg-ink-900 hover:bg-ink-700 text-ai-soft"
          >
            Curvas de velocidade…
          </button>
        </div>
      )}
    </div>
  );
}

export default function TimelineToolbar({ onFit, compact = false }) {
  const split = useEditorStore((s) => s.splitAtPlayhead);
  const del = useEditorStore((s) => s.deleteSelected);
  const dup = useEditorStore((s) => s.duplicateSelected);
  const addKf = useEditorStore((s) => s.addKeyframe);
  const openModal = useEditorStore((s) => s.openModal);
  const autoCut = useEditorStore((s) => s.autoCutSilences);
  const run = useEditorStore((s) => s.runAIAnalysis);
  const generate = useEditorStore((s) => s.generateAIMotions);
  const hasAnalysis = useEditorStore((s) => !!s.ai.analysis);
  const busy = useEditorStore((s) => s.ai.status === 'analyzing');
  const hasSel = useEditorStore((s) => !!s.selectedClipId);
  const snapping = useEditorStore((s) => s.snapping);
  const toggleSnap = useEditorStore((s) => s.toggleSnapping);
  const pps = useEditorStore((s) => s.pxPerSec);
  const setZoom = useEditorStore((s) => s.setZoom);

  return (
    <div className={cx('h-10 shrink-0 flex items-center gap-1 px-2 border-b border-ink-700 bg-ink-850', compact && 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden')}>
      <ToolButton icon={Scissors} label="Dividir" shortcut="S" onClick={split} />
      <ToolButton icon={Trash2} label="Excluir" shortcut="Del" onClick={del} disabled={!hasSel} />
      <ToolButton icon={Copy} label="Duplicar" shortcut="Ctrl+D" onClick={dup} disabled={!hasSel} />
      <div className="w-px h-5 bg-ink-700 mx-1" />
      <ToolButton icon={Diamond} label="Keyframe" shortcut="K" onClick={addKf} disabled={!hasSel} />
      <SpeedMenu />
      <div className="w-px h-5 bg-ink-700 mx-1" />
      <ToolButton icon={Captions} label="Auto-Legendas" onClick={() => openModal('captions')} />
      <ToolButton icon={ScissorsLineDashed} label="Auto Cut" onClick={() => autoCut()} />
      <button
        type="button"
        onClick={() => (hasAnalysis ? generate({ prompt: '', scope: 'all' }) : run())}
        disabled={busy}
        title="Analisar contexto e gerar Motions de IA"
        className="relative overflow-hidden ml-1 shrink-0 whitespace-nowrap flex items-center gap-1.5 h-7 px-3 rounded-md text-[11.5px] font-semibold text-white ai-gradient animate-shimmer shadow-md shadow-ai/30 disabled:opacity-60"
      >
        <span className="absolute inset-0 ai-shimmer" />
        {busy ? <LoaderCircle size={13} className="relative animate-spin" /> : <WandSparkles size={13} className="relative" />}
        <span className="relative">{compact ? 'IA' : 'Gerar Motion IA'}</span>
      </button>
      <div className="flex-1 min-w-2" />
      <IconButton icon={Magnet} label={`Snap ${snapping ? 'ligado' : 'desligado'}`} active={snapping} onClick={toggleSnap} />
      {!compact && <div className="w-px h-5 bg-ink-700 mx-1" />}
      <IconButton icon={ZoomOut} label="Diminuir zoom (-)" onClick={() => setZoom(pps / 1.25)} />
      {!compact && <input
        type="range"
        min={Math.log(8)}
        max={Math.log(260)}
        step={0.01}
        value={Math.log(pps)}
        onChange={(e) => setZoom(Math.exp(parseFloat(e.target.value)))}
        className="mc-range w-28"
        style={{ '--fill': `${((Math.log(pps) - Math.log(8)) / (Math.log(260) - Math.log(8))) * 100}%` }}
        aria-label="Zoom da timeline"
      />}
      <IconButton icon={ZoomIn} label="Aumentar zoom (+)" onClick={() => setZoom(pps * 1.25)} />
      <IconButton icon={Maximize2} label="Ajustar à janela" onClick={onFit} />
    </div>
  );
}
