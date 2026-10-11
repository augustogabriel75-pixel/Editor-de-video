/**
 * Sintetizador procedural de músicas e efeitos sonoros (SFX) de demonstração.
 * Gera amostras PCM (Float32Array, mono) sem depender de arquivos externos — assim o
 * projeto demo tem trilha sonora real, com batidas reais que o motor de IA consegue detectar.
 */
import { seeded } from '../lib/utils';

export const SYNTH_RATE = 22050;

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function addKick(buf, at, gain = 1) {
  const len = Math.floor(0.42 * SYNTH_RATE);
  const s0 = Math.floor(at * SYNTH_RATE);
  const k = 28;
  for (let i = 0; i < len && s0 + i < buf.length; i++) {
    const t = i / SYNTH_RATE;
    const phase = 2 * Math.PI * (44 * t + (90 / k) * (1 - Math.exp(-k * t)));
    const env = Math.exp(-t * 7.5) * (t < 0.002 ? t / 0.002 : 1);
    buf[s0 + i] += Math.sin(phase) * env * 0.9 * gain;
  }
}

function addSnare(buf, at, rnd, gain = 1, clap = false) {
  const len = Math.floor(0.25 * SYNTH_RATE);
  const s0 = Math.floor(at * SYNTH_RATE);
  let prev = 0;
  for (let i = 0; i < len && s0 + i < buf.length; i++) {
    const t = i / SYNTH_RATE;
    const n = rnd() * 2 - 1;
    const hp = n - prev * 0.6;
    prev = n;
    const burst = clap ? (t < 0.03 ? Math.abs(Math.sin(t * 330)) : 1) : 1;
    const noise = hp * Math.exp(-t * (clap ? 22 : 17)) * 0.42 * burst;
    const body = clap ? 0 : Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 25) * 0.3;
    buf[s0 + i] += (noise + body) * gain;
  }
}

function addHat(buf, at, rnd, gain = 1, open = false) {
  const len = Math.floor((open ? 0.22 : 0.06) * SYNTH_RATE);
  const s0 = Math.floor(at * SYNTH_RATE);
  let prev = 0;
  for (let i = 0; i < len && s0 + i < buf.length; i++) {
    const t = i / SYNTH_RATE;
    const n = rnd() * 2 - 1;
    const hp = n - prev;
    prev = n;
    buf[s0 + i] += hp * Math.exp(-t * (open ? 14 : 70)) * 0.12 * gain;
  }
}

function addTone(buf, at, dur, hz, { gain = 0.2, attack = 0.01, release = 0.2, wave = 'sine', detune = 0, glideTo = null } = {}) {
  const total = dur + release;
  const len = Math.floor(total * SYNTH_RATE);
  const s0 = Math.floor(at * SYNTH_RATE);
  let phase = 0;
  for (let i = 0; i < len && s0 + i < buf.length; i++) {
    const t = i / SYNTH_RATE;
    const f = (glideTo ? hz + (glideTo - hz) * Math.min(1, t / dur) : hz) * (1 + detune);
    phase += (2 * Math.PI * f) / SYNTH_RATE;
    let v;
    if (wave === 'tri') v = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else if (wave === 'saw') v = ((phase / Math.PI) % 2) - 1;
    else v = Math.sin(phase);
    let env = t < attack ? t / attack : 1;
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / release);
    buf[s0 + i] += v * env * gain;
  }
}

function addChord(buf, at, dur, notes, opts) {
  notes.forEach((n, i) => {
    addTone(buf, at, dur, midiToHz(n), { ...opts, detune: (i % 2 ? 1 : -1) * 0.002 });
  });
}

function softClip(buf, drive = 1.2) {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Math.tanh(buf[i] * drive);
    peak = Math.max(peak, Math.abs(buf[i]));
  }
  if (peak > 0) for (let i = 0; i < buf.length; i++) buf[i] *= 0.92 / peak;
  return buf;
}

/** Simples lowpass de um polo para suavizar timbres. */
function lowpass(buf, alpha) {
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += alpha * (buf[i] - y);
    buf[i] = y;
  }
  return buf;
}

