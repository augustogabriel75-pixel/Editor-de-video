/**
 * Análise visual real dos quadros do vídeo principal: brilho, saturação, cor dominante,
 * centro de interesse (saliência por contraste com a borda) e detecção de mudança de cena
 * (distância qui-quadrado entre histogramas de luminância).
 */
import { clamp } from '../lib/utils';
import { getDemoFrame } from '../engine/demoSources';
import { getImage } from '../engine/mediaPool';
import { getCanvas } from '../engine/fx';
import { sourceOffsetAt } from '../lib/speedCurves';

const AW = 64;
const AH = 36;

const analysisVideos = new Map();

function analysisVideo(asset) {
  let v = analysisVideos.get(asset.id);
  if (!v) {
    v = document.createElement('video');
    v.src = asset.src;
    v.muted = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    analysisVideos.set(asset.id, v);
  }
  return v;
}

function seekVideo(v, t) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      v.removeEventListener('seeked', finish);
      resolve(v.readyState >= 2);
    };
    const go = () => {
      v.addEventListener('seeked', finish);
      v.currentTime = Math.max(0, Math.min(t, (v.duration || t + 1) - 0.05));
      setTimeout(finish, 1500);
    };
    if (v.readyState >= 1) go();
    else {
      v.addEventListener('loadedmetadata', go, { once: true });
      setTimeout(finish, 2500);
    }
  });
}

async function frameImage(asset, clip, srcTime) {
  if (asset.demoId) return getDemoFrame(asset.demoId, srcTime, { variant: asset.variant, height: 72, slotKey: 'analysis' });
  if (asset.type === 'image') return getImage(asset);
  if (asset.type === 'video') {
    const v = analysisVideo(asset);
    const ok = await seekVideo(v, srcTime);
    return ok ? v : null;
  }
  return null;
}

function stats(ctx) {
  const { data } = ctx.getImageData(0, 0, AW, AH);
  const hist = new Float32Array(16);
  let luma = 0;
  let sat = 0;
  let hx = 0;
  let hy = 0;
  let hw = 0;
  let border = [0, 0, 0];
  let bn = 0;
  for (let y = 0; y < AH; y++) {
    for (let x = 0; x < AW; x++) {
      if (x === 0 || y === 0 || x === AW - 1 || y === AH - 1) {
        const i = (y * AW + x) * 4;
        border[0] += data[i];
        border[1] += data[i + 1];
        border[2] += data[i + 2];
        bn++;
      }
    }
  }
  border = border.map((v) => v / bn);
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma += l;
    hist[Math.min(15, (l / 16) | 0)]++;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const s = mx ? (mx - mn) / mx : 0;
    sat += s;
    if (s > 0.2 && mx > 40) {
      let h;
      if (mx === r) h = ((g - b) / (mx - mn)) % 6;
      else if (mx === g) h = (b - r) / (mx - mn) + 2;
      else h = (r - g) / (mx - mn) + 4;
      const a = (h * Math.PI) / 3;
      hx += Math.cos(a) * s;
      hy += Math.sin(a) * s;
      hw += s;
    }
    const d = Math.abs(r - border[0]) + Math.abs(g - border[1]) + Math.abs(b - border[2]);
    if (d > 90) {
      const x = p % AW;
      const y = (p / AW) | 0;
      sx += x * d;
      sy += y * d;
      sw += d;
    }
  }
  const n = AW * AH;
  for (let i = 0; i < 16; i++) hist[i] /= n;
  const hue = hw ? ((Math.atan2(hy, hx) * 180) / Math.PI + 360) % 360 : null;
  return {
    luma: luma / n / 255,
    sat: sat / n,
    hue,
    hist,
    cx: sw ? sx / sw / AW : 0.5,
    cy: sw ? sy / sw / AH : 0.5,
  };
}

function chi2(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    const s = a[i] + b[i];
    if (s > 0) d += ((a[i] - b[i]) * (a[i] - b[i])) / s;
  }
  return d;
}

export function hueName(h) {
  if (h === null || h === undefined) return 'Neutro';
  if (h < 20 || h >= 340) return 'Vermelho';
  if (h < 45) return 'Laranja';
  if (h < 70) return 'Amarelo';
  if (h < 165) return 'Verde';
  if (h < 200) return 'Ciano';
  if (h < 255) return 'Azul';
  if (h < 290) return 'Roxo';
  return 'Magenta';
}

export async function analyzeFrames(state, { fps = 2, onProgress } = {}) {
  const main = state.tracks.find((t) => t.kind === 'video');
  const clips = state.clips.filter((c) => c.trackId === main?.id && !c.disabled).sort((a, b) => a.start - b.start);
  const assets = new Map(state.assets.map((a) => [a.id, a]));
  const canvas = getCanvas('frame-analysis', AW, AH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const samples = [];
  const total = Math.max(1, Math.ceil(state.duration * fps));
  for (let i = 0; i < total; i++) {
    const t = i / fps;
    const clip = clips.find((c) => t >= c.start && t < c.start + c.duration);
    onProgress?.(i / total);
    if (!clip) continue;
    const asset = assets.get(clip.assetId);
    if (!asset) continue;
    const img = await frameImage(asset, clip, clip.trimIn + sourceOffsetAt(clip, t - clip.start));
    if (!img) continue;
    ctx.clearRect(0, 0, AW, AH);
    try {
      ctx.drawImage(img, 0, 0, AW, AH);
      samples.push({ t, clipId: clip.id, ...stats(ctx) });
    } catch {
      /* quadro indisponível */
    }
    if (i % 8 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  const scenes = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const d = chi2(a.hist, b.hist);
    if (a.clipId !== b.clipId) scenes.push({ t: clips.find((c) => c.id === b.clipId).start, strength: clamp(0.6 + d, 0, 1), reason: 'Corte entre clipes' });
    else if (d > 0.45) scenes.push({ t: b.t, strength: clamp(d, 0, 1), reason: 'Mudança de cena detectada' });
  }
  const avg = (k) => (samples.length ? samples.reduce((s, x) => s + x[k], 0) / samples.length : 0);
  const hues = samples.filter((s) => s.hue !== null);
  let hx = 0;
  let hy = 0;
  hues.forEach((s) => {
    hx += Math.cos((s.hue * Math.PI) / 180);
    hy += Math.sin((s.hue * Math.PI) / 180);
  });
  const domHue = hues.length ? ((Math.atan2(hy, hx) * 180) / Math.PI + 360) % 360 : null;
  return {
    samples,
    scenes,
    summary: {
      brightness: avg('luma'),
      saturation: avg('sat'),
      dominantHue: domHue,
      dominantColor: hueName(domHue),
      focusX: avg('cx') || 0.5,
      focusY: avg('cy') || 0.45,
    },
  };
}
