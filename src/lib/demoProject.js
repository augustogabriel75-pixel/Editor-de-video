/** Projeto de demonstração carregado na abertura do MotionCut. */
import { DEMO_ASSETS, demoThumbnail } from '../engine/demoSources';
import { MUSIC_LIBRARY, SFX_LIBRARY } from '../audio/synth';
import { DEMO_TRANSCRIPT } from '../ai/demoTranscript';
import { mediaClip, textClip } from './clipFactory';

export const DEFAULT_TRACKS = [
  { id: 'trk-ai-sticker', kind: 'motion', name: 'Stickers IA', lane: 'sticker', ai: true, height: 32 },
  { id: 'trk-ai-typo', kind: 'motion', name: 'Tipografia IA', lane: 'typography', ai: true, height: 32 },
  { id: 'trk-ai-camera', kind: 'motion', name: 'Câmera & Transições IA', lane: 'camera', ai: true, height: 32 },
  { id: 'trk-text', kind: 'text', name: 'Texto', height: 34 },
  { id: 'trk-captions', kind: 'text', name: 'Legendas', height: 34 },
  { id: 'trk-pip', kind: 'overlay', name: 'Sobreposição (PIP)', height: 40 },
  { id: 'trk-main', kind: 'video', name: 'Vídeo Principal', main: true, height: 56 },
  { id: 'trk-voice', kind: 'audio', name: 'Narração', height: 38 },
  { id: 'trk-music', kind: 'audio', name: 'Música', height: 38 },
  { id: 'trk-sfx', kind: 'audio', name: 'Efeitos Sonoros', height: 32 },
].map((t) => ({ muted: false, hidden: false, locked: false, ...t }));

export function createLibraryAssets() {
  const demo = DEMO_ASSETS.map((a) => {
    let thumb = null;
    try {
      thumb = demoThumbnail(a);
    } catch {
      /* ambiente sem canvas */
    }
    return { ...a, thumb };
  });
  const narration = {
    id: 'demo-narration',
    type: 'audio',
    name: 'Narração · Como ganhar dinheiro',
    duration: 30.5,
    transcript: DEMO_TRANSCRIPT,
    voiceOnly: true,
    category: 'Voz',
  };
  const music = MUSIC_LIBRARY.map((m) => ({ id: `music-${m.id}`, type: 'audio', name: m.name, duration: m.duration, synth: { kind: 'music', id: m.id }, bpm: m.bpm, mood: m.mood, colors: m.colors, category: 'Música' }));
  const sfx = SFX_LIBRARY.map((m) => ({ id: `sfx-${m.id}`, type: 'audio', name: m.name, duration: m.duration, synth: { kind: 'sfx', id: m.id }, colors: m.colors, category: 'Efeitos Sonoros' }));
  return [...demo, narration, ...music, ...sfx];
}

export function createDemoProject() {
  const assets = createLibraryAssets();
  const A = (id) => assets.find((a) => a.id === id);
  const T = (id) => DEFAULT_TRACKS.find((t) => t.id === id);
  const main1 = { ...mediaClip(A('demo-presenter'), T('trk-main'), 0), duration: 12, name: 'Apresentador · Intro' };
  const main2 = { ...mediaClip(A('demo-charts'), T('trk-main'), 12), duration: 4, trimIn: 0.3, name: 'B-roll · Gráficos', transitionIn: { id: 'zoom-in', duration: 0.5 } };
  const main3 = { ...mediaClip(A('demo-presenter'), T('trk-main'), 16), duration: 14, trimIn: 16, name: 'Apresentador · Dicas', transitionIn: { id: 'fade', duration: 0.5 } };
  const title = textClip({
    trackId: 'trk-text',
    start: 0.2,
    duration: 3.3,
    content: 'COMO GANHAR DINHEIRO ONLINE',
    name: 'Título',
    style: { font: 'Montserrat', weight: 900, size: 72, color: '#ffffff', stroke: 6, strokeColor: '#0b0b12', uppercase: true, shadow: true, gradient: ['#ffffff', '#fde68a'] },
    transform: { y: -0.3 },
  });
  const voice = { ...mediaClip(A('demo-narration'), T('trk-voice'), 0), duration: 30 };
  const music = { ...mediaClip(A('music-lofi'), T('trk-music'), 0), duration: 30, audio: { volume: 0.32, fadeIn: 1, fadeOut: 2, muted: false, denoise: false, denoiseLevel: 60 } };
  return {
    project: { title: 'Como ganhar dinheiro online', aspect: '16:9', background: { mode: 'blur', color: '#000000' } },
    tracks: DEFAULT_TRACKS,
    clips: [main1, main2, main3, title, voice, music],
    assets,
  };
}
