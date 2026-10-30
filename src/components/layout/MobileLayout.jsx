import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ChevronLeft,
  Scissors,
  Gauge,
  Volume2,
  Clapperboard,
  Zap,
  Palette,
  Aperture,
  SlidersHorizontal,
  Shuffle,
  AudioLines,
  Diamond,
  Copy,
  Trash2,
  WandSparkles,
  Type,
  Move,
  Captions,
  Settings2,
} from 'lucide-react';
import { useEditorStore, selectSelectedClip } from '../../store/useEditorStore';
import TopBar from './TopBar';
import PreviewPlayer from '../preview/PreviewPlayer';
import MobileTimeline from '../timeline/MobileTimeline';
import Timeline from '../timeline/Timeline';
import { InspectorPanel } from '../inspector/Inspector';
import ProjectPanel from '../inspector/ProjectPanel';
import { PANEL_TABS, PanelTabBody } from '../left/LeftPanel';
import { getAspect } from '../../lib/catalog';
import { cx } from '../ui/primitives';

function BottomSheet({ title, ai, onClose, children, bottom, height, left = 0 }) {
  return (
    <div style={{ bottom, height, left }} className="fixed right-0 z-40 flex flex-col rounded-t-2xl bg-ink-850 border-t border-ink-600 shadow-[0_-18px_40px_rgba(0,0,0,.55)] animate-[sheet-in_.18s_ease-out]">
      <div className="shrink-0 flex items-center justify-between pl-4 pr-2 pt-2 pb-1.5 border-b border-ink-700">
        <div className="absolute left-1/2 -translate-x-1/2 top-1.5 w-10 h-1 rounded-full bg-ink-500" />
        <span className={cx('text-[14px] font-bold mt-1', ai ? 'ai-text' : 'text-white')}>{title}</span>
        <button type="button" onClick={onClose} aria-label="Fechar" className="mt-1 p-2 rounded-full text-ink-300 active:bg-ink-700">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}

// abas em que é preciso ver o vídeo enquanto escolhe: o painel cobre só a timeline
const VISUAL_SHEETS = new Set(['lut', 'filters', 'effects', 'transitions']);

const tab = (id) => PANEL_TABS.find((t) => t.id === id);

/** Ferramentas da barra inferior quando um clipe está selecionado (como no CapCut). */
function clipTools(clip, asset) {
  const T = {
    split: { id: 'split', label: 'Dividir', icon: Scissors, action: (s) => s.splitAtPlayhead() },
    speed: { id: 'speed', label: 'Velocidade', icon: Gauge, panel: 'speed' },
    volume: { id: 'volume', label: 'Volume', icon: Volume2, panel: 'audio' },
    anim: { id: 'anim', label: 'Animações', icon: Clapperboard, panel: 'anim' },
    effects: { id: 'effects', label: 'Efeitos', icon: Zap, sheetTab: 'effects' },
    filters: { id: 'filters', label: 'Filtros', icon: Palette, sheetTab: 'filters' },
    lut: { id: 'lut', label: 'LUT', icon: Aperture, sheetTab: 'lut' },
    adjust: { id: 'adjust', label: 'Ajustar', icon: SlidersHorizontal, panel: 'video' },
    transition: { id: 'transition', label: 'Transição', icon: Shuffle, sheetTab: 'transitions' },
    extract: { id: 'extract', label: 'Extrair áudio', icon: AudioLines, action: (s) => s.extractAudio() },
    keyframe: { id: 'keyframe', label: 'Keyframe', icon: Diamond, action: (s) => s.addKeyframe() },
    dup: { id: 'dup', label: 'Duplicar', icon: Copy, action: (s) => s.duplicateSelected() },
    del: { id: 'del', label: 'Excluir', icon: Trash2, action: (s) => s.deleteSelected(), danger: true },
    ai: { id: 'ai', label: 'IA', icon: WandSparkles, panel: 'ai', ai: true },
    editText: { id: 'editText', label: 'Editar', icon: Type, panel: 'text' },
    pos: { id: 'pos', label: 'Posição', icon: Move, panel: 'transform' },
    motion: { id: 'motion', label: 'Motion IA', icon: WandSparkles, panel: 'motion', ai: true },
  };
  switch (clip.kind) {
    case 'video':
      return [T.split, T.speed, ...(asset?.hasAudio ? [T.volume] : []), T.anim, T.lut, T.filters, T.effects, T.adjust, T.transition, ...(asset?.hasAudio ? [T.extract] : []), T.keyframe, T.ai, T.dup, T.del];
    case 'image':
      return [T.split, T.anim, T.lut, T.filters, T.effects, T.adjust, T.transition, T.keyframe, T.ai, T.dup, T.del];
    case 'audio':
      return [T.split, T.volume, T.speed, T.ai, T.dup, T.del];
    case 'text':
    case 'caption':
      return [T.editText, T.split, T.anim, T.pos, T.keyframe, T.dup, T.del];
    case 'motion':
      return [T.motion, T.pos, T.dup, T.del];
    default:
      return [T.dup, T.del];
  }
}

const MAIN_TOOLS = [
  ...['media', 'audio', 'text'].map((id) => ({ ...tab(id), sheetTab: id })),
  { id: 'captions', label: 'Legendas', icon: Captions, action: (s) => s.openModal('captions') },
  ...['lut', 'filters', 'effects', 'transitions'].map((id) => ({ ...tab(id), sheetTab: id })),
  { ...tab('ai'), sheetTab: 'ai' },
  { id: 'project', label: 'Projeto', icon: Settings2, project: true },
];

function ToolButton({ t, active, onClick, landscape }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'shrink-0 flex items-center justify-center font-medium whitespace-nowrap active:opacity-70',
        landscape ? 'flex-row gap-1.5 px-3 py-2 text-[11px]' : 'flex-col gap-1 w-[66px] pt-2 pb-1.5 text-[10.5px]',
        active ? 'text-white' : t.danger ? 'text-red-300' : t.ai ? 'text-ai-soft' : 'text-ink-200',
      )}
    >
      <span className={cx('w-9 h-8 rounded-xl flex items-center justify-center', active && (t.ai ? 'ai-gradient' : 'bg-ink-600'), !active && t.ai && 'bg-ai/15')}>
        <t.icon size={19} strokeWidth={1.8} />
      </span>
      {t.label}
    </button>
  );
}

