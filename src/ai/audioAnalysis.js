import { decodeAudioFallback } from '../lib/mediaProbe';
/**
 * Análise de áudio real (sem rede): envelope de energia, detecção de onsets/batidas,
 * estimativa de BPM, picos de ênfase e detecção de atividade de voz (VAD).
 */
import { clamp } from '../lib/utils';
import { getSynthSamples, SYNTH_RATE } from '../audio/synth';

export const ENV_RATE = 50; // quadros de envelope por segundo

/** Decodifica qualquer asset de áudio/vídeo para PCM mono. */
export async function decodeToMono(asset) {
  if (asset.synth) return { samples: getSynthSamples(asset.synth.kind, asset.synth.id), sampleRate: SYNTH_RATE };
  if (!asset.src) return null;
  try {
    const blob = await (await fetch(asset.src)).blob();
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OAC(1, 22050, 22050);
    let buf = null;
    try {
      buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    } catch {
      // ex.: .mov do iPhone em navegadores cujo decodeAudioData não lê QuickTime
      buf = await decodeAudioFallback(blob).catch(() => null);
    }
    if (!buf) return null;
    const ch0 = buf.getChannelData(0);
    if (buf.numberOfChannels > 1) {
      const ch1 = buf.getChannelData(1);
      const mono = new Float32Array(ch0.length);
      for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i] + ch1[i]) / 2;
      return { samples: mono, sampleRate: buf.sampleRate };
    }
    return { samples: ch0, sampleRate: buf.sampleRate };
  } catch {
    return null;
  }
}

/** RMS por janela -> Float32Array (ENV_RATE por segundo), normalizado 0..1. */
export function energyEnvelope(samples, sampleRate, rate = ENV_RATE) {
  const hop = Math.max(1, Math.floor(sampleRate / rate));
  const n = Math.floor(samples.length / hop);
  const env = new Float32Array(n);
  let max = 1e-9;
  for (let f = 0; f < n; f++) {
    let acc = 0;
    const s0 = f * hop;
    for (let i = 0; i < hop; i++) {
      const v = samples[s0 + i] || 0;
      acc += v * v;
    }
    env[f] = Math.sqrt(acc / hop);
    if (env[f] > max) max = env[f];
  }
  for (let f = 0; f < n; f++) env[f] /= max;
  return env;
}

function meanStd(arr, a, b) {
  let s = 0;
  let s2 = 0;
  let n = 0;
  for (let i = Math.max(0, a); i < Math.min(arr.length, b); i++) {
    s += arr[i];
    s2 += arr[i] * arr[i];
    n++;
  }
  const m = n ? s / n : 0;
  return { m, sd: n ? Math.sqrt(Math.max(0, s2 / n - m * m)) : 0 };
}

/** Função de novidade (fluxo positivo de energia) + picos com limiar adaptativo. */
export function detectOnsets(env, rate = ENV_RATE, minGap = 0.22) {
  const nov = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) nov[i] = Math.max(0, env[i] - env[i - 1]);
  const out = [];
  const win = Math.round(rate * 0.75);
  let last = -Infinity;
  for (let i = 1; i < nov.length - 1; i++) {
    if (nov[i] < nov[i - 1] || nov[i] < nov[i + 1]) continue;
    const { m, sd } = meanStd(nov, i - win, i + win);
    if (nov[i] > m + 1.4 * sd && nov[i] > 0.04) {
      const t = i / rate;
      if (t - last >= minGap) {
        out.push({ t, strength: nov[i] });
        last = t;
      }
    }
  }
  const maxS = Math.max(1e-6, ...out.map((o) => o.strength));
  out.forEach((o) => (o.strength = clamp(o.strength / maxS, 0, 1)));
  return { onsets: out, novelty: nov };
}

/** Autocorrelação da função de novidade para estimar o andamento (60–180 BPM). */
export function estimateBpm(novelty, rate = ENV_RATE) {
  let best = 0;
  let bestLag = 0;
  const minLag = Math.round((60 / 180) * rate);
  const maxLag = Math.round((60 / 60) * rate);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acc = 0;
    for (let i = lag; i < novelty.length; i++) acc += novelty[i] * novelty[i - lag];
    const bpm = (60 * rate) / lag;
    const prior = Math.exp(-Math.pow(Math.log2(bpm / 110), 2) * 1.2);
    acc *= prior;
    if (acc > best) {
      best = acc;
      bestLag = lag;
    }
  }
  return bestLag ? Math.round((60 * rate) / bestLag) : null;
}

/** Picos de ênfase da fala (máximos locais do envelope suavizado). */
export function detectEmphasis(env, rate = ENV_RATE, minGap = 2.4) {
  const sm = new Float32Array(env.length);
  const k = Math.round(rate * 0.12);
  for (let i = 0; i < env.length; i++) {
    let s = 0;
    let n = 0;
    for (let j = i - k; j <= i + k; j++) if (j >= 0 && j < env.length) (s += env[j]), n++;
    sm[i] = s / n;
  }
  const { m, sd } = meanStd(sm, 0, sm.length);
  const cands = [];
  for (let i = 1; i < sm.length - 1; i++) {
    if (sm[i] >= sm[i - 1] && sm[i] >= sm[i + 1] && sm[i] > m + 0.7 * sd) cands.push({ t: i / rate, strength: sm[i] });
  }
  cands.sort((a, b) => b.strength - a.strength);
  const picked = [];
  for (const c of cands) if (picked.every((p) => Math.abs(p.t - c.t) >= minGap)) picked.push(c);
  const maxS = Math.max(1e-6, ...picked.map((p) => p.strength));
  return picked.map((p) => ({ ...p, strength: clamp(p.strength / maxS, 0, 1) })).sort((a, b) => a.t - b.t);
}

/** Segmentos com voz (energia acima do limiar), unindo pausas curtas. */
export function voiceActivity(env, rate = ENV_RATE, threshold = 0.12, minPause = 0.25) {
  const segs = [];
  let start = null;
  for (let i = 0; i < env.length; i++) {
    const on = env[i] > threshold;
    if (on && start === null) start = i;
    if (!on && start !== null) {
      segs.push({ start: start / rate, end: i / rate });
      start = null;
    }
  }
  if (start !== null) segs.push({ start: start / rate, end: env.length / rate });
  const merged = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && s.start - last.end < minPause) last.end = s.end;
    else merged.push({ ...s });
  }
  return merged.filter((s) => s.end - s.start > 0.15);
}
