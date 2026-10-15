/**
 * Pool de elementos <video>/<img> para mídias importadas pelo usuário.
 * Sincroniza o tempo de cada vídeo com o tempo de fonte pedido pelo renderizador.
 */
import { clamp } from '../lib/utils';

const videos = new Map();
const images = new Map();
let used = new Set();
let frameListener = () => {};

export const onFrameReady = (fn) => {
  frameListener = fn;
};

export function getVideo(asset) {
  let el = videos.get(asset.id);
  if (!el) {
    el = document.createElement('video');
    el.src = asset.src;
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.addEventListener('seeked', () => frameListener());
    el.addEventListener('loadeddata', () => frameListener());
    videos.set(asset.id, el);
  }
  return el;
}

export function videoFrame(asset, srcTime, { playing = false, rate = 1 } = {}) {
  const el = getVideo(asset);
  used.add(el);
  const dur = Number.isFinite(el.duration) ? el.duration : asset.duration || 0;
  const target = clamp(srcTime, 0, Math.max(0, dur - 0.04));
  if (playing) {
    const r = clamp(rate, 0.0625, 16);
    if (Math.abs(el.playbackRate - r) > 0.01) el.playbackRate = r;
    if (el.paused) el.play().catch(() => {});
    if (Math.abs(el.currentTime - target) > 0.3 && !el.seeking) el.currentTime = target;
  } else {
    if (!el.paused) el.pause();
    if (Math.abs(el.currentTime - target) > 0.03 && !el.seeking) el.currentTime = target;
  }
  return el.readyState >= 2 ? el : null;
}

export function getImage(asset) {
  let img = images.get(asset.id);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.onload = () => frameListener();
    img.src = asset.src;
    images.set(asset.id, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

export function beginFrame() {
  used = new Set();
}

export function endFrame() {
  for (const el of videos.values()) if (!used.has(el) && !el.paused) el.pause();
}

export function pauseAll() {
  for (const el of videos.values()) if (!el.paused) el.pause();
}

/** Posiciona o vídeo exatamente em `t` e espera o quadro (usado na exportação quadro a quadro). */
export function seekVideoExact(asset, t) {
  const el = getVideo(asset);
  return new Promise((resolve) => {
    const go = () => {
      const dur = Number.isFinite(el.duration) ? el.duration : asset.duration || 0;
      const target = clamp(t, 0, Math.max(0, dur - 0.04));
      if (!el.paused) el.pause();
      if (el.readyState >= 2 && !el.seeking && Math.abs(el.currentTime - target) < 0.004) return resolve();
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        el.removeEventListener('seeked', done);
        resolve();
      };
      el.addEventListener('seeked', done);
      el.currentTime = target;
      setTimeout(done, 2500);
    };
    if (el.readyState >= 1) go();
    else {
      el.addEventListener('loadedmetadata', go, { once: true });
      setTimeout(go, 3000);
    }
  });
}
