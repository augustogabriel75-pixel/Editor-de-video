/**
 * LUTs 3D (tabelas de cor) do MotionCut.
 *
 * Os LUTs embutidos são gerados aqui mesmo a partir de "receitas" de color grading
 * (curva de contraste, lift/gamma/gain, split toning, ajuste de matizes com proteção de pele…)
 * e amostrados numa grade 33×33×33, o mesmo formato de um arquivo .cube.
 * Também é possível importar LUTs .cube (Resolve, Premiere, CapCut, câmeras…).
 *
 * Os dados ficam em Float32Array RGB, com R variando mais rápido (ordem do .cube).
 */
export const LUT_SIZE = 33;

/* ------------------------------------------------------------------ utilidades de cor */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Curva S de contraste em torno do pivô (k > 1 aumenta, k < 1 diminui). */
function sCurve(x, k, p = 0.45) {
  x = clamp01(x);
  return x < p ? p * Math.pow(x / p, k) : 1 - (1 - p) * Math.pow((1 - x) / (1 - p), k);
}

function contrast(c, k, p) {
  return [sCurve(c[0], k, p), sCurve(c[1], k, p), sCurve(c[2], k, p)];
}

function saturation(c, s) {
  const l = luma(c);
  return [mix(l, c[0], s), mix(l, c[1], s), mix(l, c[2], s)];
}

/** Lift/gamma/gain por canal (valores por canal: [r,g,b]). */
function lgg(c, lift = [0, 0, 0], gamma = [1, 1, 1], gain = [1, 1, 1]) {
  return c.map((v, i) => {
    const x = clamp01(v * gain[i] + lift[i] * (1 - v));
    return Math.pow(x, 1 / gamma[i]);
  });
}

/** Split toning: soma uma cor nas sombras e outra nas altas luzes. */
function splitTone(c, shadow, highlight, amount = 1, balance = 0.5) {
  const l = luma(c);
  const ws = (1 - smooth(0, balance + 0.25, l)) * amount;
  const wh = smooth(balance - 0.25, 1, l) * amount;
  return c.map((v, i) => v + (shadow[i] - 0.5) * ws + (highlight[i] - 0.5) * wh);
}

/** Matiz/saturação/luminosidade em HSV. */
function rgb2hsv([r, g, b]) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx > 1e-6 ? d / mx : 0, mx];
}
function hsv2rgb([h, s, v]) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
const hueDist = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Ajusta uma faixa de matizes: desloca o matiz e multiplica saturação/valor. */
function hueRange(c, center, width, { shift = 0, sat = 1, val = 1 } = {}) {
  const hsv = rgb2hsv(c);
  const w = 1 - smooth(width * 0.5, width, hueDist(hsv[0], center));
  if (w <= 0 || hsv[1] < 0.02) return c;
  const h = (hsv[0] + shift * w + 360) % 360;
  const s = clamp01(hsv[1] * mix(1, sat, w));
  const v = clamp01(hsv[2] * mix(1, val, w));
  return hsv2rgb([h, s, v]);
}

/** Peso de "tom de pele" (matiz laranja, saturação moderada), para proteger rostos. */
function skinWeight(c) {
  const [h, s, v] = rgb2hsv(c);
  if (v < 0.12 || s < 0.08 || s > 0.75) return 0;
  return (1 - smooth(12, 30, hueDist(h, 24))) * smooth(0.08, 0.2, s);
}

/** Leva o preto para cima e o branco para baixo (look "matte"/filme lavado). */
const fade = (c, black = 0.06, white = 0.97) => c.map((v) => black + v * (white - black));

/** Compressão suave das altas luzes (roll-off de película). */
const rolloff = (c, knee = 0.78) => c.map((v) => (v <= knee ? v : knee + (1 - knee) * (1 - Math.exp(-(v - knee) / (1 - knee)))));

const temperature = (c, warm) => [c[0] * (1 + warm * 0.12), c[1] * (1 + warm * 0.02), c[2] * (1 - warm * 0.14)];

