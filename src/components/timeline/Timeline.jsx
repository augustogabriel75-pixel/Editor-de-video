import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { AIBadge } from '../ui/primitives';
import TimelineToolbar from './TimelineToolbar';
import TimeRuler from './TimeRuler';
import AIMarkerLane from './AIMarkerLane';
import TrackRow from './TrackRow';
import { RULER_H, AI_LANE_H } from './constants';
import { useTimelineMetrics } from './metrics';

function PlayheadLine({ headerW }) {
  const t = useEditorStore((s) => s.currentTime);
  const pps = useEditorStore((s) => s.pxPerSec);
  return <div className="absolute top-0 bottom-0 w-px bg-white z-[25] pointer-events-none shadow-[0_0_6px_rgba(255,255,255,.6)]" style={{ left: headerW + t * pps }} />;
}

export default function Timeline({ height }) {
  const tracks = useEditorStore((s) => s.tracks);
  const duration = useEditorStore((s) => s.duration);
  const pps = useEditorStore((s) => s.pxPerSec);
  const setZoom = useEditorStore((s) => s.setZoom);
  const scrollRef = useRef(null);
  const [viewW, setViewW] = useState(1000);
  const { compact, headerW } = useTimelineMetrics();
  const HEADER_W = headerW;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Mantém o playhead visível durante a reprodução
  useEffect(
    () =>
      useEditorStore.subscribe(
        (s) => s.currentTime,
        (t) => {
          const s = useEditorStore.getState();
          const el = scrollRef.current;
          if (!el || !s.isPlaying) return;
          const x = t * s.pxPerSec;
          const visW = el.clientWidth - (window.matchMedia('(max-width: 940px)').matches ? 100 : 176);
          if (x > el.scrollLeft + visW - 40 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 80);
        },
      ),
    [],
  );

  // Ctrl/Cmd + roda = zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const s = useEditorStore.getState();
      s.setZoom(s.pxPerSec * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
    };
    // Pinça com dois dedos = zoom (celular)
    let pinch = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e) => {
      if (e.touches.length === 2) pinch = { d: dist(e.touches), pps: useEditorStore.getState().pxPerSec };
    };
    const onTouchMove = (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      useEditorStore.getState().setZoom((pinch.pps * dist(e.touches)) / Math.max(1, pinch.d));
    };
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) pinch = null;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const laneW = Math.max(duration + 6, (viewW - HEADER_W) / pps) * pps;
  const fit = () => setZoom((viewW - HEADER_W - 40) / Math.max(1, duration));

  return (
    <div className={`flex flex-col bg-ink-900 border-t border-ink-700 min-h-0 ${height ? 'shrink-0' : 'flex-1'}`} style={height ? { height } : undefined}>
      <TimelineToolbar onFit={fit} compact={compact} />
      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-auto">
        <div className="relative" style={{ width: HEADER_W + laneW, minHeight: '100%' }}>
          <div className="sticky top-0 z-30 flex" style={{ height: RULER_H }}>
            <div className="sticky left-0 z-40 shrink-0 bg-ink-900 border-r border-b border-ink-700 flex items-center px-2 text-[10px] text-ink-400 font-mono" style={{ width: HEADER_W }}>
              {compact ? 'Trilhas' : `${Math.round(pps)} px/s`}
            </div>
            <TimeRuler width={laneW} />
          </div>
          <div className="sticky z-[29] flex" style={{ top: RULER_H, height: AI_LANE_H }}>
            <div className="sticky left-0 z-40 shrink-0 bg-[#16122a] border-r border-b border-ai/20 flex items-center px-2" style={{ width: HEADER_W }}>
              {compact ? <span className="text-[9px] font-bold ai-text">✨ IA Motion</span> : <AIBadge small />}
            </div>
            <AIMarkerLane width={laneW} />
          </div>
          {tracks.map((t) => (
            <TrackRow key={t.id} track={t} />
          ))}
          <PlayheadLine headerW={HEADER_W} />
        </div>
      </div>
    </div>
  );
}
