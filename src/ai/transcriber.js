/**
 * Etapa speech-to-text.
 *
 * Provedores:
 *  - "demo"     : a narração demo já traz timestamps por palavra (simula a saída de um STT).
 *  - "aligned"  : o usuário cola o roteiro e o MotionCut alinha as palavras aos trechos de voz
 *                 detectados (VAD real sobre o áudio importado).
 *  - Para STT real, implemente `customProvider` (ex.: Whisper via API ou transformers.js) que
 *    devolva { words: [{ w, start, end }] } em segundos da fonte.
 */
import { normalizeWord } from '../lib/utils';
import { timeWords } from './demoTranscript';
import { voiceActivity, energyEnvelope } from './audioAnalysis';
import { renderMixOffline } from '../engine/audioEngine';
import { whisperTranscribeSegments } from './whisper';

/** Clipes com fala potencial: áudio/vídeo importados (não música sintetizada, SFX ou narração demo). */
const isSpeechClip = (clip, asset) => !!asset && !!asset.src && !asset.synth && !asset.transcript && (asset.type === 'audio' || (asset.type === 'video' && asset.hasAudio));

const sttCache = new Map();

function speechSignature(state) {
  return state.clips
    .filter((c) => !c.disabled && isSpeechClip(c, state.assets.find((a) => a.id === c.assetId)))
    .map((c) => `${c.assetId}:${c.start.toFixed(2)}:${c.trimIn.toFixed(2)}:${c.duration.toFixed(2)}:${c.speed}`)
    .join('|');
}

/** Ênfase de cada palavra = energia da voz no trecho, normalizada pelo percentil 90. */
function applyEmphasis(words, samples, rate) {
  const env = energyEnvelope(samples, rate, 50);
  const vals = words.map((w) => {
    const a = Math.floor(w.start * 50);
    const b = Math.max(a + 1, Math.ceil(w.end * 50));
    let s = 0;
    for (let i = a; i < b && i < env.length; i++) s += env[i];
    return s / (b - a);
  });
  const sorted = [...vals].sort((x, y) => x - y);
  const p90 = sorted[Math.floor(sorted.length * 0.9)] || 1;
  words.forEach((w, i) => {
    const long = normalizeWord(w.w).length >= 6 ? 0.08 : 0;
    w.emphasis = Math.max(0.2, Math.min(1, vals[i] / (p90 || 1) + long));
  });
}

/** Divide a fala em trechos de voz (VAD) de até ~18 s, com margem. */
function speechSegments(samples, rate) {
  const env = energyEnvelope(samples, rate, 50);
  const sorted = Array.from(env).sort((a, b) => a - b);
  const noise = sorted[Math.floor(sorted.length * 0.2)] || 0;
  const thr = Math.max(0.06, noise + 0.08);
  let segs = voiceActivity(env, 50, thr, 0.45);
  const out = [];
  for (const sg of segs) {
    let a = Math.max(0, sg.start - 0.2);
    const b = Math.min(samples.length / rate, sg.end + 0.25);
    while (b - a > 18) {
      // corta no ponto de menor energia entre 10 s e 18 s
      let cut = a + 14;
      let best = Infinity;
      for (let t = a + 10; t < a + 18; t += 0.02) {
        const v = env[Math.floor(t * 50)] ?? 0;
        if (v < best) {
          best = v;
          cut = t;
        }
      }
      out.push({ start: a, end: cut });
      a = cut;
    }
    if (b - a > 0.3) out.push({ start: a, end: b });
  }
  return out;
}

/** Whisper sobre a fala da timeline (mixagem 16 kHz dos clipes com voz). */
async function whisperForTimeline(state, onDetail, language, model) {
  const sig = speechSignature(state) + `|${language}|${model}`;
  if (!speechSignature(state)) return null;
  if (sttCache.has(sig)) return sttCache.get(sig);
  onDetail?.('Preparando o áudio da fala…');
  const mix = await renderMixOffline(state, 16000, (c, a) => !c.disabled && isSpeechClip(c, a));
  const samples = new Float32Array(mix.getChannelData(0));
  const segs = speechSegments(samples, 16000);
  if (!segs.length) return null;
  const audios = segs.map((sg) => samples.slice(Math.floor(sg.start * 16000), Math.ceil(sg.end * 16000)));
  const texts = await whisperTranscribeSegments(audios, {
    language,
    model,
    onProgress: (p) => {
      if (p.stage === 'download') onDetail?.(`Baixando modelo de fala (só na 1ª vez) ${Math.round(p.progress * 100)}%${p.total ? ` de ${(p.total / 1e6).toFixed(0)} MB` : ''}`);
      else onDetail?.(`Transcrevendo a fala… ${Math.round(p.progress * 100)}%`);
    },
  });
  const words = [];
  segs.forEach((sg, i) => {
    let text = (texts[i] || '').trim();
    if (!text) return;
    if (!/[.!?]$/.test(text)) text += '.';
    words.push(...timeWords(text, sg.start + 0.15, Math.max(sg.start + 0.4, sg.end - 0.2)));
  });
  applyEmphasis(words, samples, 16000);
  const out = { words, sentences: sentencesFromWords(words), source: 'whisper', provider: `Whisper (${model === 'tiny' ? 'tiny' : 'base'}) no aparelho` };
  sttCache.set(sig, out);
  return out;
}

