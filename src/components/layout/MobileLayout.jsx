import { useEffect, useRef, useState } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import TopBar from './TopBar';
import PreviewPlayer from '../preview/PreviewPlayer';
import Timeline from '../timeline/Timeline';
import Inspector from '../inspector/Inspector';
import { PANEL_TABS, PanelTabBody } from '../left/LeftPanel';
import { getAspect } from '../../lib/catalog';
import { cx } from '../ui/primitives';

const NAV = [{ id: 'edit', label: 'Editar', icon: SlidersHorizontal }, ...PANEL_TABS];

function BottomSheet({ title, ai, onClose, children, bottom, height, left = 0 }) {
  return (
    <div style={{ bottom, height, left }} className="fixed right-0 z-40 flex flex-col rounded-t-2xl bg-ink-850 border-t border-ink-600 shadow-[0_-18px_40px_rgba(0,0,0,.55)] animate-[sheet-in_.18s_ease-out]">
      <div className="shrink-0 flex items-center justify-between pl-4 pr-2 pt-2 pb-1.5 border-b border-ink-700">
        <div className="absolute left-1/2 -translate-x-1/2 top-1.5 w-10 h-1 rounded-full bg-ink-500" />
        <span className={cx('text-[13px] font-bold mt-1', ai ? 'ai-text' : 'text-white')}>{title}</span>
        <button type="button" onClick={onClose} aria-label="Fechar" className="mt-1 p-2 rounded-full text-ink-300 active:bg-ink-700">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}

/** Layout para celulares (estilo CapCut mobile). */
export default function MobileLayout() {
  const [sheet, setSheet] = useState(null);
  const sheetRef = useRef(null);
  const hasSelection = useEditorStore((s) => !!s.selectedClipId);
  const aspectId = useEditorStore((s) => s.project.aspect);
  const [userH, setUserH] = useState(null);
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

  // Altura do preview segue a proporção do vídeo (até 42% da tela), salvo se o usuário arrastar o divisor.
  const a = getAspect(aspectId);
  const fitH = Math.round(Math.min(vh * 0.42, Math.max(150, ((vw - 12) * a.h) / a.w + 10)));
  const previewH = userH ?? fitH;
  const setPreviewH = setUserH;

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
      return false;
    };
  }, []);

  const meta = NAV.find((n) => n.id === sheet);
  const navRef = useRef(null);
  const [navH, setNavH] = useState(58);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNavH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const sheetH = Math.round(Math.max(220, Math.min(vh * 0.62, vh - navH - 150)));

  const landscape = vw > vh && vh < 600;
  const sheetNode = sheet && (
    <BottomSheet title={meta?.label} ai={meta?.ai} onClose={() => setSheet(null)} bottom={navH} height={landscape ? vh - navH - 44 : sheetH} left={landscape ? '46%' : 0}>
      {sheet === 'edit' ? <Inspector embedded /> : <PanelTabBody id={sheet} />}
    </BottomSheet>
  );

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
      <div
        className="h-3 shrink-0 flex items-center justify-center bg-ink-950 touch-none"
        onPointerDown={(e) => {
          const y0 = e.clientY;
          const h0 = previewH;
          const move = (ev) => setPreviewH(Math.max(140, Math.min(window.innerHeight * 0.6, h0 + ev.clientY - y0)));
          const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}
      >
        <span className="w-12 h-1 rounded-full bg-ink-600" />
      </div>
      <div className="relative flex-1 min-h-0 flex flex-col">
        <Timeline />
        {sheetNode}
      </div>
        </>
      )}
      <nav ref={navRef} className="shrink-0 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-ink-900 border-t border-ink-700 pb-[env(safe-area-inset-bottom)]">
        {NAV.map((n) => {
          const active = sheet === n.id;
          const dot = n.id === 'edit' && hasSelection;
          return (
            <button
              type="button"
              key={n.id}
              onClick={() => setSheet(active ? null : n.id)}
              className={cx('relative min-w-[46px] flex-1 flex items-center justify-center font-medium whitespace-nowrap', landscape ? 'flex-row gap-1 py-1.5 text-[10px]' : 'flex-col gap-0.5 pt-2 pb-1.5 text-[9px]', active ? 'text-white' : n.ai ? 'text-ai-soft' : 'text-ink-300')}
            >
              <span className={cx('w-8 h-7 rounded-lg flex items-center justify-center', active && (n.ai ? 'ai-gradient' : 'bg-ink-600'), !active && n.ai && 'bg-ai/15', dot && !active && 'bg-brand/20 text-brand')}>
                <n.icon size={16} />
              </span>
              {n.label}
              {dot && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand animate-pulse" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