const MUSIC = {
  lofi: {
    bpm: 85,
    build(buf, dur, rnd) {
      const beat = 60 / 85;
      const step = beat / 4;
      const chords = [[57, 60, 64, 67], [50, 57, 60, 65], [55, 59, 62, 65], [48, 55, 59, 64]];
      const bars = Math.ceil(dur / (beat * 4));
      const pad = new Float32Array(buf.length);
      for (let b = 0; b < bars; b++) {
        const t0 = b * beat * 4;
        addChord(pad, t0, beat * 4 - 0.05, chords[b % 4], { gain: 0.07, attack: 0.25, release: 0.5, wave: 'tri' });
        addTone(buf, t0, beat * 1.5, midiToHz(chords[b % 4][0] - 12), { gain: 0.22, attack: 0.02, release: 0.2 });
        addTone(buf, t0 + beat * 2.5, beat, midiToHz(chords[b % 4][0] - 12), { gain: 0.18, attack: 0.02, release: 0.2 });
        for (let s = 0; s < 16; s++) {
          const swing = s % 2 ? step * 0.18 : 0;
          const t = t0 + s * step + swing;
          if (s === 0 || s === 10) addKick(buf, t, 0.85);
          if (s === 4 || s === 12) addSnare(buf, t, rnd, 0.7);
          if (s % 2 === 0) addHat(buf, t, rnd, 0.8 + rnd() * 0.3);
        }
      }
      lowpass(pad, 0.35);
      for (let i = 0; i < buf.length; i++) buf[i] += pad[i];
      lowpass(buf, 0.55);
    },
  },
  trap: {
    bpm: 140,
    build(buf, dur, rnd) {
      const beat = 60 / 140;
      const step = beat / 4;
      const roots = [41, 41, 44, 39];
      const bars = Math.ceil(dur / (beat * 4));
      for (let b = 0; b < bars; b++) {
        const t0 = b * beat * 4;
        const root = roots[b % 4];
        addChord(buf, t0, beat * 4, [root + 24, root + 27, root + 31], { gain: 0.045, attack: 0.08, release: 0.3, wave: 'saw' });
        addTone(buf, t0, beat * 2.6, midiToHz(root - 12), { gain: 0.42, attack: 0.005, release: 0.4, glideTo: midiToHz(root - 13) });
        for (let s = 0; s < 16; s++) {
          const t = t0 + s * step;
          if (s === 0 || s === 7 || s === 10) addKick(buf, t, 1);
          if (s === 8) addSnare(buf, t, rnd, 1, true);
          addHat(buf, t, rnd, 0.9);
          if ((b % 2 === 1 && s >= 13) || s === 6) addHat(buf, t + step / 2, rnd, 0.7);
        }
      }
    },
  },
  house: {
    bpm: 124,
    build(buf, dur, rnd) {
      const beat = 60 / 124;
      const step = beat / 4;
      const chords = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];
      const bars = Math.ceil(dur / (beat * 4));
      for (let b = 0; b < bars; b++) {
        const t0 = b * beat * 4;
        for (let s = 0; s < 16; s++) {
          const t = t0 + s * step;
          if (s % 4 === 0) addKick(buf, t, 1);
          if (s === 4 || s === 12) addSnare(buf, t, rnd, 0.8, true);
          if (s % 4 === 2) addHat(buf, t, rnd, 1.1, true);
          if (s === 3 || s === 6 || s === 11 || s === 14) addChord(buf, t, step * 1.2, chords[b % 4], { gain: 0.06, attack: 0.005, release: 0.08, wave: 'saw' });
          if (s % 4 === 2) addTone(buf, t, step * 1.5, midiToHz(chords[b % 4][0] - 24), { gain: 0.26, release: 0.05 });
        }
      }
      lowpass(buf, 0.7);
    },
  },
  cinematic: {
    bpm: 70,
    build(buf, dur, rnd) {
      const beat = 60 / 70;
      const chords = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]];
      const bars = Math.ceil(dur / (beat * 4));
      for (let b = 0; b < bars; b++) {
        const t0 = b * beat * 4;
        addChord(buf, t0, beat * 4, chords[b % 4], { gain: 0.08, attack: 0.9, release: 1.2, wave: 'tri' });
        addKick(buf, t0, 1.1);
        addTone(buf, t0, 1.2, 38, { gain: 0.5, attack: 0.005, release: 1 });
        if (b % 2 === 1) addSnare(buf, t0 + beat * 3, rnd, 0.6);
        addHat(buf, t0 + beat * 2, rnd, 0.6, true);
      }
      lowpass(buf, 0.4);
    },
  },
};

