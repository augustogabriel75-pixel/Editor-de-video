/**
 * Timeline do celular, no estilo CapCut:
 * - o playhead fica fixo no meio da tela e a timeline desliza por baixo (arrastar = buscar);
 * - trilha principal grande, com miniaturas;
 * - só aparecem as trilhas que têm clipes, mais as linhas "+ Adicionar áudio/texto";
 * - pinça com dois dedos = zoom, mantendo o ponto sob o playhead.
 */
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, Volume2, VolumeX, Music, Type, WandSparkles, Layers } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../store/useEditorStore';
import { formatTime } from '../../lib/utils';
import { cx } from '../ui/primitives';
import ClipView from './ClipView';
import TimeRuler from './TimeRuler';

const SIDE_W = 64; // coluna fixa à esquerda (ícones/ações), sobre a área antes do 0
const MAIN_H = 58;
const LANE_H = 30;

const AUDIO_TRACKS = ['trk-voice', 'trk-music', 'trk-sfx'];
const TEXT_TRACKS = ['trk-text', 'trk-captions'];
const AI_TRACKS = ['trk-ai-sticker', 'trk-ai-typo', 'trk-ai-camera'];

function Lane({ trackId, height, pad, width, side }) {
  const track = useEditorStore((s) => s.tracks.find((t) => t.id === trackId));
  const clips = useEditorStore(useShallow((s) => s.clips.filter((c) => c.trackId === trackId)));
  const select = useEditorStore((s) => s.select);
  if (!track) return null;
  return (
    <div className="relative flex" style={{ height, width: pad * 2 + width }}>
      <div className="sticky left-0 z-20 shrink-0 flex items-center justify-center bg-ink-950 shadow-[8px_0_10px_-4px_rgba(6,7,10,.9)]" style={{ width: SIDE_W, marginRight: pad - SIDE_W }}>
        {side}
      </div>
      <div
        data-track-id={track.id}
        className={cx('relative', track.hidden && 'opacity-50')}
        style={{ width, height }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) select(null);
        }}
      >
        {clips.map((c) => (
          <ClipView key={c.id} clip={c} track={track} height={height} compact />
        ))}
      </div>
    </div>
  );
}

function SideIcon({ icon: Icon, ai, label }) {
  return (
    <span className={cx('w-7 h-7 rounded-md flex items-center justify-center', ai ? 'ai-gradient' : 'bg-ink-800 text-ink-300')} title={label}>
      <Icon size={13} />
    </span>
  );
}

function AddRow({ icon: Icon, label, onClick, pad, width }) {
  return (
    <div className="relative flex" style={{ height: LANE_H + 6, width: pad * 2 + width }}>
      <div className="shrink-0" style={{ width: pad }} />
      <button type="button" onClick={onClick} className="my-[3px] flex items-center gap-1.5 px-3 rounded-md bg-ink-800/90 text-ink-200 text-[12px] font-medium active:bg-ink-700" style={{ width: Math.max(160, Math.min(width, 520)) }}>
        <Plus size={14} />
        <Icon size={13} className="text-ink-400" />
        {label}
      </button>
    </div>
  );
}

function MainTrackSide() {
  const muted = useEditorStore((s) => s.tracks.find((t) => t.id === 'trk-main')?.muted);
  const toggle = useEditorStore((s) => s.toggleTrack);
  return (
    <button type="button" onClick={() => toggle('trk-main', 'muted')} className={cx('flex flex-col items-center gap-0.5 text-[9px] leading-tight', muted ? 'text-red-300' : 'text-ink-200')}>
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      {muted ? 'Som off' : 'Silenciar'}
    </button>
  );
}

function TimeReadout() {
  const ref = useRef(null);
  const duration = useEditorStore((s) => s.duration);
  useEffect(() => {
    const put = (t) => ref.current && (ref.current.textContent = formatTime(t, false));
    put(useEditorStore.getState().currentTime);
    return useEditorStore.subscribe((s) => s.currentTime, put);
  }, []);
  return (
    <div className="font-mono text-[11px] text-ink-300">
      <span ref={ref} className="text-white" /> / {formatTime(duration, false)}
    </div>
  );
}

