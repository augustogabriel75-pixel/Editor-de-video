import { memo } from 'react';
import { Film, Image as ImageIcon, Type, Captions, AudioLines, Gauge, Zap, Diamond, Eraser, Shuffle, Palette, Mic, Aperture } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { getTemplate, MOTION_CATEGORIES } from '../../engine/motionTemplates';
import { iconFor } from '../ui/icons';
import { cx } from '../ui/primitives';
import Waveform from './Waveform';

const AUDIO_COLORS = { 'trk-voice': '#2dd4bf', 'trk-music': '#4ade80', 'trk-sfx': '#fbbf24' };

function startInteraction(e, clip, mode) {
  e.stopPropagation();
  if (e.button !== 0) return;
  const st0 = useEditorStore.getState();
  // Toque: em clipe não selecionado, tocar seleciona e deslizar rola a timeline.
  if (e.pointerType === 'touch' && st0.selectedClipId !== clip.id) {
    const tx = e.clientX;
    const ty = e.clientY;
    const cleanup = () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cleanup);
    };
    const onUp = (ev) => {
      cleanup();
      if (Math.hypot(ev.clientX - tx, ev.clientY - ty) < 10) useEditorStore.getState().select(clip.id);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cleanup);
    return;
  }
  st0.select(clip.id);
  if (st0.tracks.find((t) => t.id === clip.trackId)?.locked) return;
  const pps = st0.pxPerSec;
  const sx = e.clientX;
  const sy = e.clientY;
  const orig = { start: clip.start, end: clip.start + clip.duration, dur: clip.duration };
  const cands = [0, st0.currentTime];
  st0.clips.forEach((c) => {
    if (c.id !== clip.id) cands.push(c.start, c.start + c.duration);
  });
  const thr = 8 / pps;
  const snap = (t) => {
    if (!useEditorStore.getState().snapping) return t;
    let best = t;
    let bd = thr;
    for (const c of cands) {
      const d = Math.abs(c - t);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  };
  let first = true;
  const move = (ev) => {
    const st = useEditorStore.getState();
    const dt = (ev.clientX - sx) / pps;
    if (first && mode === 'move' && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
    if (mode === 'move') {
      const raw = orig.start + dt;
      const a = snap(raw);
      const b = snap(raw + orig.dur) - orig.dur;
      const ns = Math.abs(a - raw) <= Math.abs(b - raw) ? a : b;
      const lane = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-track-id]');
      st.moveClip(clip.id, ns, lane?.dataset.trackId || null, { history: first });
    } else if (mode === 'left') st.trimClip(clip.id, 'left', snap(orig.start + dt), { history: first });
    else st.trimClip(clip.id, 'right', snap(orig.end + dt), { history: first });
    first = false;
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function Badges({ clip }) {
  const items = [];
  if (clip.speedCurve) items.push({ icon: Gauge, label: clip.speedCurve.id === 'none' ? '' : 'curva' });
  else if (clip.speed && Math.abs(clip.speed - 1) > 0.01) items.push({ icon: Gauge, label: `${clip.speed.toFixed(clip.speed < 1 ? 2 : 1)}x` });
  if (clip.effects?.length) items.push({ icon: Zap, label: clip.effects.length });
  if (clip.filter && clip.filter.id !== 'none') items.push({ icon: Palette, label: '' });
  if (clip.lut && clip.lut.id !== 'none') items.push({ icon: Aperture, label: 'LUT' });
  if (clip.bg && clip.bg.mode !== 'none') items.push({ icon: Eraser, label: clip.bg.mode === 'chroma' ? 'key' : 'IA' });
  if (!items.length) return null;
  return (
    <div className="flex gap-1">
      {items.map((b, i) => (
        <span key={i} className="inline-flex items-center gap-0.5 rounded bg-black/55 px-1 text-[9px] text-white">
          <b.icon size={9} />
          {b.label}
        </span>
      ))}
    </div>
  );
}

function ClipView({ clip, track, height, compact = false }) {
  const pps = useEditorStore((s) => s.pxPerSec);
  const selected = useEditorStore((s) => s.selectedClipId === clip.id);
  const rendering = useEditorStore((s) => !!s.ai.render?.pending?.includes(clip.id));
  const asset = useEditorStore((s) => (clip.assetId ? s.assets.find((a) => a.id === clip.assetId) : null));
  const left = clip.start * pps;
  const width = Math.max(6, clip.duration * pps);
  const h = height - 6;

  let body;
  let style = {};
  let cls = '';
  if (clip.kind === 'video' || clip.kind === 'image') {
    cls = 'bg-sky-950 border-sky-400/50';
    const Icon = clip.kind === 'image' ? ImageIcon : Film;
    body = (
      <>
        {asset?.thumb && <div className="absolute inset-0 opacity-90" style={{ backgroundImage: `url(${asset.thumb})`, backgroundSize: `auto 100%`, backgroundRepeat: 'repeat-x' }} />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/40" />
        <div className="relative flex items-center gap-1 px-1.5 pt-0.5 text-[10px] font-semibold text-white truncate">
          <Icon size={10} className="shrink-0" />
          <span className="truncate">{clip.name}</span>
        </div>
        <div className="absolute bottom-1 left-1.5">
          <Badges clip={clip} />
        </div>
      </>
    );
  } else if (clip.kind === 'audio') {
    const color = AUDIO_COLORS[clip.trackId] || '#4ade80';
    style = { background: `${color}1f`, borderColor: `${color}80` };
    body = (
      <>
        {asset && <Waveform asset={asset} clip={clip} width={width} height={h - 2} color={`${color}cc`} />}
        {clip.audio?.fadeIn > 0 && <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-black/60 to-transparent" style={{ width: clip.audio.fadeIn * pps }} />}
        {clip.audio?.fadeOut > 0 && <div className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-black/60 to-transparent" style={{ width: clip.audio.fadeOut * pps }} />}
        <div className="relative flex items-center gap-1 px-1.5 pt-0.5 text-[10px] font-semibold truncate" style={{ color }}>
          {asset?.transcript ? <Mic size={10} /> : <AudioLines size={10} />}
          <span className="truncate text-white/90">{clip.name}</span>
          {clip.audio?.muted && <span className="text-[9px] text-red-300">(mudo)</span>}
          <Badges clip={clip} />
        </div>
      </>
    );
  } else if (clip.kind === 'text' || clip.kind === 'caption') {
    cls = clip.kind === 'caption' ? 'bg-indigo-500/25 border-indigo-400/60' : 'bg-violet-500/25 border-violet-400/60';
    const Icon = clip.kind === 'caption' ? Captions : Type;
    body = (
      <div className="relative flex items-center gap-1 px-1.5 h-full text-[10px] text-white truncate">
        <Icon size={10} className="shrink-0 text-violet-200" />
        <span className="truncate">{clip.kind === 'caption' ? clip.text.content : clip.text?.content}</span>
      </div>
    );
  } else if (clip.kind === 'motion') {
    const tpl = getTemplate(clip.motion.templateId);
    const color = MOTION_CATEGORIES[tpl.category].color;
    const Icon = iconFor(tpl.icon);
    style = { background: `linear-gradient(110deg, ${color}55, #a855f74d 60%, #ec489940)`, borderColor: `${color}`, boxShadow: selected ? `0 0 14px ${color}aa` : `0 0 8px ${color}55` };
    body = (
      <>
        {rendering && <span className="absolute inset-0 ai-shimmer" />}
        <div className="relative flex items-center gap-1 px-1.5 h-full text-[10px] font-semibold text-white truncate">
          <Icon size={11} className="shrink-0" style={{ color }} />
          {width > 70 && <span className="shrink-0 text-[8.5px] px-1 rounded bg-black/40 text-ai-soft">✨ IA</span>}
          <span className="truncate">{rendering ? 'renderizando…' : clip.name}</span>
        </div>
      </>
    );
  }

  return (
    <div
      className={cx(
        'group absolute top-[3px] rounded-md border overflow-hidden cursor-grab active:cursor-grabbing select-none',
        selected ? 'touch-none' : 'touch-auto',
        cls,
        selected && 'ring-2 ring-white z-10',
        clip.disabled && 'opacity-40 [background-image:repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,.06)_6px,rgba(255,255,255,.06)_12px)]',
      )}
      style={{ left, width, height: h, ...style }}
      onPointerDown={(e) => startInteraction(e, clip, 'move')}
      title={clip.name}
    >
      {body}
      {clip.transitionIn && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-sm bg-white text-ink-950 flex items-center justify-center shadow" title="Transição de entrada">
          <Shuffle size={10} />
        </span>
      )}
      {clip.keyframes?.map((k) => (
        <Diamond key={k.id} size={9} className="absolute bottom-0.5 text-brand fill-brand -translate-x-1/2 drop-shadow" style={{ left: k.t * pps }} />
      ))}
      <div
        className={cx('absolute left-0 top-0 bottom-0 cursor-ew-resize bg-white/0 hover:bg-white/50 touch-none', compact && selected ? 'w-4 bg-white/85 flex items-center justify-center' : 'w-2', selected && 'bg-white/70')}
        onPointerDown={(e) => startInteraction(e, clip, 'left')}
      >
        {compact && selected && <span className="w-0.5 h-1/2 rounded bg-ink-900/60" />}
      </div>
      <div
        className={cx('absolute right-0 top-0 bottom-0 cursor-ew-resize bg-white/0 hover:bg-white/50 touch-none', compact && selected ? 'w-4 bg-white/85 flex items-center justify-center' : 'w-2', selected && 'bg-white/70')}
        onPointerDown={(e) => startInteraction(e, clip, 'right')}
      >
        {compact && selected && <span className="w-0.5 h-1/2 rounded bg-ink-900/60" />}
      </div>
    </div>
  );
}

export default memo(ClipView);
