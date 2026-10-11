/** Fábricas de clipes e regras de trilhas. */
import { uid, clamp } from './utils';
import { DEFAULT_TEXT_STYLE } from './catalog';
import { sourceOffsetAt, hasCurve, clipSourceSpan } from './speedCurves';

export const TRACK_ACCEPTS = {
  video: ['video', 'image'],
  overlay: ['video', 'image'],
  text: ['text', 'caption'],
  audio: ['audio'],
  motion: ['motion'],
};

export const accepts = (track, kind) => !!track && TRACK_ACCEPTS[track.kind]?.includes(kind);

export const clipKindForAsset = (asset) => (asset.type === 'audio' ? 'audio' : asset.type);

export function baseClip(o = {}) {
  return {
    id: uid('clip'),
    trackId: null,
    kind: 'video',
    name: 'Clipe',
    assetId: null,
    start: 0,
    duration: 3,
    trimIn: 0,
    sourceDuration: Infinity,
    speed: 1,
    speedCurve: null,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    keyframes: [],
    audio: { volume: 1, fadeIn: 0, fadeOut: 0, muted: false, denoise: false, denoiseLevel: 60 },
    bg: { mode: 'none', color: '#16c75a', similarity: 38, smoothness: 12, spill: 60 },
    filter: { id: 'none', intensity: 100 },
    adjust: { brightness: 0, contrast: 0, saturation: 0 },
    effects: [],
    transitionIn: null,
    animation: { in: null, out: null, loop: null },
    blend: 'normal',
    disabled: false,
    ...o,
  };
}

export function mediaClip(asset, track, start) {
  const kind = clipKindForAsset(asset);
  const duration = asset.type === 'image' ? 5 : asset.duration;
  const isOverlay = track.kind === 'overlay';
  return baseClip({
    trackId: track.id,
    kind,
    name: asset.name,
    assetId: asset.id,
    start,
    duration,
    sourceDuration: asset.type === 'image' ? Infinity : asset.duration,
    transform: isOverlay ? { x: 0.27, y: -0.22, scale: 0.4, rotation: 0, opacity: 1 } : { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    audio: { volume: asset.synth?.kind === 'sfx' ? 0.7 : 1, fadeIn: 0, fadeOut: 0, muted: false, denoise: false, denoiseLevel: 60, demoVoice: !!asset.transcript },
  });
}

export function textClip({ trackId, start, duration = 3, content = 'Seu texto aqui', style = {}, animation, transform, name }) {
  return baseClip({
    trackId,
    kind: 'text',
    name: name || content.slice(0, 24),
    start,
    duration,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, ...(transform || {}) },
    text: { content, style: { ...DEFAULT_TEXT_STYLE, ...style } },
    animation: animation || { in: { id: 'pop', duration: 0.45 }, out: { id: 'fade-out', duration: 0.35 }, loop: null },
  });
}

export function captionClip(chunk, preset, trackId, y = 0.33) {
  return baseClip({
    trackId,
    kind: 'caption',
    name: chunk.words.map((w) => w.w).join(' '),
    start: chunk.start,
    duration: chunk.duration,
    transform: { x: 0, y, scale: 1, rotation: 0, opacity: 1 },
    text: {
      content: chunk.words.map((w) => w.w).join(' '),
      style: { ...DEFAULT_TEXT_STYLE, ...preset.style },
      words: chunk.words,
      highlight: preset.highlight,
      preset: preset.id,
    },
    animation: { in: { id: 'pop', duration: 0.18 }, out: null, loop: null },
    autoCaption: true,
  });
}

export function motionClip(spec, trackId) {
  return baseClip({
    trackId,
    kind: 'motion',
    name: spec.name,
    start: spec.start,
    duration: spec.duration,
    transform: spec.transform || { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    motion: spec.motion,
    ai: true,
  });
}

/** Encontra a posição livre mais próxima de `desired` numa trilha. */
export function findFreeStart(trackClips, desired, duration, excludeId = null) {
  const list = trackClips.filter((c) => c.id !== excludeId).sort((a, b) => a.start - b.start);
  const EPS = 1e-4;
  const fits = (s) => s >= -EPS && list.every((c) => s + duration <= c.start + EPS || s >= c.start + c.duration - EPS);
  if (fits(desired)) return Math.max(0, desired);
  const cands = [0, ...list.map((c) => c.start + c.duration), ...list.map((c) => c.start - duration)].filter(fits);
  if (!cands.length) return list.length ? list[list.length - 1].start + list[list.length - 1].duration : 0;
  cands.sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired));
  return Math.max(0, cands[0]);
}

/** Divide um clipe no tempo T da timeline. Mantém a continuidade da fonte (inclusive com curvas). */
export function splitClip(clip, T) {
  const lt = T - clip.start;
  const rd = clip.duration - lt;
  const srcLt = sourceOffsetAt(clip, lt);
  const span = clipSourceSpan(clip);
  const kfs = clip.keyframes || [];
  const left = {
    ...clip,
    duration: lt,
    keyframes: kfs.filter((k) => k.t <= lt + 1e-6),
    animation: { ...clip.animation, out: null },
    audio: { ...clip.audio, fadeOut: 0 },
  };
  const right = {
    ...clip,
    id: uid('clip'),
    start: T,
    duration: rd,
    trimIn: clip.trimIn + srcLt,
    keyframes: kfs.filter((k) => k.t >= lt - 1e-6).map((k) => ({ ...k, id: uid('kf'), t: Math.max(0, k.t - lt) })),
    transitionIn: null,
    animation: { ...clip.animation, in: null },
    audio: { ...clip.audio, fadeIn: 0 },
  };
  if (hasCurve(clip)) {
    left.speedCurve = null;
    right.speedCurve = null;
    left.speed = clamp(srcLt / Math.max(1e-3, lt), 0.05, 20);
    right.speed = clamp((span - srcLt) / Math.max(1e-3, rd), 0.05, 20);
  }
  if (clip.text?.words) {
    left.text = { ...clip.text, words: clip.text.words.filter((w) => w.start < lt) };
    right.text = { ...clip.text, words: clip.text.words.filter((w) => w.start >= lt).map((w) => ({ ...w, start: w.start - lt, end: w.end - lt })) };
    left.text.content = left.text.words.map((w) => w.w).join(' ');
    right.text.content = right.text.words.map((w) => w.w).join(' ');
  }
  return [left, right];
}

/** Remove o intervalo [a, b] de todas as trilhas e fecha o buraco (ripple delete). */
export function rippleDeleteRange(clips, a, b) {
  const len = b - a;
  const out = [];
  for (let c of clips) {
    const end = c.start + c.duration;
    if (end <= a + 1e-6) {
      out.push(c);
      continue;
    }
    if (c.start >= b - 1e-6) {
      out.push({ ...c, start: c.start - len });
      continue;
    }
    if (c.start < a) {
      const [l, r] = splitClip(c, a);
      out.push(l);
      c = r;
    }
    if (c.start + c.duration > b) {
      const [, r2] = splitClip(c, b);
      out.push({ ...r2, start: r2.start - len });
    }
  }
  return out.filter((c) => c.duration > 0.04 && (!c.text?.words || c.text.words.length));
}

export const computeDuration = (clips) => Math.max(1, ...clips.filter((c) => !c.disabled).map((c) => c.start + c.duration));