/* ------------------------------------------------------------------ Apple Log → Rec.709 */

// Apple Log (white paper "Apple Log Profile", 2023): curva de codificação e primárias Rec.2020.
const AL = { R0: -0.05641088, Rt: 0.01, c: 47.28711236, b: 0.00964052, g: 0.08550479, d: 0.69336945 };
const AL_Pt = AL.c * (AL.Rt - AL.R0) ** 2;
const appleLogToLinear = (p) => (p >= AL_Pt ? 2 ** ((p - AL.d) / AL.g) - AL.b : p >= 0 ? Math.sqrt(p / AL.c) + AL.R0 : AL.R0);
const M2020to709 = [
  [1.6605, -0.5876, -0.0728],
  [-0.1246, 1.1329, -0.0083],
  [-0.0182, -0.1006, 1.1187],
];
const acesFilm = (x) => clamp01((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
const srgbOetf = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);

function appleLog(c) {
  const lin = c.map(appleLogToLinear);
  const r709 = M2020to709.map((row) => Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]));
  return r709.map((x) => srgbOetf(acesFilm(x * 0.85)));
}

/* ------------------------------------------------------------------ receitas */

/**
 * Cada receita recebe um RGB 0..1 (vídeo comum Rec.709/sRGB) e devolve o RGB corrigido.
 * Pensadas para dar um look forte, mas sem estourar pele nem altas luzes.
 */
