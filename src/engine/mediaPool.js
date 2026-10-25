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

// requestVideoFrameCallback: null = ainda não sabemos se dispara neste navegador, true = funciona, false = desligado
let rvfcOk = null;
let rvfcMisses = 0;
export const exportSeekStats = { seeks: 0, rvfc: 0, timeouts: 0 };

/**
 * Posiciona o vídeo exatamente no quadro do instante `t` e espera esse quadro ficar pronto
 * (exportação quadro a quadro).
 *
 * - Mira um pouco depois do início do quadro: os timestamps da fonte são arredondados
 *   (WebM usa 1 ms, MP4 varia) e mirar exatamente em i/fps às vezes cai no quadro anterior,
 *   o que gerava quadros repetidos/pulados (vídeo "com lag").
 * - Depois do 'seeked' espera o quadro decodificado com requestVideoFrameCallback: no
 *   Android/WebView o 'seeked' chega antes do quadro novo estar disponível para desenhar.
 */
export function seekVideoExact(asset, t, { frameDur = 1 / 30 } = {}) {
  const el = getVideo(asset);
  return new Promise((resolve) => {
    const go = () => {
      const dur = Number.isFinite(el.duration) ? el.duration : asset.duration || 0;
      const target = clamp(t + Math.min(0.006, frameDur * 0.25), 0, Math.max(0, dur - 0.04));
      if (!el.paused) el.pause();
      if (el.readyState >= 2 && !el.seeking && Math.abs(el.currentTime - target) < 0.001) return resolve();
      exportSeekStats.seeks++;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        el.removeEventListener('seeked', onSeeked);
        resolve();
      };
      const onSeeked = () => {
        el.removeEventListener('seeked', onSeeked);
        if (rvfcOk === false || typeof el.requestVideoFrameCallback !== 'function') return finish();
        let got = false;
        el.requestVideoFrameCallback(() => {
          got = true;
          rvfcOk = true;
          rvfcMisses = 0;
          exportSeekStats.rvfc++;
          finish();
        });
        setTimeout(
          () => {
            if (got || finished) return;
            exportSeekStats.timeouts++;
            if (rvfcOk !== true && ++rvfcMisses >= 3) rvfcOk = false;
            finish();
          },
          rvfcOk ? 150 : 160,
        );
      };
      el.addEventListener('seeked', onSeeked);
      el.currentTime = target;
      setTimeout(finish, 4000);
    };
    if (el.readyState >= 1) go();
    else {
      el.addEventListener('loadedmetadata', go, { once: true });
      setTimeout(go, 3000);
    }
  });
}
