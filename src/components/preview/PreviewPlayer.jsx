import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sparkles, LoaderCircle } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { renderFrame, lastBounds } from '../../engine/renderer';
import { onFrameReady } from '../../engine/mediaPool';
import { getAspect } from '../../lib/catalog';
import { isActiveAt } from '../../lib/utils';
import { getTransformAt } from '../../lib/keyframes';
import PlayerControls from './PlayerControls';

const MAX_RENDER = 1600;

function hitTest(s, px, py) {
  const order = [...s.tracks].filter((t) => !t.hidden && t.kind !== 'audio');
  const rank = { text: 0, motion: 1, overlay: 2, video: 3 };
  order.sort((a, b) => rank[a.kind] - rank[b.kind]);
  for (const t of order) {
    const clips = s.clips.filter((c) => c.trackId === t.id && !c.disabled && isActiveAt(c, s.currentTime));
    for (const c of clips) {
      if (c.kind === 'motion' && ['camera', 'transition'].includes(c.motion?.category)) continue;
      const b = lastBounds.get(c.id);
      if (!b) continue;
      const dx = px - b.cx;
      const dy = py - b.cy;
      const cos = Math.cos(-b.rot);
      const sin = Math.sin(-b.rot);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2) return c.id;
    }
  }
  return null;
}

function ActiveAIChips() {
  const names = useEditorStore((s) =>
    s.clips
      .filter((c) => c.kind === 'motion' && !c.disabled && isActiveAt(c, s.currentTime))
      .map((c) => c.name)
      .join('|'),
  );
  if (!names) return null;
  return (
    <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none z-10">
      {names.split('|').map((n, i) => (
        <span key={`${n}${i}`} className="inline-flex items-center gap-1 self-start rounded-full bg-black/55 backdrop-blur px-2 py-0.5 text-[10px] text-white border border-ai/50 shadow-[0_0_12px_rgba(168,85,247,.45)]">
          <Sparkles size={10} className="text-ai-soft" /> {n}
        </span>
      ))}
    </div>
  );
}

