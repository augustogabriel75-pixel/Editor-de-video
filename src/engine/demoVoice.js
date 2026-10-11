/**
 * Voz de demonstração: lê a transcrição demo com a síntese de fala do navegador (pt-BR)
 * enquanto a timeline toca. É apenas um recurso de demo — áudios reais usam o audioEngine.
 */
let lastTime = null;
let enabled = true;
let voice = null;

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
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

/** Chamado a cada tick de reprodução; fala as frases cujo início foi cruzado. */
export function tickDemoVoice(state, time) {
  if (!enabled || !('speechSynthesis' in window)) return;
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
