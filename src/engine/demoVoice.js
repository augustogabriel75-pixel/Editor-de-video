/**
 * Voz de demonstração: lê a transcrição demo com a síntese de fala do navegador (pt-BR)
 * enquanto a timeline toca. É apenas um recurso de demo — áudios reais usam o audioEngine.
 */
import { native } from '../lib/native';

let lastTime = null;
let enabled = true;
let voice = null;

/** No app Android usa o TextToSpeech nativo (o WebView não tem speechSynthesis). */
const useNative = () => {
  try {
    return !!native && native.ttsAvailable();
  } catch {
    return false;
  }
};
const hasVoice = () => useNative() || (typeof window !== 'undefined' && 'speechSynthesis' in window);

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => /pt[-_]BR/i.test(v.lang)) || voices.find((v) => /^pt/i.test(v.lang)) || null;
}

export function setDemoVoiceEnabled(v) {
  enabled = v;
  if (!v) stopDemoVoice();
}

export function stopDemoVoice() {
  lastTime = null;
  if (native) {
    try {
      native.stopSpeaking();
    } catch {
      /* ignore */
    }
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

/** Chamado a cada tick de reprodução; fala as frases cujo início foi cruzado. */
export function tickDemoVoice(state, time) {
  if (!enabled || !hasVoice()) return;
  const prev = lastTime;
  lastTime = time;
  if (prev === null || time < prev || time - prev > 0.5) return;
  const tracks = new Map(state.tracks.map((t) => [t.id, t]));
  for (const clip of state.clips) {
    if (!clip.audio?.demoVoice || clip.audio.muted || clip.disabled) continue;
    if (tracks.get(clip.trackId)?.muted) continue;
    const asset = state.assets.find((a) => a.id === clip.assetId);
    const transcript = asset?.transcript;
    if (!transcript) continue;
    for (const s of transcript.sentences) {
      const at = clip.start + (s.start - clip.trimIn) / (clip.speed || 1);
      if (at > prev && at <= time && at < clip.start + clip.duration) {
        if (useNative()) {
          native.speak(s.text, 1.05 * (clip.speed || 1), Math.min(1, clip.audio.volume ?? 1));
          continue;
        }
        if (!voice) voice = pickVoice();
        const u = new SpeechSynthesisUtterance(s.text);
        u.lang = 'pt-BR';
        if (voice) u.voice = voice;
        u.rate = 1.12 * (clip.speed || 1);
        u.volume = Math.min(1, clip.audio.volume ?? 1);
        window.speechSynthesis.speak(u);
      }
    }
  }
}
