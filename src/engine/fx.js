/**
 * Efeitos de pós-processamento em Canvas 2D (glitch, separação RGB, zoom radial, grão,
 * vinheta, chroma key…). Todos são independentes de resolução.
 */
import { clamp, seeded, hexToRgb } from '../lib/utils';

const pool = new Map();

/** Canvas de rascunho reutilizável, identificado por chave. */
export function getCanvas(key, w, h) {
  let c = pool.get(key);
  if (!c) {
    c = document.createElement('canvas');
    pool.set(key, c);
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

/** Copia o conteúdo atual de um contexto para um canvas de rascunho. */
export function snapshot(ctx, key = 'snap') {
  const { width, height } = ctx.canvas;
  const c = getCanvas(key, width, height);
  const cx = c.getContext('2d');
  cx.clearRect(0, 0, width, height);
  cx.drawImage(ctx.canvas, 0, 0);
  return c;
}

function tinted(src, color, key) {
  const c = getCanvas(key, src.width, src.height);
  const x = c.getContext('2d');
  x.globalCompositeOperation = 'source-over';
  x.clearRect(0, 0, c.width, c.height);
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-over';
  return c;
}

/** Separação cromática: canais vermelho e ciano deslocados. */
export function rgbSplit(ctx, amountPx) {
  if (amountPx < 0.5) return;
  const { width: W, height: H } = ctx.canvas;
  const src = snapshot(ctx, 'rgb-src');
  const red = tinted(src, '#ff0000', 'rgb-r');
  const cyan = tinted(src, '#00ffff', 'rgb-c');
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(red, -amountPx, 0);
  ctx.drawImage(cyan, amountPx, 0);
  ctx.restore();
}

/** Fatias horizontais deslocadas + RGB split (glitch digital). */
export function glitch(ctx, amount, t, seedKey = 'g') {
  if (amount <= 0.01) return;
  const { width: W, height: H } = ctx.canvas;
  const frame = Math.floor(t * 18);
  const rnd = seeded(`${seedKey}:${frame}`);
  if (rnd() > 0.35 + amount * 0.6) {
    rgbSplit(ctx, W * 0.003 * amount);
    return;
  }
  const src = snapshot(ctx, 'glitch-src');
  const slices = 3 + Math.floor(rnd() * 6 * amount);
  for (let i = 0; i < slices; i++) {
    const y = rnd() * H;
    const sh = H * (0.01 + rnd() * 0.08 * amount);
    const dx = (rnd() - 0.5) * W * 0.12 * amount;
    ctx.drawImage(src, 0, y, W, sh, dx, y, W, sh);
  }
  rgbSplit(ctx, W * (0.004 + rnd() * 0.01) * amount);
  if (rnd() < 0.3 * amount) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(34,211,238,0.12)' : 'rgba(236,72,153,0.12)';
    ctx.fillRect(0, rnd() * H, W, H * 0.06);
    ctx.restore();
  }
}

/** Desfoque radial (zoom blur) a partir de um ponto. */
export function zoomBlur(ctx, amount, cx = 0.5, cy = 0.5) {
  if (amount <= 0.01) return;
  const { width: W, height: H } = ctx.canvas;
  const src = snapshot(ctx, 'zb-src');
  ctx.save();
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const s = 1 + (amount * 0.16 * i) / steps;
    ctx.globalAlpha = 0.28 * (1 - i / (steps + 1));
    ctx.setTransform(s, 0, 0, s, cx * W * (1 - s), cy * H * (1 - s));
    ctx.drawImage(src, 0, 0);
  }
  ctx.restore();
}

export function pixelate(ctx, amount) {
  if (amount <= 0.01) return;
  const { width: W, height: H } = ctx.canvas;
  const size = Math.max(2, Math.round((W / 160) * (1 + amount * 6)));
  const sw = Math.max(1, Math.round(W / size));
  const sh = Math.max(1, Math.round(H / size));
  const small = getCanvas('pix', sw, sh);
  const sx = small.getContext('2d');
  sx.clearRect(0, 0, sw, sh);
  sx.drawImage(ctx.canvas, 0, 0, sw, sh);
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, W, H);
  ctx.restore();
}

export function filmGrain(ctx, amount, t) {
  if (amount <= 0.01) return;
  const { width: W, height: H } = ctx.canvas;
  const g = getCanvas('grain', 192, 108);
  const gx = g.getContext('2d');
  const img = gx.createImageData(192, 108);
  const rnd = seeded(Math.floor(t * 24) + 1);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rnd() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  gx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.18 * amount;
  ctx.drawImage(g, 0, 0, W, H);
  ctx.restore();
}

