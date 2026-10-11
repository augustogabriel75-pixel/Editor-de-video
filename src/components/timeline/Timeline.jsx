import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { AIBadge } from '../ui/primitives';
import TimelineToolbar from './TimelineToolbar';
import TimeRuler from './TimeRuler';
import AIMarkerLane from './AIMarkerLane';
import TrackRow from './TrackRow';
import { HEADER_W, RULER_H, AI_LANE_H } from './constants';

function PlayheadLine() {
  const t = useEditorStore((s) => s.currentTime);
  const pps = useEditorStore((s) => s.pxPerSec);
  return <div className="absolute top-0 bottom-0 w-px bg-white z-[25] pointer-events-none shadow-[0_0_6px_rgba(255,255,255,.6)]" style={{ left: HEADER_W + t * pps }} />;
}

export default function Timeline({ height }) {
  const tracks = useEditorStore((s) => s.tracks);
  const duration = useEditorStore((s) => s.duration);
  const pps = useEditorStore((s) => s.pxPerSec);
  const setZoom = useEditorStore((s) => s.setZoom);
  const scrollRef = useRef(null);
  const [viewW, setViewW] = useState(1000);

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
          const visW = el.clientWidth - HEADER_W;
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
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const laneW = Math.max(duration + 6, (viewW - HEADER_W) / pps) * pps;
  const fit = () => setZoom((viewW - HEADER_W - 40) / Math.max(1, duration));

  return (
    <div className="shrink-0 flex flex-col bg-ink-900 border-t border-ink-700 min-h-0" style={{ height }}>
      <TimelineToolbar onFit={fit} />
      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-auto">
        <div className="relative" style={{ width: HEADER_W + laneW, minHeight: '100%' }}>
          <div className="sticky top-0 z-30 flex" style={{ height: RULER_H }}>
            <div className="sticky left-0 z-40 shrink-0 bg-ink-900 border-r border-b border-ink-700 flex items-center px-2 text-[10px] text-ink-400 font-mono" style={{ width: HEADER_W }}>
              {Math.round(pps)} px/s
            </div>
            <TimeRuler width={laneW} />
          </div>
          <div className="sticky z-[29] flex" style={{ top: RULER_H, height: AI_LANE_H }}>
            <div className="sticky left-0 z-40 shrink-0 bg-[#16122a] border-r border-b border-ai/20 flex items-center px-2" style={{ width: HEADER_W }}>
              <AIBadge small />
            </div>
            <AIMarkerLane width={laneW} />
          </div>
          {tracks.map((t) => (
            <TrackRow key={t.id} track={t} />
          ))}
          <PlayheadLine />
        </div>
      </div>
    </div>
  );
}