const RECIPES = {
  natural: (c) => {
    // correção "limpa": contraste suave, preto firme, saturação +, leve calor
    c = lgg(c, [-0.012, -0.012, -0.012], [1.03, 1.03, 1.03], [1.02, 1.02, 1.02]);
    c = contrast(c, 1.12);
    c = saturation(c, 1.12);
    return rolloff(temperature(c, 0.08));
  },
  'teal-orange': (c) => {
    const skin = skinWeight(c);
    let o = contrast(c, 1.14);
    o = splitTone(o, [0.4, 0.54, 0.58], [0.62, 0.52, 0.4], 0.42, 0.5);
    o = o.map((v) => 0.012 + v * 0.988); // preto não afunda no ciano
    o = hueRange(o, 120, 70, { shift: 45, sat: 0.75 }); // verdes → ciano
    o = hueRange(o, 215, 60, { shift: -15, sat: 1.15 }); // azuis mais teal
    o = saturation(o, 1.12);
    // pele preservada: mistura de volta com a pele levemente aquecida
    const warmSkin = saturation(temperature(contrast(c, 1.1), 0.3), 1.08);
    return rolloff(o.map((v, i) => mix(v, warmSkin[i], skin * 0.7)));
  },
  kodak: (c) => {
    // emulação de película de cinema (tipo Kodak 2383): preto rico, vermelhos densos, sombras ciano
    c = fade(c, 0.025, 0.985);
    c = contrast(c, 1.22, 0.42);
    c = splitTone(c, [0.44, 0.52, 0.56], [0.58, 0.52, 0.42], 0.45);
    c = hueRange(c, 0, 50, { sat: 1.15, val: 0.95 });
    c = hueRange(c, 120, 70, { shift: 18, sat: 0.8 });
    c = saturation(c, 1.05);
    return rolloff(c, 0.72);
  },
  eterna: (c) => {
    // tipo Fuji Eterna: baixo contraste, cores contidas, verde-ciano suave
    c = fade(c, 0.05, 0.96);
    c = contrast(c, 0.92);
    c = saturation(c, 0.78);
    c = splitTone(c, [0.46, 0.54, 0.54], [0.52, 0.52, 0.48], 0.4);
    return rolloff(c, 0.7);
  },
  bleach: (c) => {
    // bleach bypass: dessaturado, contraste alto, tom prateado
    const l = luma(c);
    let o = saturation(c, 0.45);
    o = o.map((v) => mix(v, l, 0.15));
    o = contrast(o, 1.45);
    return rolloff(lgg(o, [0, 0, 0.01], [1, 1, 1.02], [1.02, 1.02, 1.03]), 0.82);
  },
  golden: (c) => {
    // hora dourada: altas luzes douradas, sombras levemente magenta, contraste macio
    c = temperature(c, 0.45);
    c = splitTone(c, [0.53, 0.47, 0.52], [0.66, 0.56, 0.38], 0.5);
    c = contrast(c, 1.06);
    c = saturation(c, 1.1);
    return rolloff(c, 0.75);
  },
  moody: (c) => {
    // thriller/Fincher: verde-amarelado, preto esmagado, pouca saturação
    c = lgg(c, [-0.02, -0.01, -0.03], [0.95, 1, 0.92], [0.98, 1.0, 0.9]);
    c = contrast(c, 1.2, 0.4);
    c = saturation(c, 0.68);
    c = splitTone(c, [0.46, 0.55, 0.47], [0.55, 0.55, 0.42], 0.45);
    return rolloff(c, 0.7);
  },
  noir: (c) => {
    // P&B com filtro vermelho (céu escuro, pele clara) e contraste alto
    const l = clamp01(0.45 * c[0] + 0.45 * c[1] + 0.1 * c[2]);
    const v = sCurve(l, 1.5, 0.42);
    return rolloff([v, v, v * 0.99], 0.85);
  },
  vintage: (c) => {
    // anos 70: preto desbotado, amarelo/magenta, azuis contidos
    c = fade(c, 0.08, 0.94);
    c = lgg(c, [0.02, 0.0, -0.02], [1.04, 1.0, 0.92], [1.03, 1.0, 0.9]);
    c = hueRange(c, 220, 70, { sat: 0.65 });
    c = saturation(c, 0.88);
    return contrast(c, 1.05);
  },
  cyberpunk: (c) => {
    c = contrast(c, 1.15);
    c = splitTone(c, [0.36, 0.5, 0.68], [0.7, 0.42, 0.68], 0.6, 0.45);
    c = hueRange(c, 40, 60, { shift: -30, sat: 1.1 });
    return rolloff(saturation(c, 1.25));
  },
  'day-night': (c) => {
    // noite americana: subexposto, azul, sem saturação nas altas luzes
    c = c.map((v) => v * 0.62);
    c = saturation(c, 0.55);
    c = lgg(c, [0, 0.01, 0.04], [0.95, 1, 1.1], [0.82, 0.9, 1.12]);
    return contrast(c, 1.12, 0.3);
  },
  skin: (c) => {
    // pele bonita: aquece só a pele, tira o verde, satura levemente
    const w = skinWeight(c);
    let o = contrast(c, 1.06);
    o = hueRange(o, 105, 60, { sat: 0.85 });
    const s = saturation(temperature(o, 0.25), 1.12);
    o = o.map((v, i) => mix(v, s[i], 0.35 + 0.65 * w));
    return rolloff(lgg(o, [0, 0, 0], [1.04, 1.03, 1.02], [1, 1, 1]));
  },
  matte: (c) => {
    c = fade(c, 0.07, 0.95);
    c = contrast(c, 1.08);
    c = splitTone(c, [0.48, 0.5, 0.54], [0.54, 0.51, 0.47], 0.35);
    return saturation(c, 0.92);
  },
  winter: (c) => {
    c = temperature(c, -0.45);
    c = saturation(c, 0.8);
    c = contrast(c, 1.12);
    return rolloff(splitTone(c, [0.46, 0.5, 0.58], [0.5, 0.52, 0.56], 0.35));
  },
  pastel: (c) => {
    // estilo Wes Anderson: claro, pastel, rosas e amarelos quentes
    c = fade(c, 0.06, 1);
    c = contrast(c, 0.9, 0.5);
    c = hueRange(c, 340, 70, { sat: 1.2, val: 1.03 });
    c = hueRange(c, 55, 50, { sat: 1.15 });
    c = temperature(c, 0.15);
    return rolloff(lgg(c, [0.02, 0.02, 0.02], [1.08, 1.06, 1.05], [1, 1, 1]), 0.8);
  },
  'apple-log': appleLog,
};