export default function PreviewPlayer({ compact = false }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const dirty = useRef(true);
  const displayRef = useRef({ w: 640, h: 360 });
  const aspectId = useEditorStore((s) => s.project.aspect);
  const exporting = useEditorStore((s) => s.exporting);
  const showSafe = useEditorStore((s) => s.showSafeArea);
  const [box, setBox] = useState({ w: 640, h: 360 });
  const aspect = getAspect(aspectId);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const aw = Math.max(80, r.width - (compact ? 12 : 32));
      const ah = Math.max(60, r.height - (compact ? 10 : 24));
      const a = aspect.w / aspect.h;
      let w = aw;
      let h = w / a;
      if (h > ah) {
        h = ah;
        w = h * a;
      }
      setBox({ w: Math.floor(w), h: Math.floor(h) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect.w, aspect.h, compact]);

  const dpr = Math.min(compact ? 1.75 : 2, window.devicePixelRatio || 1);
  let cw = Math.round(box.w * dpr);
  let ch = Math.round(box.h * dpr);
  const k = Math.min(1, (compact ? 960 : MAX_RENDER) / Math.max(cw, ch));
  cw = Math.round(cw * k);
  ch = Math.round(ch * k);

  useEffect(() => {
    displayRef.current = box;
    dirty.current = true;
  }, [box, cw, ch]);

  useEffect(() => {
    let raf;
    const unsub = useEditorStore.subscribe(() => {
      dirty.current = true;
    });
    onFrameReady(() => {
      dirty.current = true;
    });
    const fontsDone = () => {
      dirty.current = true;
    };
    document.fonts?.ready?.then(fontsDone);
    document.fonts?.addEventListener?.('loadingdone', fontsDone);

    const updateOverlay = (s, canvas) => {
      const el = overlayRef.current;
      if (!el) return;
      const clip = s.selectedClipId ? s.clips.find((c) => c.id === s.selectedClipId) : null;
      const b = clip ? lastBounds.get(clip.id) : null;
      const visible =
        clip && clip.kind !== 'audio' && !clip.disabled && !(clip.kind === 'motion' && ['camera', 'transition'].includes(clip.motion?.category)) && isActiveAt(clip, s.currentTime) && b && b.W === canvas.width;
      if (!visible) {
        el.style.display = 'none';
        return;
      }
      const kk = displayRef.current.w / canvas.width;
      const w = Math.max(16, b.w * kk);
      const h = Math.max(16, b.h * kk);
      el.style.display = 'block';
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.transform = `translate(${b.cx * kk - w / 2}px, ${b.cy * kk - h / 2}px) rotate(${b.rot}rad)`;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = useEditorStore.getState();
      if (s.exporting) return;
      if (!dirty.current && !s.isPlaying) return;
      dirty.current = false;
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      try {
        renderFrame(ctx, c.width, c.height, s, s.currentTime, { playing: s.isPlaying });
      } catch (e) {
        console.error('render error', e);
      }
      updateOverlay(s, c);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      unsub();
      document.fonts?.removeEventListener?.('loadingdone', fontsDone);
    };
  }, []);

  /* ---- interação: selecionar, mover e escalar no preview ---- */
  const toCanvas = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const kk = canvasRef.current.width / r.width;
    return [(e.clientX - r.left) * kk, (e.clientY - r.top) * kk];
  };

  const onCanvasDown = (e) => {
    const s = useEditorStore.getState();
    const [px, py] = toCanvas(e);
    const id = hitTest(s, px, py);
    s.select(id);
    if (id) startDrag(e, id, 'move');
  };

  const startDrag = (e, id, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const s = useEditorStore.getState();
    const clip = s.clips.find((c) => c.id === id);
    if (!clip || s.tracks.find((t) => t.id === clip.trackId)?.locked) return;
    const tr = getTransformAt(clip, s.currentTime - clip.start);
    const b = lastBounds.get(id);
    const r = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const center = b ? [r.left + (b.cx / canvasRef.current.width) * r.width, r.top + (b.cy / canvasRef.current.height) * r.height] : [sx, sy];
    const d0 = Math.max(4, Math.hypot(sx - center[0], sy - center[1]));
    const key = `drag:${id}:${Date.now()}`;
    let moved = false;
    const move = (ev) => {
      const st = useEditorStore.getState();
      if (mode === 'move') {
        const dx = (ev.clientX - sx) / r.width;
        const dy = (ev.clientY - sy) / r.height;
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
        moved = true;
        let nx = tr.x + dx;
        let ny = tr.y + dy;
        if (Math.abs(nx) < 0.012) nx = 0;
        if (Math.abs(ny) < 0.012) ny = 0;
        st.setTransformProp(id, 'x', +nx.toFixed(4), key);
        st.setTransformProp(id, 'y', +ny.toFixed(4), key);
      } else {
        const d = Math.hypot(ev.clientX - center[0], ev.clientY - center[1]);
        st.setTransformProp(id, 'scale', +Math.max(0.05, Math.min(6, tr.scale * (d / d0))).toFixed(3), key);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-ink-950">
      <div ref={wrapRef} className="relative flex-1 min-h-0 flex items-center justify-center">
        <div className="relative shadow-2xl shadow-black/60 ring-1 ring-ink-700" style={{ width: box.w, height: box.h }}>
          <canvas ref={canvasRef} width={cw} height={ch} className="block w-full h-full bg-black cursor-default touch-none" onPointerDown={onCanvasDown} />
          <div
            ref={overlayRef}
            className="absolute left-0 top-0 border-2 border-brand/90 rounded-sm cursor-move hidden origin-center touch-none"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,.4)' }}
            onPointerDown={(e) => startDrag(e, useEditorStore.getState().selectedClipId, 'move')}
          >
            {['-left-1.5 -top-1.5', '-right-1.5 -top-1.5', '-left-1.5 -bottom-1.5', '-right-1.5 -bottom-1.5'].map((pos) => (
              <span
                key={pos}
                onPointerDown={(e) => startDrag(e, useEditorStore.getState().selectedClipId, 'scale')}
                className={`absolute ${pos} ${compact ? 'w-4 h-4' : 'w-3 h-3'} rounded-full bg-white border-2 border-brand cursor-nwse-resize touch-none`}
              />
            ))}
          </div>
          {showSafe && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-[5%] border border-dashed border-white/40" />
              <div className="absolute inset-[10%] border border-dashed border-amber-300/40" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/15" />
            </div>
          )}
          <ActiveAIChips />
          {exporting && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white">
              <LoaderCircle className="animate-spin text-brand" />
              <div className="text-[13px] font-semibold">Exportando vídeo…</div>
              <div className="text-[11px] text-ink-300">O preview é pausado durante a renderização</div>
            </div>
          )}
        </div>
      </div>
      <PlayerControls compact={compact} />
    </section>
  );
}
