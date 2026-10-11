/**
 * Motor de áudio baseado em WebAudio.
 * - Agenda cada clipe de áudio (e o áudio dos vídeos importados) com volume, fade in/out,
 *   velocidade/curvas de velocidade (playbackRate automatizado) e redução de ruído (cadeia de filtros).
 * - O relógio do AudioContext é a referência de tempo da reprodução (sincronia A/V).
 * - Expõe um MediaStream para a exportação incluir o áudio mixado.
 */
import { clamp } from '../lib/utils';
import { SYNTH_RATE, getSynthSamples } from '../audio/synth';
import { sourceOffsetAt, instantSpeedAt, hasCurve } from '../lib/speedCurves';

let ctx = null;
let master = null;
let streamDest = null;
const buffers = new Map();
const loading = new Map();
let active = [];
let listeners = new Set();

export function ensureContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export const audioNow = () => (ctx ? ctx.currentTime : performance.now() / 1000);
export const hasAudioClock = () => !!ctx && ctx.state === 'running';

export function setMasterVolume(v) {
  if (master) master.gain.setTargetAtTime(clamp(v, 0, 2), ctx.currentTime, 0.02);
}

export function getExportStream() {
  ensureContext();
  if (!ctx) return null;
  if (!streamDest) {
    streamDest = ctx.createMediaStreamDestination();
    master.connect(streamDest);
  }
  return streamDest.stream;
}

export const onBufferLoaded = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function getBuffer(asset) {
  return buffers.get(asset.id) || null;
}

/** Carrega (ou sintetiza) o AudioBuffer de um asset. */
export async function loadBuffer(asset) {
  if (!asset) return null;
  if (buffers.has(asset.id)) return buffers.get(asset.id);
  if (loading.has(asset.id)) return loading.get(asset.id);
  const c = ensureContext();
  if (!c) return null;
  const p = (async () => {
    try {
      let buf = null;
      if (asset.synth) {
        const samples = getSynthSamples(asset.synth.kind, asset.synth.id);
        buf = c.createBuffer(1, samples.length, SYNTH_RATE);
        buf.copyToChannel(samples, 0);
      } else if (asset.src && (asset.type === 'audio' || asset.type === 'video')) {
        const ab = await (await fetch(asset.src)).arrayBuffer();
        buf = await c.decodeAudioData(ab);
      }
      buffers.set(asset.id, buf);
      listeners.forEach((fn) => fn(asset.id));
      return buf;
    } catch {
      buffers.set(asset.id, null);
      return null;
    } finally {
      loading.delete(asset.id);
    }
  })();
  loading.set(asset.id, p);
  return p;
}

export function stopAll() {
  for (const n of active) {
    try {
      n.src.stop();
    } catch {
      /* já parado */
    }
    try {
      n.out.disconnect();
    } catch {
      /* ok */
    }
  }
  active = [];
}

function buildChain(clip) {
  const gain = ctx.createGain();
  let input = gain;
  let out = gain;
  if (clip.audio?.denoise) {
    // Redução de ruído: corta rumble/hiss e comprime levemente (voz mais limpa).
    const lvl = (clip.audio.denoiseLevel ?? 60) / 100;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 60 + lvl * 80;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 11000 - lvl * 4500;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -28;
    comp.ratio.value = 3;
    comp.knee.value = 12;
    hp.connect(lp);
    lp.connect(comp);
    comp.connect(gain);
    input = hp;
  }
  out.connect(master);
  return { input, gain, out };
}

function envelopeAt(clip, lt) {
  const a = clip.audio || {};
  const v = a.volume ?? 1;
  let g = v;
  if (a.fadeIn > 0) g *= clamp(lt / a.fadeIn, 0, 1);
  if (a.fadeOut > 0) g *= clamp((clip.duration - lt) / a.fadeOut, 0, 1);
  return g;
}

/**
 * Agenda todos os clipes audíveis a partir do tempo `from` da timeline.
 * Retorna o tempo de contexto que corresponde a `from` (âncora do relógio).
 */
export function schedule(state, from) {
  const c = ensureContext();
  if (!c) return null;
  stopAll();
  const lead = 0.04;
  const anchor = c.currentTime + lead;
  const assets = new Map(state.assets.map((a) => [a.id, a]));
  const tracks = new Map(state.tracks.map((t) => [t.id, t]));
  for (const clip of state.clips) {
    const track = tracks.get(clip.trackId);
    if (!track || track.muted || clip.disabled) continue;
    if (clip.audio?.muted) continue;
    const asset = assets.get(clip.assetId);
    if (!asset) continue;
    const audible = asset.type === 'audio' || (asset.type === 'video' && asset.hasAudio);
    if (!audible) continue;
    const end = clip.start + clip.duration;
    if (end <= from) continue;
    const buf = buffers.get(asset.id);
    if (buf === undefined) {
      loadBuffer(asset);
      continue;
    }
    if (!buf) continue;
    const lt0 = Math.max(0, from - clip.start);
    const when = anchor + Math.max(0, clip.start - from);
    const offset = clip.trimIn + sourceOffsetAt(clip, lt0);
    if (offset >= buf.duration) continue;
    const remaining = clip.duration - lt0;
    const src = c.createBufferSource();
    src.buffer = buf;
    if (hasCurve(clip)) {
      const n = Math.max(2, Math.min(512, Math.ceil(remaining * 30)));
      const values = new Float32Array(n);
      for (let i = 0; i < n; i++) values[i] = clamp(instantSpeedAt(clip, lt0 + (remaining * i) / (n - 1)), 0.0625, 16);
      src.playbackRate.setValueCurveAtTime(values, when, remaining);
    } else {
      src.playbackRate.value = clamp(clip.speed || 1, 0.0625, 16);
    }
    const chain = buildChain(clip);
    const g = chain.gain.gain;
    g.setValueAtTime(envelopeAt(clip, lt0), when);
    const a = clip.audio || {};
    const fi = a.fadeIn || 0;
    const fo = a.fadeOut || 0;
    const v = a.volume ?? 1;
    if (fi > 0 && lt0 < fi) g.linearRampToValueAtTime(v * clamp(1, 0, 1), when + (fi - lt0));
    if (fo > 0) {
      const foStart = clip.duration - fo;
      if (lt0 < foStart) g.setValueAtTime(v, when + (foStart - lt0));
      g.linearRampToValueAtTime(0, when + remaining);
    }
    src.connect(chain.input);
    src.start(when, offset);
    src.stop(when + remaining);
    active.push({ src, out: chain.out });
  }
  return anchor;
}

/** Pré-escuta de um asset de áudio da biblioteca (sem tocar na timeline). */
let previewNode = null;
export async function previewAsset(asset, onEnd) {
  stopPreview();
  const c = ensureContext();
  if (!c) return;
  const buf = await loadBuffer(asset);
  if (!buf) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = 0.8;
  src.connect(g);
  g.connect(master);
  src.onended = () => {
    if (previewNode?.src === src) previewNode = null;
    onEnd?.();
  };
  src.start(0, 0, Math.min(buf.duration, 8));
  previewNode = { src, g };
}

export function stopPreview() {
  if (previewNode) {
    try {
      previewNode.src.stop();
    } catch {
      /* ok */
    }
    previewNode = null;
  }
}