export const LUTS = [
  { id: 'none', name: 'Nenhum', category: 'Básico', desc: 'Sem LUT' },
  { id: 'natural', name: 'Natural Rec.709', category: 'Correção', desc: 'Correção limpa: contraste, preto firme e cor viva' },
  { id: 'skin', name: 'Pele Bonita', category: 'Correção', desc: 'Aquece e valoriza tons de pele, tira o verde' },
  { id: 'apple-log', name: 'Apple Log → 709', category: 'Correção', desc: 'Converte vídeo Apple Log (iPhone 15 Pro+) para cores normais' },
  { id: 'teal-orange', name: 'Teal & Orange', category: 'Cinema', desc: 'Blockbuster: sombras azul-petróleo, pele laranja preservada' },
  { id: 'kodak', name: 'Filme Kodak', category: 'Cinema', desc: 'Emulação de película de cinema: preto rico, vermelhos densos' },
  { id: 'eterna', name: 'Fuji Eterna', category: 'Cinema', desc: 'Baixo contraste, cores contidas, verde-ciano suave' },
  { id: 'bleach', name: 'Bleach Bypass', category: 'Cinema', desc: 'Dessaturado e contrastado, tom prateado de guerra/ação' },
  { id: 'moody', name: 'Moody Verde', category: 'Cinema', desc: 'Thriller: verde-amarelado, preto profundo' },
  { id: 'matte', name: 'Matte Cinema', category: 'Cinema', desc: 'Preto lavado elegante, look de série' },
  { id: 'golden', name: 'Hora Dourada', category: 'Clima', desc: 'Pôr do sol: altas luzes douradas' },
  { id: 'winter', name: 'Inverno', category: 'Clima', desc: 'Frio, azulado e nítido' },
  { id: 'day-night', name: 'Noite Americana', category: 'Clima', desc: 'Transforma dia em noite' },
  { id: 'vintage', name: 'Vintage 70s', category: 'Estilo', desc: 'Desbotado amarelo-magenta' },
  { id: 'pastel', name: 'Pastel', category: 'Estilo', desc: 'Claro e pastel, estilo Wes Anderson' },
  { id: 'cyberpunk', name: 'Cyberpunk', category: 'Estilo', desc: 'Magenta e ciano neon' },
  { id: 'noir', name: 'Noir P&B', category: 'Estilo', desc: 'Preto e branco com filtro vermelho' },
];

/* ------------------------------------------------------------------ tabelas */

const cache = new Map(); // id -> {size, data, name}

function bake(fn, size = LUT_SIZE) {
  const data = new Float32Array(size * size * size * 3);
  let o = 0;
  const n = size - 1;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const out = fn([r / n, g / n, b / n]);
        data[o++] = clamp01(out[0]);
        data[o++] = clamp01(out[1]);
        data[o++] = clamp01(out[2]);
      }
  return data;
}

/** Tabela do LUT (gera e guarda em cache). null para 'none' ou desconhecido. */
export function getLut(id) {
  if (!id || id === 'none') return null;
  if (cache.has(id)) return cache.get(id);
  const fn = RECIPES[id];
  if (!fn) return null;
  const lut = { id, size: LUT_SIZE, data: bake(fn), name: LUTS.find((l) => l.id === id)?.name || id };
  cache.set(id, lut);
  return lut;
}

export function lutName(id) {
  return LUTS.find((l) => l.id === id)?.name || cache.get(id)?.name || 'LUT';
}

/** Registra um LUT importado (.cube). */
export function registerCustomLut(id, name, parsed) {
  const lut = { id, name, size: parsed.size, data: parsed.data, custom: true };
  cache.set(id, lut);
  return lut;
}

/**
 * Lê um arquivo .cube (Adobe/Resolve). Suporta LUT_3D_SIZE, DOMAIN_MIN/MAX e TITLE.
 * @returns {{size:number, data:Float32Array, title?:string}}
 */
