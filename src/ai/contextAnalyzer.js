/**
 * Orquestrador "Analisar Contexto do Vídeo".
 * Executa o pipeline completo e reporta progresso por etapa:
 *   áudio -> speech-to-text -> quadros -> batidas/ênfase -> contexto (palavras-chave/tópicos).
 * Toda a análise numérica é real (WebAudio/Canvas); só a transcrição demo é pré-gravada.
 */
import { decodeToMono, energyEnvelope, detectOnsets, estimateBpm, detectEmphasis, ENV_RATE } from './audioAnalysis';
import { analyzeFrames } from './frameAnalysis';
import { transcribe } from './transcriber';
import { matchWord } from './lexicon';
import { narrationEnvelope } from './demoTranscript';

export const PIPELINE_STEPS = [
  { id: 'audio', label: 'Extraindo e decodificando áudio' },
  { id: 'stt', label: 'Transcrevendo fala (speech-to-text)' },
  { id: 'frames', label: 'Lendo quadros do vídeo (visão)' },
  { id: 'beats', label: 'Detectando batidas e ênfase da fala' },
  { id: 'context', label: 'Entendendo contexto e palavras-chave' },
  { id: 'generate', label: 'Gerando motions contextuais' },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const decodedCache = new Map();

async function audioTracks(state) {
  const assets = new Map(state.assets.map((a) => [a.id, a]));
  const tracks = new Map(state.tracks.map((t) => [t.id, t]));
  const out = [];
  for (const clip of state.clips) {
    if (clip.disabled || tracks.get(clip.trackId)?.muted) continue;
    const asset = assets.get(clip.assetId);
    if (!asset) continue;
    if (asset.transcript) {
      const env = narrationEnvelope(asset.transcript, asset.duration, ENV_RATE);
      out.push({ clip, asset, env, rate: ENV_RATE, role: 'voice' });
      continue;
    }
    const audible = asset.type === 'audio' || (asset.type === 'video' && asset.hasAudio);
    if (!audible || asset.synth?.kind === 'sfx') continue;
    let dec = decodedCache.get(asset.id);
    if (dec === undefined) {
      dec = await decodeToMono(asset);
      decodedCache.set(asset.id, dec);
    }
    if (!dec) continue;
    const env = energyEnvelope(dec.samples, dec.sampleRate, ENV_RATE);
    out.push({ clip, asset, env, rate: ENV_RATE, role: asset.synth?.kind === 'music' || asset.category === 'Música' ? 'music' : asset.type === 'video' ? 'voice' : 'music' });
  }
  return out;
}

/** Converte tempo da fonte para tempo da timeline (velocidade constante). */
const toTimeline = (clip, srcT) => clip.start + (srcT - clip.trimIn) / (clip.speed || 1);
const inClip = (clip, t) => t >= clip.start && t <= clip.start + clip.duration;

export async function analyzeContext(state, { scriptText = '', onStep, onProgress } = {}) {
  const warnings = [];
  const step = async (id, fn) => {
    onStep?.(id, 'running');
    const r = await fn();
    onStep?.(id, 'done');
    return r;
  };

  const audio = await step('audio', async () => {
    onProgress?.(0.04);
    const a = await audioTracks(state);
    await wait(250);
    return { tracks: a };
  });
  onProgress?.(0.16);

  const transcript = await step('stt', async () => {
    await wait(450);
    const tr = await transcribe(state, audio, scriptText);
    if (tr.source === 'none') warnings.push('Nenhuma fala transcrita: cole o roteiro no campo "Transcrição" ou configure um provedor STT (Whisper). Zooms e transições no beat continuam funcionando.');
    return tr;
  });
  onProgress?.(0.32);

  const frames = await step('frames', async () => analyzeFrames(state, { fps: 2, onProgress: (p) => onProgress?.(0.32 + p * 0.28) }));
  onProgress?.(0.62);

  const rhythm = await step('beats', async () => {
    await wait(300);
    let beats = [];
    let bpm = null;
    const music = audio.tracks.filter((a) => a.role === 'music');
    for (const m of music) {
      const { onsets, novelty } = detectOnsets(m.env, m.rate);
      bpm = bpm || estimateBpm(novelty, m.rate);
      onsets.forEach((o) => {
        const t = toTimeline(m.clip, o.t);
        if (inClip(m.clip, t)) beats.push({ t, strength: o.strength });
      });
    }
    beats.sort((a, b) => a.t - b.t);
    const emphasis = [];
    for (const v of audio.tracks.filter((a) => a.role === 'voice')) {
      detectEmphasis(v.env, v.rate).forEach((e) => {
        const t = toTimeline(v.clip, e.t);
        if (inClip(v.clip, t)) emphasis.push({ t, strength: e.strength });
      });
    }
    emphasis.sort((a, b) => a.t - b.t);
    return { beats, bpm, emphasis };
  });
  onProgress?.(0.78);

  const context = await step('context', async () => {
    await wait(350);
    const keywords = [];
    for (const w of transcript.words) {
      const e = matchWord(w.w);
      if (e) keywords.push({ word: w.w.replace(/[.,;:!?]+$/, ''), norm: w.norm, t: w.start, end: w.end, template: e.template, label: e.label, topic: e.topic, sfx: e.sfx, sentence: w.sentence, emphasis: w.emphasis ?? 0.5 });
    }
    const topicCount = {};
    keywords.forEach((k) => (topicCount[k.topic] = (topicCount[k.topic] || 0) + 1));
    const topics = Object.entries(topicCount)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)
      .slice(0, 4);
    const energy = rhythm.bpm ? (rhythm.bpm >= 120 ? 'Energético' : rhythm.bpm >= 95 ? 'Animado' : 'Calmo') : 'Neutro';
    const mood = frames.summary.brightness < 0.3 ? `${energy} · Noturno` : `${energy} · ${frames.summary.saturation > 0.35 ? 'Vibrante' : 'Suave'}`;
    return { keywords, topics, mood };
  });
  onProgress?.(0.9);

  return {
    createdAt: Date.now(),
    duration: state.duration,
    transcript,
    beats: rhythm.beats,
    bpm: rhythm.bpm,
    emphasis: rhythm.emphasis,
    scenes: frames.scenes,
    frames: frames.summary,
    keywords: context.keywords,
    topics: context.topics,
    mood: context.mood,
    warnings,
  };
}
