/**
 * Compositor principal do MotionCut (Canvas 2D).
 *
 * Pipeline por quadro:
 *   1. Trilhas de vídeo (principal + PIP) -> canvas "base", com transições, filtros,
 *      remoção de fundo, keyframes, animações e efeitos por clipe.
 *   2. Câmera virtual da IA (zooms/pans/tremores) aplicada sobre a base.
 *   3. Motions da IA (stickers e tipografia) e trilhas de texto/legendas.
 *   4. Pós-efeitos de transição da IA (flash, glitch no beat…).
 *
 * É uma função pura do estado + tempo, usada tanto no preview quanto na exportação.
 */
import { clamp, Easing, hashString, isActiveAt } from '../lib/utils';
import { buildFilterString, getFilter, DEFAULT_TEXT_STYLE } from '../lib/catalog';
import { sourceOffsetAt, instantSpeedAt } from '../lib/speedCurves';
import { getTransformAt } from '../lib/keyframes';
import { getDemoFrame } from './demoSources';
import { videoFrame, getImage, beginFrame, endFrame } from './mediaPool';
import * as fx from './fx';
import { drawTextBlock, tokenize } from './textRenderer';
import { getTemplate, cameraTransform, applyPostFx } from './motionTemplates';
import { mergeStyles } from './motionStyles';

/** Últimos limites desenhados por clipe (em px do canvas) — usados pela caixa de seleção do preview. */
export const lastBounds = new Map();

const assetMapCache = new WeakMap();
function assetMap(assets) {
  let m = assetMapCache.get(assets);
  if (!m) {
    m = new Map(assets.map((a) => [a.id, a]));
    assetMapCache.set(assets, m);
  }
  return m;
}

const BLEND = { normal: 'source-over', screen: 'screen', multiply: 'multiply', overlay: 'overlay', lighten: 'lighten', darken: 'darken', add: 'lighter' };

/* ------------------------------------------------------------------------------------------ */
/* Animações de clipe                                                                          */
/* ------------------------------------------------------------------------------------------ */

export function animationModifiers(clip, lt) {
  const m = { dx: 0, dy: 0, scale: 1, rot: 0, alpha: 1, blur: 0, reveal: 1, wave: 1 };
  const a = clip.animation || {};
  const dur = clip.duration;
  if (a.in) {
    const d = Math.min(a.in.duration || 0.5, dur);
    if (lt < d) {
      const p = clamp(lt / d, 0, 1);
      const e = Easing.outCubic(p);
      switch (a.in.id) {
        case 'fade-in': m.alpha *= p; break;
        case 'pop': m.scale *= Easing.outBack(p); m.alpha *= clamp(p * 3, 0, 1); break;
        case 'zoom-in': m.scale *= 0.5 + 0.5 * e; m.alpha *= p; break;
        case 'zoom-out': m.scale *= 1.6 - 0.6 * e; m.alpha *= p; break;
        case 'slide-up': m.dy += 0.25 * (1 - e); m.alpha *= p; break;
        case 'slide-down': m.dy -= 0.25 * (1 - e); m.alpha *= p; break;
        case 'slide-left': m.dx += 0.45 * (1 - e); break;
        case 'slide-right': m.dx -= 0.45 * (1 - e); break;
        case 'spin-in': m.rot -= 180 * (1 - e); m.scale *= e; break;
        case 'blur-in': m.blur += 24 * (1 - p); m.alpha *= p; break;
        case 'bounce': m.scale *= Easing.outElastic(p); break;
        case 'drop': m.dy -= 0.6 * (1 - Easing.outBounce(p)); break;
        case 'typewriter': m.reveal = p; break;
        case 'wave': m.wave = p; break;
        default: break;
      }
    }
  }
  if (a.out) {
    const d = Math.min(a.out.duration || 0.5, dur);
    const start = dur - d;
    if (lt > start) {
      const p = clamp((lt - start) / d, 0, 1);
      const e = Easing.inCubic(p);
      switch (a.out.id) {
        case 'fade-out': m.alpha *= 1 - p; break;
        case 'pop-out': m.scale *= 1 - Easing.inCubic(p) * 0.9; m.alpha *= 1 - e; break;
        case 'zoom-out-out': m.scale *= 1 + 0.5 * e; m.alpha *= 1 - p; break;
        case 'slide-up-out': m.dy -= 0.3 * e; m.alpha *= 1 - p; break;
        case 'slide-down-out': m.dy += 0.3 * e; m.alpha *= 1 - p; break;
        case 'spin-out': m.rot += 180 * e; m.scale *= 1 - p * 0.9; break;
        case 'blur-out': m.blur += 24 * p; m.alpha *= 1 - p; break;
        default: break;
      }
    }
  }
  if (a.loop) {
    switch (a.loop.id) {
      case 'float': m.dy += Math.sin(lt * 2.2) * 0.012; break;
      case 'pulse': m.scale *= 1 + 0.05 * Math.sin(lt * 5); break;
      case 'wiggle': m.rot += Math.sin(lt * 6) * 4; break;
      case 'heartbeat': m.scale *= 1 + 0.09 * Math.pow(Math.max(0, Math.sin(lt * 7)), 6); break;
      case 'shake': m.dx += Math.sin(lt * 41) * 0.004; m.dy += Math.cos(lt * 37) * 0.004; break;
      default: break;
    }
  }
  return m;
}