export function parseCube(text) {
  let size = 0;
  let title = '';
  let dmin = [0, 0, 0];
  let dmax = [1, 1, 1];
  const values = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const up = line.toUpperCase();
    if (up.startsWith('TITLE')) title = line.replace(/^TITLE\s*/i, '').replace(/^"|"$/g, '');
    else if (up.startsWith('LUT_3D_SIZE')) size = parseInt(line.split(/\s+/)[1], 10);
    else if (up.startsWith('LUT_1D_SIZE')) throw new Error('LUT 1D não é suportado (use um LUT 3D)');
    else if (up.startsWith('DOMAIN_MIN')) dmin = line.split(/\s+/).slice(1, 4).map(Number);
    else if (up.startsWith('DOMAIN_MAX')) dmax = line.split(/\s+/).slice(1, 4).map(Number);
    else if (/^[-+.\d]/.test(line)) {
      const p = line.split(/\s+/);
      values.push(+p[0], +p[1], +p[2]);
    }
  }
  if (!size || size < 2 || size > 128) throw new Error('Arquivo .cube sem LUT_3D_SIZE válido');
  if (values.length < size ** 3 * 3) throw new Error(`O .cube tem ${values.length / 3} cores, esperado ${size ** 3}`);
  const data = new Float32Array(size ** 3 * 3);
  for (let i = 0; i < data.length; i++) {
    const ch = i % 3;
    data[i] = clamp01((values[i] - dmin[ch]) / (dmax[ch] - dmin[ch] || 1));
  }
  return { size, data, title };
}

/* ------------------------------------------------------------------ aplicação na CPU */

/** Aplica o LUT (trilinear) num ImageData, misturando com o original pela intensidade (0..1). */
export function applyLutToImageData(img, lut, intensity = 1) {
  const { size, data } = lut;
  const n = size - 1;
  const px = img.data;
  const s2 = size * size;
  const at = (r, g, b, ch) => data[(b * s2 + g * size + r) * 3 + ch];
  for (let i = 0; i < px.length; i += 4) {
    const fr = (px[i] / 255) * n;
    const fg = (px[i + 1] / 255) * n;
    const fb = (px[i + 2] / 255) * n;
    const r0 = Math.min(n - 1, fr | 0);
    const g0 = Math.min(n - 1, fg | 0);
    const b0 = Math.min(n - 1, fb | 0);
    const dr = fr - r0;
    const dg = fg - g0;
    const db = fb - b0;
    for (let ch = 0; ch < 3; ch++) {
      const c00 = mix(at(r0, g0, b0, ch), at(r0 + 1, g0, b0, ch), dr);
      const c10 = mix(at(r0, g0 + 1, b0, ch), at(r0 + 1, g0 + 1, b0, ch), dr);
      const c01 = mix(at(r0, g0, b0 + 1, ch), at(r0 + 1, g0, b0 + 1, ch), dr);
      const c11 = mix(at(r0, g0 + 1, b0 + 1, ch), at(r0 + 1, g0 + 1, b0 + 1, ch), dr);
      const v = mix(mix(c00, c10, dg), mix(c01, c11, dg), db) * 255;
      px[i + ch] = mix(px[i + ch], v, intensity);
    }
  }
  return img;
}

/** Miniatura com o LUT aplicado (data URL), para a grade de LUTs. */
const thumbCache = new Map();
export async function lutThumb(src, lutId, w = 120) {
  const key = `${lutId}|${w}|${src}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const h = Math.max(1, Math.round((w * img.naturalHeight) / Math.max(1, img.naturalWidth)));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const lut = getLut(lutId);
      if (lut) {
        try {
          ctx.putImageData(applyLutToImageData(ctx.getImageData(0, 0, w, h), lut, 1), 0, 0);
        } catch {
          /* imagem contaminada (CORS) */
        }
      }
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
  thumbCache.set(key, p);
  return p;
}