const SFX = {
  whoosh(buf, rnd) {
    let y = 0;
    for (let i = 0; i < buf.length; i++) {
      const p = i / buf.length;
      const a = 0.02 + 0.5 * Math.sin(Math.PI * p);
      y += a * (rnd() * 2 - 1 - y);
      buf[i] = y * Math.sin(Math.PI * p) * 1.6;
    }
  },
  pop(buf) {
    addTone(buf, 0, 0.06, 900, { gain: 0.7, attack: 0.002, release: 0.05, glideTo: 220 });
  },
  ding(buf) {
    addTone(buf, 0, 0.01, 1318.5, { gain: 0.5, attack: 0.002, release: 1.1 });
    addTone(buf, 0, 0.01, 2637, { gain: 0.18, attack: 0.002, release: 0.6 });
  },
  cash(buf, rnd) {
    addSnare(buf, 0, rnd, 0.8, true);
    addTone(buf, 0.09, 0.01, 2093, { gain: 0.45, attack: 0.002, release: 0.8 });
    addTone(buf, 0.09, 0.01, 2637, { gain: 0.35, attack: 0.002, release: 0.7 });
    addTone(buf, 0.09, 0.01, 4186, { gain: 0.1, attack: 0.002, release: 0.4 });
  },
  boom(buf, rnd) {
    addKick(buf, 0, 1.2);
    addTone(buf, 0, 0.5, 55, { gain: 0.6, attack: 0.003, release: 0.9, glideTo: 30 });
    let y = 0;
    for (let i = 0; i < buf.length; i++) {
      const t = i / SYNTH_RATE;
      y += 0.05 * (rnd() * 2 - 1 - y);
      buf[i] += y * Math.exp(-t * 3) * 2;
    }
  },
  riser(buf, rnd) {
    const dur = buf.length / SYNTH_RATE;
    addTone(buf, 0, dur - 0.05, 220, { gain: 0.25, attack: dur * 0.8, release: 0.05, glideTo: 1200, wave: 'saw' });
    let y = 0;
    for (let i = 0; i < buf.length; i++) {
      const p = i / buf.length;
      y += (0.05 + p * 0.5) * (rnd() * 2 - 1 - y);
      buf[i] += y * p * p * 0.6;
    }
  },
  click(buf) {
    addTone(buf, 0, 0.005, 2500, { gain: 0.6, attack: 0.0005, release: 0.02 });
  },
};

export const MUSIC_LIBRARY = [
  { id: 'lofi', name: 'Lo-fi Chill', bpm: 85, mood: 'Relaxante', duration: 32, colors: ['#a78bfa', '#f472b6'] },
  { id: 'trap', name: 'Trap Energético', bpm: 140, mood: 'Energia', duration: 32, colors: ['#f43f5e', '#f97316'] },
  { id: 'house', name: 'House Groove', bpm: 124, mood: 'Dançante', duration: 32, colors: ['#22d3ee', '#3b82f6'] },
  { id: 'cinematic', name: 'Épico Cinemático', bpm: 70, mood: 'Épico', duration: 32, colors: ['#facc15', '#78350f'] },
];

export const SFX_LIBRARY = [
  { id: 'whoosh', name: 'Whoosh', duration: 0.8, colors: ['#94a3b8', '#e2e8f0'] },
  { id: 'pop', name: 'Pop', duration: 0.2, colors: ['#f472b6', '#fb7185'] },
  { id: 'ding', name: 'Ding', duration: 1.2, colors: ['#fde047', '#fbbf24'] },
  { id: 'cash', name: 'Caixa Registradora', duration: 1, colors: ['#22c55e', '#facc15'] },
  { id: 'boom', name: 'Boom Cinemático', duration: 1.6, colors: ['#ef4444', '#7f1d1d'] },
  { id: 'riser', name: 'Riser (Subida)', duration: 1.6, colors: ['#8b5cf6', '#22d3ee'] },
  { id: 'click', name: 'Clique', duration: 0.08, colors: ['#e5e7eb', '#9ca3af'] },
];

const cache = new Map();

/** Retorna (e memoiza) as amostras PCM de uma música ou SFX da biblioteca. */
export function getSynthSamples(kind, id) {
  const key = `${kind}:${id}`;
  if (cache.has(key)) return cache.get(key);
  const rnd = seeded(key);
  let buf;
  if (kind === 'music') {
    const meta = MUSIC_LIBRARY.find((m) => m.id === id) || MUSIC_LIBRARY[0];
    buf = new Float32Array(Math.floor(meta.duration * SYNTH_RATE));
    MUSIC[meta.id].build(buf, meta.duration, rnd);
    softClip(buf, 1.4);
  } else {
    const meta = SFX_LIBRARY.find((m) => m.id === id) || SFX_LIBRARY[0];
    buf = new Float32Array(Math.floor(meta.duration * SYNTH_RATE));
    SFX[meta.id](buf, rnd);
    softClip(buf, 1.1);
  }
  cache.set(key, buf);
  return buf;
}

/** Picos (máximo absoluto) por bucket — usados para desenhar formas de onda. */
export function computePeaks(samples, buckets = 400) {
  const out = new Float32Array(buckets);
  const size = Math.max(1, Math.floor(samples.length / buckets));
  for (let b = 0; b < buckets; b++) {
    let m = 0;
    const s0 = b * size;
    for (let i = 0; i < size && s0 + i < samples.length; i++) {
      const v = Math.abs(samples[s0 + i]);
      if (v > m) m = v;
    }
    out[b] = m;
  }
  return out;
}
