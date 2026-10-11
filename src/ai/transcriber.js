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
import { voiceActivity } from './audioAnalysis';

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
export async function transcribe(state, audio, scriptText = '') {
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
  // 3) roteiro colado + VAD
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