function effectTransform(clip, lt) {
  const out = { dx: 0, dy: 0, scale: 1, blur: 0 };
  for (const eff of clip.effects || []) {
    const k = (eff.intensity ?? 70) / 100;
    if (eff.id === 'zoom-pulse') out.scale *= 1 + 0.07 * k * Math.pow(Math.max(0, Math.sin(lt * Math.PI * 2 * 1.2)), 3);
    else if (eff.id === 'shake') {
      const f = Math.floor(lt * 24);
      out.dx += Math.sin(f * 12.9898) * 0.008 * k;
      out.dy += Math.cos(f * 78.233) * 0.008 * k;
      out.scale *= 1 + 0.03 * k;
    } else if (eff.id === 'blur') out.blur += 14 * k;
  }
  return out;
}

function applyClipEffects(lctx, clip, lt) {
  const { width: W } = lctx.canvas;
  for (const eff of clip.effects || []) {
    const k = (eff.intensity ?? 70) / 100;
    switch (eff.id) {
      case 'glitch': fx.glitch(lctx, k, lt, clip.id); break;
      case 'rgb-split': fx.rgbSplit(lctx, W * 0.006 * k * (1 + 0.6 * Math.sin(lt * 6))); break;
      case 'vhs':
        fx.rgbSplit(lctx, W * 0.003 * k);
        fx.scanlines(lctx, k);
        fx.filmGrain(lctx, k * 0.8, lt);
        break;
      case 'pixelate': fx.pixelate(lctx, k); break;
      case 'zoom-blur': fx.zoomBlur(lctx, k * (0.6 + 0.4 * Math.sin(lt * 3))); break;
      case 'flash': fx.flashOverlay(lctx, k * Math.max(0, 1 - (lt % 1.2) / 0.3) * 0.8); break;
      case 'strobe': if (Math.floor(lt * 8) % 2) fx.flashOverlay(lctx, 0.55 * k); break;
      case 'dreamy': fx.dreamy(lctx, k); break;
      case 'film-grain': fx.filmGrain(lctx, k * 1.4, lt); break;
      case 'old-film': fx.oldFilm(lctx, lt, k); break;
      case 'vignette': fx.vignette(lctx, k); break;
      case 'light-leak': fx.lightLeak(lctx, lt, k); break;
      case 'sparkle': fx.sparkles(lctx, lt, k, clip.id); break;
      case 'mirror': fx.mirror(lctx); break;
      default: break;
    }
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Fontes                                                                                      */
/* ------------------------------------------------------------------------------------------ */

function getSource(asset, clip, srcTime, opts, slot) {
  if (!asset) return null;
  if (asset.demoId) {
    const variant = clip.bg?.mode === 'smart' && asset.demoId === 'presenter' ? 'cutout' : asset.variant;
    const t = clamp(srcTime, 0, asset.duration);
    const c = getDemoFrame(asset.demoId, t, { variant, height: opts.export ? 1080 : 540, slotKey: `${slot}-${clip.id}` });
    return { img: c, w: c.width, h: c.height, nativeCutout: variant === 'cutout' };
  }
  if (asset.type === 'video') {
    const lt = srcTime - clip.trimIn;
    const el = videoFrame(asset, srcTime, { playing: opts.playing, rate: instantSpeedAt(clip, lt) });
    if (!el || !el.videoWidth) return null;
    return { img: el, w: el.videoWidth, h: el.videoHeight };
  }
  if (asset.type === 'image') {
    const img = getImage(asset);
    if (!img) return null;
    return { img, w: img.naturalWidth, h: img.naturalHeight };
  }
  return null;
}

function processBackground(src, clip, opts, slot) {
  const bg = clip.bg || {};
  if (bg.mode === 'chroma') {
    const maxW = opts.export ? 1280 : 560;
    const s = Math.min(1, maxW / src.w);
    const pw = Math.max(1, Math.round(src.w * s));
    const ph = Math.max(1, Math.round(src.h * s));
    const pc = fx.getCanvas(`chroma-${slot}-${clip.id}`, pw, ph);
    const pctx = pc.getContext('2d', { willReadFrequently: true });
    pctx.clearRect(0, 0, pw, ph);
    pctx.drawImage(src.img, 0, 0, pw, ph);
    try {
      const data = pctx.getImageData(0, 0, pw, ph);
      fx.chromaKey(data, bg.color || '#00ff00', bg.similarity ?? 40, bg.smoothness ?? 10, bg.spill ?? 50);
      pctx.putImageData(data, 0, 0);
    } catch {
      /* canvas contaminado (CORS) — mantém a imagem original */
    }
    return { img: pc, w: src.w, h: src.h };
  }
  if (bg.mode === 'smart' && !src.nativeCutout) {
    // Recorte inteligente simulado: máscara de segmentação suave centrada no assunto.
    // (Substituível por MediaPipe Selfie Segmentation / modelo de matting real.)
    const maxW = opts.export ? 1280 : 640;
    const s = Math.min(1, maxW / src.w);
    const pw = Math.max(1, Math.round(src.w * s));
    const ph = Math.max(1, Math.round(src.h * s));
    const mc = fx.getCanvas(`smart-${slot}-${clip.id}`, pw, ph);
    const mctx = mc.getContext('2d');
    mctx.globalCompositeOperation = 'source-over';
    mctx.clearRect(0, 0, pw, ph);
    mctx.drawImage(src.img, 0, 0, pw, ph);
    mctx.globalCompositeOperation = 'destination-in';
    const g = mctx.createRadialGradient(pw / 2, ph * 0.55, Math.min(pw, ph) * 0.22, pw / 2, ph * 0.55, Math.min(pw, ph) * 0.55);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = g;
    mctx.fillRect(0, 0, pw, ph);
    mctx.globalCompositeOperation = 'source-over';
    return { img: mc, w: src.w, h: src.h };
  }
  return src;
}

/* ------------------------------------------------------------------------------------------ */
/* Clipes visuais                                                                              */
/* ------------------------------------------------------------------------------------------ */

function compositeLayer(target, layer, W, H, transition, blend) {
  target.save();
  target.globalCompositeOperation = BLEND[blend] || 'source-over';
  if (!transition) {
    target.drawImage(layer, 0, 0);
    target.restore();
    return;
  }
  const { id, p } = transition;
  const e = Easing.inOutCubic(p);
  switch (id) {
    case 'fade':
      target.globalAlpha = e;
      target.drawImage(layer, 0, 0);
      break;
    case 'black':
      if (p < 0.5) fx.flashOverlay(target, p * 2, '#000');
      else {
        target.fillStyle = '#000';
        target.fillRect(0, 0, W, H);
        target.globalAlpha = (p - 0.5) * 2;
        target.drawImage(layer, 0, 0);
      }
      break;
    case 'white-flash':
      if (p < 0.5) fx.flashOverlay(target, p * 2);
      else {
        target.drawImage(layer, 0, 0);
        fx.flashOverlay(target, (1 - p) * 2);
      }
      break;
    case 'slide-left':
      target.drawImage(layer, (1 - e) * W, 0);
      break;
    case 'slide-up':
      target.drawImage(layer, 0, (1 - e) * H);
      break;
    case 'whip': {
      const off = (1 - Easing.outCubic(p)) * W;
      target.filter = `blur(${Math.round((1 - p) * W * 0.012)}px)`;
      target.drawImage(layer, off, 0);
      break;
    }
    case 'zoom-in': {
      const s = 1.7 - 0.7 * e;
      target.globalAlpha = e;
      target.setTransform(s, 0, 0, s, (W * (1 - s)) / 2, (H * (1 - s)) / 2);
      target.drawImage(layer, 0, 0);
      break;
    }
    case 'zoom-out': {
      const s = 0.45 + 0.55 * e;
      target.globalAlpha = e;
      target.setTransform(s, 0, 0, s, (W * (1 - s)) / 2, (H * (1 - s)) / 2);
      target.drawImage(layer, 0, 0);
      break;
    }
    case 'spin': {
      target.translate(W / 2, H / 2);
      target.rotate((1 - e) * Math.PI);
      target.scale(Math.max(0.01, e), Math.max(0.01, e));
      target.drawImage(layer, -W / 2, -H / 2);
      break;
    }
    case 'wipe':
      target.beginPath();
      target.rect(0, 0, e * W, H);
      target.clip();
      target.drawImage(layer, 0, 0);
      break;
    case 'circle':
      target.beginPath();
      target.arc(W / 2, H / 2, e * Math.hypot(W, H) * 0.55, 0, Math.PI * 2);
      target.clip();
      target.drawImage(layer, 0, 0);
      break;
    case 'glitch': {
      const lctx = layer.getContext('2d');
      fx.glitch(lctx, 1 - p, p * 10, 'trans');
      target.globalAlpha = clamp(p / 0.3, 0, 1);
      target.drawImage(layer, 0, 0);
      break;
    }
    case 'blur':
      target.filter = `blur(${Math.round((1 - p) * 24)}px)`;
      target.globalAlpha = e;
      target.drawImage(layer, 0, 0);
      break;
    default:
      target.drawImage(layer, 0, 0);
  }
  target.restore();
}

function drawVisualClip(target, clip, time, W, H, state, opts, slot, track, transition = null) {
  const asset = assetMap(state.assets).get(clip.assetId);
  const lt = clamp(time - clip.start, 0, clip.duration);
  const srcTime = clip.trimIn + sourceOffsetAt(clip, lt);
  const raw = getSource(asset, clip, srcTime, opts, slot);
  if (!raw) return;
  const src = processBackground(raw, clip, opts, slot);
  const layer = fx.getCanvas(`layer-${opts.export ? 'x' : 'p'}-${slot}`, W, H);
  const lctx = layer.getContext('2d');
  lctx.save();
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.globalAlpha = 1;
  lctx.filter = 'none';
  lctx.clearRect(0, 0, W, H);

  const isMain = track.kind === 'video';
  const fit = Math.min(W / src.w, H / src.h);
  const dw = src.w * fit;
  const dh = src.h * fit;

  if (isMain && state.project.background?.mode === 'blur' && clip.bg?.mode === 'none' && (dw < W - 1 || dh < H - 1)) {
    const cover = Math.max(W / src.w, H / src.h) * 1.1;
    lctx.filter = `blur(${Math.round(Math.min(W, H) * 0.035)}px) brightness(0.75)`;
    lctx.drawImage(src.img, (W - src.w * cover) / 2, (H - src.h * cover) / 2, src.w * cover, src.h * cover);
    lctx.filter = 'none';
  }

  const tr = getTransformAt(clip, lt);
  const an = animationModifiers(clip, lt);
  const ef = effectTransform(clip, lt);
  const sc = tr.scale * an.scale * ef.scale;
  const cx = W / 2 + (tr.x + an.dx + ef.dx) * W;
  const cy = H / 2 + (tr.y + an.dy + ef.dy) * H;
  const rot = ((tr.rotation || 0) + an.rot) * (Math.PI / 180);

  let filter = buildFilterString(clip.filter?.id || 'none', clip.filter?.intensity ?? 100, clip.adjust || {});
  const blur = an.blur + ef.blur;
  if (blur > 0.3) filter = `${filter === 'none' ? '' : filter + ' '}blur(${((blur * Math.min(W, H)) / 1080).toFixed(1)}px)`;
  lctx.filter = filter;
  lctx.globalAlpha = clamp((tr.opacity ?? 1) * an.alpha, 0, 1);
  lctx.translate(cx, cy);
  lctx.rotate(rot);
  lctx.scale(sc, sc);
  lctx.drawImage(src.img, -dw / 2, -dh / 2, dw, dh);
  lctx.restore();

  const f = getFilter(clip.filter?.id);
  if (f.tint) {
    lctx.save();
    lctx.globalCompositeOperation = 'source-atop';
    lctx.globalAlpha = f.tint.alpha * ((clip.filter?.intensity ?? 100) / 100);
    lctx.fillStyle = f.tint.color;
    lctx.fillRect(0, 0, W, H);
    lctx.restore();
  }
  applyClipEffects(lctx, clip, lt);

  if (slot !== 'prev') lastBounds.set(clip.id, { cx, cy, w: dw * sc, h: dh * sc, rot, W, H });
  compositeLayer(target, layer, W, H, transition, clip.blend);
}

/* ------------------------------------------------------------------------------------------ */
/* Texto & legendas                                                                            */
/* ------------------------------------------------------------------------------------------ */

function drawTextClip(ctx, clip, time, W, H) {
  const lt = time - clip.start;
  const style = { ...DEFAULT_TEXT_STYLE, ...(clip.text?.style || {}) };
  const tr = getTransformAt(clip, lt);
  const an = animationModifiers(clip, lt);
  const unit = Math.min(W, H) / 1080;
  const px = style.size * unit;
  const cx = W / 2 + (tr.x + an.dx) * W;
  const cy = H / 2 + (tr.y + an.dy) * H;
  const sc = tr.scale * an.scale;
  const rot = ((tr.rotation || 0) + an.rot) * (Math.PI / 180);

  let tokens;
  let perToken = null;
  const isCaption = clip.kind === 'caption' && clip.text?.words?.length;
  if (isCaption) {
    const words = clip.text.words;
    const mode = clip.text.highlight || 'pop';
    tokens = words.map((w) => ({ text: w.w, layoutScale: mode === 'pop' ? 1.12 : mode === 'box' ? 1.08 : 1 }));
    const hl = style.highlightColor || '#facc15';
    let active = words.findIndex((w) => lt >= w.start && lt < w.end);
    if (active < 0) {
      for (let i = words.length - 1; i >= 0; i--) if (lt >= words[i].start) { active = i; break; }
    }
    perToken = (i) => {
      const w = words[i];
      const spoken = lt >= w.start;
      const isActive = i === active;
      if (mode === 'pop') return isActive ? { color: hl, scale: 1 + 0.16 * Easing.outBack(clamp((lt - w.start) / 0.14, 0, 1)) } : null;
      if (mode === 'fill') return spoken ? { color: hl } : { alpha: 0.85 };
      if (mode === 'box') return isActive ? { box: true, boxColor: hl } : null;
      return isActive ? { color: hl } : null;
    };
  } else {
    tokens = tokenize(clip.text?.content || '');
  }

  const n = tokens.filter((t) => !t.br).length || 1;
  if (an.wave < 1) {
    let wi = -1;
    const order = tokens.map((t) => (t.br ? -1 : ++wi));
    const prev = perToken;
    perToken = (i, tk) => {
      const q = clamp(an.wave * (n + 2) - order[i], 0, 1);
      const base = prev ? prev(i, tk) || {} : {};
      return { ...base, alpha: (base.alpha ?? 1) * q, dy: (1 - Easing.outBack(q)) * px * 0.8 };
    };
  }
  const totalChars = tokens.reduce((a, t) => a + (t.br ? 0 : t.text.length + 1), 0);

  ctx.save();
  ctx.globalAlpha = clamp((tr.opacity ?? 1) * an.alpha, 0, 1);
  if (an.blur > 0.3) ctx.filter = `blur(${(an.blur * unit).toFixed(1)}px)`;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  const box = drawTextBlock(ctx, {
    tokens,
    style,
    px,
    cx: 0,
    cy: 0,
    maxWidth: W * 0.86,
    perToken,
    reveal: an.reveal < 1 ? an.reveal * totalChars : Infinity,
  });
  ctx.restore();
  if (box) lastBounds.set(clip.id, { cx, cy, w: box.w * sc + px * 0.4, h: box.h * sc + px * 0.2, rot, W, H });
}

/* ------------------------------------------------------------------------------------------ */
/* Motions de IA                                                                               */
/* ------------------------------------------------------------------------------------------ */

const styleCache = new Map();
function resolveStyle(motion) {
  const key = `${(motion.styleIds || []).join(',')}|${motion.color || ''}`;
  let s = styleCache.get(key);
  if (!s) {
    s = mergeStyles(motion.styleIds, motion.color ? { primary: motion.color } : {});
    styleCache.set(key, s);
  }
  return s;
}

function motionCtx(clip, time, W, H) {
  const lt = time - clip.start;
  const tr = getTransformAt(clip, lt);
  return {
    W,
    H,
    t: lt,
    dur: clip.duration,
    p: lt / clip.duration,
    x: W * (0.5 + tr.x),
    y: H * (0.5 + tr.y),
    S: Math.min(W, H) * 0.2 * tr.scale,
    scale: tr.scale,
    opacity: tr.opacity ?? 1,
    style: resolveStyle(clip.motion),
    intensity: (clip.motion.intensity ?? 70) / 70,
    text: clip.motion.text,
    highlights: clip.motion.highlights,
    label: clip.motion.label,
    seed: hashString(clip.id),
  };
}

function drawMotionClip(ctx, clip, time, W, H) {
  const tpl = getTemplate(clip.motion.templateId);
  if (!tpl.draw) return;
  const m = motionCtx(clip, time, W, H);
  ctx.save();
  ctx.globalAlpha = clamp(m.opacity, 0, 1);
  tpl.draw(ctx, m);
  ctx.restore();
  const size = tpl.category === 'typography' ? { w: W * 0.8, h: m.S * 1.2 } : { w: m.S * 2.6, h: m.S * 2.4 };
  lastBounds.set(clip.id, { cx: m.x, cy: m.y, w: size.w, h: size.h, rot: 0, W, H });
}

/* ------------------------------------------------------------------------------------------ */
/* Quadro completo                                                                             */
/* ------------------------------------------------------------------------------------------ */

export function renderFrame(ctx, W, H, state, time, opts = {}) {
  const { tracks, clips, project } = state;
  const order = [...tracks].reverse();
  const byTrack = new Map();
  for (const c of clips) {
    if (c.disabled) continue;
    if (!byTrack.has(c.trackId)) byTrack.set(c.trackId, []);
    byTrack.get(c.trackId).push(c);
  }
  beginFrame();

  const base = fx.getCanvas(`base-${opts.export ? 'x' : 'p'}`, W, H);
  const bctx = base.getContext('2d');
  bctx.save();
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.globalCompositeOperation = 'source-over';
  bctx.globalAlpha = 1;
  bctx.filter = 'none';
  bctx.fillStyle = project.background?.color || '#000000';
  bctx.fillRect(0, 0, W, H);
  bctx.restore();

  let slotN = 0;
  for (const track of order) {
    if (track.hidden || (track.kind !== 'video' && track.kind !== 'overlay')) continue;
    const list = byTrack.get(track.id) || [];
    for (const clip of list) {
      if (!isActiveAt(clip, time)) continue;
      const lt = time - clip.start;
      const tin = clip.transitionIn;
      let transition = null;
      if (tin && lt < tin.duration) {
        const prev = list.find((c) => c !== clip && Math.abs(c.start + c.duration - clip.start) < 0.05);
        if (prev) drawVisualClip(bctx, prev, prev.start + prev.duration - 0.001, W, H, state, opts, 'prev', track);
        transition = { id: tin.id, p: clamp(lt / tin.duration, 0, 1) };
      }
      drawVisualClip(bctx, clip, time, W, H, state, opts, `s${slotN++}`, track, transition);
    }
  }

  // Câmera virtual (IA)
  const motionTracks = order.filter((t) => t.kind === 'motion' && !t.hidden);
  const activeMotions = motionTracks.flatMap((t) => (byTrack.get(t.id) || []).filter((c) => isActiveAt(c, time) && c.motion));
  let cam = { scale: 1, dx: 0, dy: 0, rot: 0 };
  let focusX = 0.5;
  let focusY = 0.45;
  for (const c of activeMotions) {
    if (getTemplate(c.motion.templateId).category !== 'camera') continue;
    const tr = cameraTransform(c.motion.templateId, time - c.start, c.duration, (c.motion.intensity ?? 70) / 70, hashString(c.id));
    cam = { scale: cam.scale * tr.scale, dx: cam.dx + tr.dx, dy: cam.dy + tr.dy, rot: cam.rot + tr.rot };
    focusX = c.motion.params?.focusX ?? focusX;
    focusY = c.motion.params?.focusY ?? focusY;
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (cam.scale !== 1 || cam.dx || cam.dy || cam.rot) {
    ctx.save();
    ctx.translate(focusX * W + cam.dx * W, focusY * H + cam.dy * H);
    ctx.rotate(cam.rot);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-focusX * W, -focusY * H);
    ctx.drawImage(base, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(base, 0, 0);
  }

  // Stickers e tipografia da IA
  for (const c of activeMotions) {
    const cat = getTemplate(c.motion.templateId).category;
    if (cat === 'sticker' || cat === 'typography') drawMotionClip(ctx, c, time, W, H);
  }

  // Textos e legendas
  for (const track of order) {
    if (track.hidden || track.kind !== 'text') continue;
    for (const clip of byTrack.get(track.id) || []) if (isActiveAt(clip, time)) drawTextClip(ctx, clip, time, W, H);
  }

  // Pós-efeitos/transições da IA
  for (const c of activeMotions) {
    if (getTemplate(c.motion.templateId).category !== 'transition') continue;
    const m = motionCtx(c, time, W, H);
    applyPostFx(ctx, c.motion.templateId, m);
  }

  ctx.restore();
  endFrame();
}