export function vignette(ctx, amount) {
  if (amount <= 0.01) return;
  const { width: W, height: H } = ctx.canvas;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${0.75 * amount})`);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function scanlines(ctx, amount) {
  const { width: W, height: H } = ctx.canvas;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = `rgba(0,0,0,${0.22 * amount})`;
  const step = Math.max(2, H / 180);
  for (let y = 0; y < H; y += step * 2) ctx.fillRect(0, y, W, step);
  ctx.restore();
}

export function flashOverlay(ctx, alpha, color = '#ffffff') {
  if (alpha <= 0.005) return;
  const { width: W, height: H } = ctx.canvas;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function lightLeak(ctx, t, amount) {
  if (amount <= 0.01) return;
  const { width: W, height: H } = ctx.canvas;
  const x = W * (0.5 + 0.6 * Math.sin(t * 0.7));
  const g = ctx.createRadialGradient(x, H * 0.2, 0, x, H * 0.2, W * 0.7);
  g.addColorStop(0, `rgba(251,146,60,${0.55 * amount})`);
  g.addColorStop(0.4, `rgba(244,63,94,${0.25 * amount})`);
  g.addColorStop(1, 'rgba(244,63,94,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function sparkles(ctx, t, amount, seedKey = 'sp') {
  if (amount <= 0.01) return;
  const { width: W, height: H } = ctx.canvas;
  const rnd = seeded(seedKey);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const n = Math.round(26 * amount);
  for (let i = 0; i < n; i++) {
    const x = rnd() * W;
    const y = (rnd() * H - t * H * 0.03 * (0.5 + rnd())) % H;
    const yy = y < 0 ? y + H : y;
    const r = Math.min(W, H) * (0.01 + rnd() * 0.035);
    const a = 0.25 + 0.35 * Math.sin(t * (1 + rnd() * 2) + i);
    const g = ctx.createRadialGradient(x, yy, 0, x, yy, r);
    const col = i % 2 ? '253,230,138' : '244,114,182';
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, yy - r, r * 2, r * 2);
  }
  ctx.restore();
}

export function mirror(ctx) {
  const { width: W, height: H } = ctx.canvas;
  const src = snapshot(ctx, 'mirror');
  ctx.save();
  ctx.clearRect(W / 2, 0, W / 2, H);
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0, W / 2, H, 0, 0, W / 2, H);
  ctx.restore();
}

export function dreamy(ctx, amount) {
  if (amount <= 0.01) return;
  const { width: W, height: H } = ctx.canvas;
  const src = snapshot(ctx, 'dreamy');
  ctx.save();
  ctx.filter = `blur(${Math.round(Math.min(W, H) * 0.02 * amount)}px) brightness(1.2)`;
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.6 * amount;
  ctx.drawImage(src, 0, 0);
  ctx.restore();
}

export function oldFilm(ctx, t, amount) {
  if (amount <= 0.01) return;
  const { width: W, height: H } = ctx.canvas;
  const rnd = seeded(Math.floor(t * 12) + 99);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = `rgba(120,80,30,${0.18 * amount})`;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = `rgba(255,255,255,${0.35 * amount})`;
  ctx.lineWidth = Math.max(1, W / 900);
  for (let i = 0; i < 3; i++) {
    if (rnd() > 0.6) continue;
    const x = rnd() * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rnd() - 0.5) * W * 0.02, H);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(0,0,0,${0.5 * amount})`;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, (rnd() * W) / 400 + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  vignette(ctx, 0.6 * amount);
  filmGrain(ctx, amount, t);
}

/* ------------------------------------------------------------------------------------------
 * CHROMA KEY — distância no plano CbCr (como OBS / CapCut), com suavização e supressão de spill.
 * similarity/smoothness/spill em 0..100.
 * ---------------------------------------------------------------------------------------- */
export function chromaKey(imageData, keyHex, similarity = 40, smoothness = 10, spill = 50) {
  const d = imageData.data;
  const { r: kr, g: kg, b: kb } = hexToRgb(keyHex);
  const kcb = -0.168736 * kr - 0.331264 * kg + 0.5 * kb;
  const kcr = 0.5 * kr - 0.418688 * kg - 0.081312 * kb;
  const sim = (similarity / 100) * 120;
  const smooth = Math.max(1, (smoothness / 100) * 120);
  const spillK = spill / 100;
  const greenKey = kg > kr && kg > kb;
  const blueKey = kb > kr && kb > kg;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const cb = -0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 0.5 * r - 0.418688 * g - 0.081312 * b;
    const dist = Math.hypot(cb - kcb, cr - kcr);
    let a = (dist - sim) / smooth;
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    d[i + 3] = d[i + 3] * a;
    if (a > 0 && spillK > 0) {
      if (greenKey) {
        const lim = (r + b) / 2;
        if (g > lim) d[i + 1] = g - (g - lim) * spillK;
      } else if (blueKey) {
        const lim = (r + g) / 2;
        if (b > lim) d[i + 2] = b - (b - lim) * spillK;
      }
    }
  }
  return imageData;
}