function MobileTimeline({ onOpenSheet }) {
  const scrollRef = useRef(null);
  const [viewW, setViewW] = useState(360);
  const pps = useEditorStore((s) => s.pxPerSec);
  const duration = useEditorStore((s) => s.duration);
  const present = useEditorStore(
    useShallow((s) => {
      const ids = new Set(s.clips.map((c) => c.trackId));
      return [...ids].sort().join(',');
    }),
  );
  const has = (id) => present.split(',').includes(id);
  const pad = Math.round(viewW / 2);
  const width = Math.max(1, duration) * pps + 60;
  const programmatic = useRef(0);
  const userActive = useRef(false);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // tempo -> rolagem (reprodução, botões de quadro, zoom)
  useEffect(() => {
    const el = scrollRef.current;
    const sync = () => {
      if (userActive.current) return;
      const s = useEditorStore.getState();
      const x = Math.round(s.currentTime * s.pxPerSec);
      if (Math.abs(el.scrollLeft - x) > 0.5) {
        programmatic.current = x;
        el.scrollLeft = x;
      }
    };
    sync();
    const a = useEditorStore.subscribe((s) => s.currentTime, sync);
    const b = useEditorStore.subscribe((s) => s.pxPerSec, () => requestAnimationFrame(sync));
    return () => {
      a();
      b();
    };
  }, [pad]);

  // rolagem do usuário -> tempo; pinça -> zoom
  useEffect(() => {
    const el = scrollRef.current;
    let idle = 0;
    const onScroll = () => {
      if (Math.abs(el.scrollLeft - programmatic.current) < 1 && !userActive.current) return;
      const s = useEditorStore.getState();
      if (s.isPlaying) s.pause();
      s.seek(Math.max(0, Math.min(s.duration, el.scrollLeft / s.pxPerSec)));
      clearTimeout(idle);
      idle = setTimeout(() => {
        if (!touching) userActive.current = false;
      }, 180);
    };
    let touching = false;
    let pinch = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e) => {
      touching = true;
      userActive.current = true;
      if (e.touches?.length === 2) pinch = { d: dist(e.touches), pps: useEditorStore.getState().pxPerSec, t: useEditorStore.getState().currentTime };
    };
    const onMove = (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const s = useEditorStore.getState();
      s.setZoom((pinch.pps * dist(e.touches)) / Math.max(1, pinch.d));
      const x = Math.round(pinch.t * useEditorStore.getState().pxPerSec);
      programmatic.current = x;
      el.scrollLeft = x;
    };
    const onEnd = (e) => {
      if (!e.touches || e.touches.length < 2) pinch = null;
      if (!e.touches || e.touches.length === 0) {
        touching = false;
        clearTimeout(idle);
        idle = setTimeout(() => (userActive.current = false), 220);
      }
    };
    const onWheel = (e) => {
      userActive.current = true;
      clearTimeout(idle);
      idle = setTimeout(() => (userActive.current = false), 220);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    el.addEventListener('pointerdown', onStart);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('pointerdown', onStart);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const textLanes = TEXT_TRACKS.filter(has);
  const audioLanes = AUDIO_TRACKS.filter(has);
  const aiLanes = AI_TRACKS.filter(has);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col bg-ink-950" data-mobile-timeline>
      <div className="shrink-0 flex items-center justify-between px-3 h-7">
        <TimeReadout />
        <span className="text-[10px] text-ink-500">pinça para zoom</span>
      </div>
      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-x-auto overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative" style={{ width: pad * 2 + width, minHeight: '100%' }}>
          <div className="sticky top-0 z-30 flex bg-ink-950" style={{ height: 28, width: pad * 2 + width }}>
            <div className="shrink-0" style={{ width: pad }} />
            <TimeRuler width={width} hideHead />
          </div>
          <div className="pt-2 space-y-1">
            <Lane
              trackId="trk-main"
              height={MAIN_H}
              pad={pad}
              width={width}
              side={<MainTrackSide />}
            />
            <div className="relative" style={{ width: pad * 2 + width, height: 0 }}>
              <button
                type="button"
                aria-label="Adicionar mídia"
                onClick={() => onOpenSheet('media')}
                className="absolute z-20 w-9 h-9 rounded-md bg-white text-ink-950 flex items-center justify-center shadow-lg active:scale-95"
                style={{ left: pad + Math.max(0, duration * pps) + 8, top: -MAIN_H + 9 }}
              >
                <Plus size={20} strokeWidth={2.5} />
              </button>
            </div>
            {has('trk-pip') && <Lane trackId="trk-pip" height={LANE_H + 6} pad={pad} width={width} side={<SideIcon icon={Layers} label="Sobreposição" />} />}
            {aiLanes.map((id) => (
              <Lane key={id} trackId={id} height={LANE_H} pad={pad} width={width} side={<SideIcon icon={WandSparkles} ai label="IA Motion" />} />
            ))}
            {textLanes.length ? (
              textLanes.map((id) => <Lane key={id} trackId={id} height={LANE_H} pad={pad} width={width} side={<SideIcon icon={Type} label="Texto" />} />)
            ) : (
              <AddRow icon={Type} label="Adicionar texto" onClick={() => onOpenSheet('text')} pad={pad} width={width} />
            )}
            {audioLanes.length ? (
              audioLanes.map((id) => <Lane key={id} trackId={id} height={LANE_H + 4} pad={pad} width={width} side={<SideIcon icon={Music} label="Áudio" />} />)
            ) : (
              <AddRow icon={Music} label="Adicionar áudio" onClick={() => onOpenSheet('audio')} pad={pad} width={width} />
            )}
            <div className="h-6" />
          </div>
        </div>
      </div>
      {/* playhead fixo no centro */}
      <div className="pointer-events-none absolute top-7 bottom-0 left-1/2 -translate-x-1/2 w-[2px] rounded bg-white z-40 shadow-[0_0_6px_rgba(255,255,255,.7)]" />
    </div>
  );
}

export default memo(MobileTimeline);