/** Layout para celulares (estilo CapCut mobile). */
export default function MobileLayout() {
  // sheet: { kind: 'tab'|'panel'|'project', id, title, ai }
  const [sheet, setSheet] = useState(null);
  const sheetRef = useRef(null);
  const clip = useEditorStore(selectSelectedClip);
  const asset = useEditorStore((s) => (clip?.assetId ? s.assets.find((a) => a.id === clip.assetId) : null));
  const aspectId = useEditorStore((s) => s.project.aspect);
  const [vw, setVw] = useState(() => window.innerWidth);
  const [vh, setVh] = useState(() => window.innerHeight);
  sheetRef.current = sheet;

  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // painel de ferramenta do clipe fecha quando a seleção some
  const clipId = clip?.id;
  useEffect(() => {
    if (!clipId && sheetRef.current?.kind === 'panel') setSheet(null);
  }, [clipId]);

  useEffect(() => {
    window.MotionCutBack = () => {
      const s = useEditorStore.getState();
      if (s.modal) {
        s.closeModal();
        return true;
      }
      if (sheetRef.current) {
        setSheet(null);
        return true;
      }
      if (s.isPlaying) {
        s.pause();
        return true;
      }
      if (s.selectedClipId) {
        s.select(null);
        return true;
      }
      s.goHome();
      return true;
    };
  }, []);

  const navRef = useRef(null);
  const [navH, setNavH] = useState(64);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNavH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tlRef = useRef(null);
  const [tlH, setTlH] = useState(300);
  useEffect(() => {
    const el = tlRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTlH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  });

  const landscape = vw > vh && vh < 600;
  // a timeline compacta deixa o preview maior (até ~48% da tela)
  const a = getAspect(aspectId);
  const previewH = Math.round(Math.min(vh * 0.48, Math.max(170, ((vw - 12) * a.h) / a.w + 10)));
  const tabSheetH = Math.round(Math.max(240, Math.min(vh * 0.6, vh - navH - 140)));
  const panelSheetH = Math.round(Math.max(220, Math.min(vh * 0.46, vh - navH - 160)));

  const tools = useMemo(() => (clip ? clipTools(clip, asset) : MAIN_TOOLS), [clip?.kind, clip?.id, asset?.hasAudio]); // eslint-disable-line react-hooks/exhaustive-deps

  const runTool = (t) => {
    const s = useEditorStore.getState();
    if (t.action) {
      setSheet(null);
      t.action(s);
      return;
    }
    const next = t.panel ? { kind: 'panel', id: t.panel, key: t.id } : t.project ? { kind: 'project', id: 'project', key: t.id } : { kind: 'tab', id: t.sheetTab, key: t.id };
    if (sheet?.key === t.id) return setSheet(null);
    setSheet({ ...next, title: t.label, ai: t.ai });
  };

  const sheetNode = sheet && (
    <BottomSheet
      title={sheet.title}
      ai={sheet.ai}
      onClose={() => setSheet(null)}
      bottom={navH}
      height={landscape ? vh - navH - 44 : VISUAL_SHEETS.has(sheet.id) || sheet.kind === 'panel' ? Math.max(210, Math.min(tlH, sheet.kind === 'panel' ? panelSheetH : tabSheetH)) : tabSheetH}
      left={landscape ? '46%' : 0}
    >
      {sheet.kind === 'panel' ? <InspectorPanel tab={sheet.id} /> : sheet.kind === 'project' ? <ProjectPanel /> : <PanelTabBody id={sheet.id} />}
    </BottomSheet>
  );

  const openTabSheet = (id) => {
    const t = tab(id);
    setSheet({ kind: 'tab', id, key: id, title: t?.label, ai: t?.ai });
  };

  return (
    <div className="h-full flex flex-col bg-ink-950 text-ink-100">
      <TopBar compact />
      {landscape ? (
        <div className="flex-1 min-h-0 flex">
          <div className="w-[46%] shrink-0 flex flex-col border-r border-ink-700">
            <PreviewPlayer compact />
          </div>
          <div className="relative flex-1 min-w-0 flex flex-col">
            <Timeline />
          </div>
          {sheetNode}
        </div>
      ) : (
        <>
          <div className="shrink-0 flex flex-col" style={{ height: previewH + 44 }}>
            <PreviewPlayer compact />
          </div>
          <div ref={tlRef} className="relative flex-1 min-h-0 flex flex-col border-t border-ink-800">
            <MobileTimeline onOpenSheet={openTabSheet} />
            {sheetNode}
          </div>
        </>
      )}
      <nav ref={navRef} className="shrink-0 flex items-stretch bg-ink-900 border-t border-ink-700 pb-[env(safe-area-inset-bottom)]">
        {clip && (
          <button type="button" aria-label="Voltar" onClick={() => (setSheet(null), useEditorStore.getState().select(null))} className="shrink-0 w-11 my-1.5 ml-1 rounded-lg bg-ink-800 flex items-center justify-center text-ink-200 active:bg-ink-700">
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="flex-1 min-w-0 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" key={clip ? `clip-${clip.kind}` : 'main'}>
          {tools.map((t) => (
            <ToolButton key={t.id} t={t} landscape={landscape} active={sheet?.key === t.id} onClick={() => runTool(t)} />
          ))}
        </div>
      </nav>
    </div>
  );
}
