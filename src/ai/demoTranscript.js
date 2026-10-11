/**
 * Transcrição de demonstração (pt-BR) com marcação de tempo por palavra.
 * Em produção esta etapa viria de um provedor speech-to-text (Whisper, Deepgram, etc.) —
 * veja src/ai/transcriber.js. Os tempos são relativos à fonte "Narração".
 */
import { normalizeWord } from '../lib/utils';

const SENTENCES = [
  [0.4, 3.6, 'Hoje eu vou te mostrar como ganhar dinheiro na internet.'],
  [4.0, 7.4, 'Tudo começa com uma ideia simples e muita criatividade.'],
  [7.8, 11.4, 'Quando você entende o seu público, o crescimento vem rápido.'],
  [12.0, 15.4, 'Os números não mentem: as vendas subiram como um foguete.'],
  [15.9, 19.2, 'Mas cuidado, o tempo é o seu recurso mais valioso.'],
  [19.6, 23.0, 'Faça o que você ama e coloque o coração no seu trabalho.'],
  [23.4, 26.8, 'Com foco e consistência, o sucesso é inevitável.'],
  [27.2, 29.6, 'Curtiu? Então segue para mais dicas!'],
];

/** Palavras que o "locutor" enfatiza (volume maior na fala). */
const EMPHASIS = new Set(['dinheiro', 'ideia', 'criatividade', 'publico', 'crescimento', 'foguete', 'tempo', 'coracao', 'sucesso', 'foco', 'segue', 'vendas']);

/** Distribui palavras ao longo do intervalo da frase, proporcional ao tamanho de cada palavra. */
export function timeWords(text, start, end, sentenceIndex = 0) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const weights = tokens.map((w) => 0.35 + normalizeWord(w).length * 0.11 + (/[,.:!?]$/.test(w) ? 0.25 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = start;
  return tokens.map((w, i) => {
    const d = ((end - start) * weights[i]) / total;
    const word = {
      w,
      norm: normalizeWord(w),
      start: +t.toFixed(3),
      end: +(t + d * 0.9).toFixed(3),
      sentence: sentenceIndex,
      emphasis: EMPHASIS.has(normalizeWord(w)) ? 1 : 0.35 + ((i * 37) % 10) / 40,
    };
    t += d;
    return word;
  });
}

export function buildDemoTranscript() {
  const sentences = SENTENCES.map(([s, e, text], i) => ({ index: i, text, start: s, end: e, words: timeWords(text, s, e, i) }));
  return { sentences, words: sentences.flatMap((s) => s.words), language: 'pt-BR' };
}

export const DEMO_TRANSCRIPT = buildDemoTranscript();

/** Palavra ativa (falada) em um tempo da fonte — usada para animar a boca do apresentador. */
export function activeWordAt(t, transcript = DEMO_TRANSCRIPT) {
  const words = transcript.words;
  let lo = 0;
  let hi = words.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const w = words[mid];
    if (t < w.start) hi = mid - 1;
    else if (t > w.end) lo = mid + 1;
    else return w;
  }
  return null;
}

/**
 * Envelope de energia (RMS normalizado, 50 Hz) sintetizado a partir das palavras.
 * Permite que a análise de ênfase funcione sobre a narração demo como funcionaria sobre um áudio real.
 */
export function narrationEnvelope(transcript, duration, rate = 50) {
  const env = new Float32Array(Math.ceil(duration * rate));
  for (const w of transcript.words) {
    const s0 = Math.floor(w.start * rate);
    const s1 = Math.ceil(w.end * rate);
    const syll = Math.max(1, Math.round(w.norm.length / 2.6));
    for (let i = s0; i < s1 && i < env.length; i++) {
      const p = (i - s0) / Math.max(1, s1 - s0);
      const bumps = 0.55 + 0.45 * Math.abs(Math.sin(p * Math.PI * syll));
      env[i] = Math.max(env[i], (0.35 + 0.65 * w.emphasis) * bumps * Math.sin(Math.PI * Math.min(1, p * 1.1)));
    }
  }
  return env;
}