export let customProvider = null;
export const setCustomSttProvider = (fn) => {
  customProvider = fn;
};

function sentencesFromWords(words) {
  const sentences = [];
  let cur = [];
  words.forEach((w) => {
    cur.push(w);
    if (/[.!?]$/.test(w.w)) {
      sentences.push(cur);
      cur = [];
    }
  });
  if (cur.length) sentences.push(cur);
  return sentences.map((ws, i) => {
    ws.forEach((w) => (w.sentence = i));
    return { index: i, text: ws.map((w) => w.w).join(' '), start: ws[0].start, end: ws[ws.length - 1].end, words: ws };
  });
}

/** Distribui o roteiro pelos trechos de fala detectados. */
export function alignScript(text, segments, fallbackDuration) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const segs = segments.length ? segments : [{ start: 0.3, end: Math.max(1, fallbackDuration - 0.3) }];
  const totalSpeech = segs.reduce((a, s) => a + (s.end - s.start), 0);
  const weights = tokens.map((w) => 0.35 + normalizeWord(w).length * 0.11);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const words = [];
  let wi = 0;
  for (const s of segs) {
    const share = ((s.end - s.start) / totalSpeech) * totalW;
    let acc = 0;
    const chunk = [];
    while (wi < tokens.length && (acc < share || s === segs[segs.length - 1])) {
      chunk.push(tokens[wi]);
      acc += weights[wi];
      wi++;
    }
    if (chunk.length) words.push(...timeWords(chunk.join(' '), s.start, s.end));
  }
  return words.map((w) => ({ ...w, emphasis: 0.5 }));
}

/**
 * @param state    estado do editor
 * @param audio    resultado da etapa de áudio: { tracks: [{ clip, asset, env, rate }] }
 * @param scriptText roteiro opcional colado pelo usuário
 */
export async function transcribe(state, audio, scriptText = '', { onDetail, language = 'portuguese', model = 'base' } = {}) {
  const assets = new Map(state.assets.map((a) => [a.id, a]));
  // 1) narração com transcrição embutida (demo)
  const narr = state.clips.filter((c) => !c.disabled && assets.get(c.assetId)?.transcript);
  if (narr.length) {
    const words = [];
    for (const clip of narr) {
      const tr = assets.get(clip.assetId).transcript;
      const sp = clip.speed || 1;
      for (const w of tr.words) {
        if (w.start < clip.trimIn || w.start > clip.trimIn + clip.duration * sp) continue;
        words.push({ ...w, start: clip.start + (w.start - clip.trimIn) / sp, end: clip.start + (w.end - clip.trimIn) / sp });
      }
    }
    words.sort((a, b) => a.start - b.start);
    return { words, sentences: sentencesFromWords(words), source: 'demo', provider: 'MotionCut STT (demo)' };
  }
  // 2) provedor real configurado
  if (customProvider) {
    try {
      const res = await customProvider(state, audio);
      if (res?.words?.length) {
        const words = res.words.map((w) => ({ ...w, norm: normalizeWord(w.w), emphasis: w.emphasis ?? 0.5 }));
        return { words, sentences: sentencesFromWords(words), source: 'custom', provider: 'Provedor STT' };
      }
    } catch {
      /* cai para alinhamento */
    }
  }
  // 3) Whisper no aparelho (fala real dos vídeos/áudios importados)
  if (!scriptText.trim()) {
    try {
      const tr = await whisperForTimeline(state, onDetail, language, model);
      if (tr && tr.words.length) return tr;
    } catch (e) {
      console.warn('Whisper indisponível', e);
      onDetail?.(`Transcrição automática indisponível: ${e.message}`);
    }
  }
  // 4) roteiro colado + VAD
  if (scriptText.trim()) {
    const voiced = audio.tracks.find((a) => a.asset.type === 'video') || audio.tracks[0];
    let segments = [];
    if (voiced) {
      const sp = voiced.clip.speed || 1;
      segments = voiceActivity(voiced.env, voiced.rate)
        .map((s) => ({ start: voiced.clip.start + (s.start - voiced.clip.trimIn) / sp, end: voiced.clip.start + (s.end - voiced.clip.trimIn) / sp }))
        .filter((s) => s.end > voiced.clip.start && s.start < voiced.clip.start + voiced.clip.duration);
    }
    const words = alignScript(scriptText, segments, state.duration);
    return { words, sentences: sentencesFromWords(words), source: 'aligned', provider: 'Alinhamento local (VAD)' };
  }
  return { words: [], sentences: [], source: 'none', provider: 'Nenhum' };
}
