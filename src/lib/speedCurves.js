/**
 * Curvas de velocidade (estilo CapCut).
 * Cada ponto é [x, v]: x = posição normalizada no clipe (0..1), v = multiplicador de velocidade.
 * A curva é interpolada com cosseno (suave e sem overshoot) e integrada numericamente
 * para mapear tempo do clipe -> tempo da fonte (time remapping).
 */
import { clamp } from './utils';

export const SPEED_CURVES = [
  { id: 'none', name: 'Nenhuma', points: [[0, 1], [1, 1]] },
  { id: 'montage', name: 'Montagem', points: [[0, 1], [0.28, 3.2], [0.5, 0.9], [0.72, 3.2], [1, 1]] },
  { id: 'rollercoaster', name: 'Montanha-russa', points: [[0, 0.6], [0.2, 3.6], [0.45, 0.35], [0.7, 4], [0.88, 0.4], [1, 1.4]] },
  {
    id: 'piledriver',
    name: 'Bate-estaca',
    points: [[0, 0.35], [0.14, 4.5], [0.28, 0.3], [0.42, 4.5], [0.56, 0.3], [0.7, 4.5], [0.85, 0.3], [1, 2]],
  },
  { id: 'hero', name: 'Herói', points: [[0, 1.8], [0.38, 1.8], [0.5, 0.2], [0.62, 1.8], [1, 1.8]] },
  { id: 'bullet', name: 'Bala', points: [[0, 3], [0.38, 0.15], [0.62, 0.15], [1, 3]] },
  { id: 'jumpcut', name: 'Salto', points: [[0, 1], [0.45, 1], [0.5, 6], [0.55, 1], [1, 1]] },
  { id: 'flashin', name: 'Flash In', points: [[0, 0.3], [0.55, 0.8], [1, 5]] },
  { id: 'flashout', name: 'Flash Out', points: [[0, 5], [0.45, 0.8], [1, 0.3]] },
];

export const getCurve = (id) => SPEED_CURVES.find((c) => c.id === id) || SPEED_CURVES[0];

export function evalCurve(points, x) {
  if (!points || points.length === 0) return 1;
  if (x <= points[0][0]) return points[0][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, v0] = points[i];
    const [x1, v1] = points[i + 1];
    if (x <= x1) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      const s = (1 - Math.cos(t * Math.PI)) / 2;
      return v0 + (v1 - v0) * s;
    }
  }
  return points[points.length - 1][1];
}

const SAMPLES = 256;
const cache = new WeakMap();

function cumulative(points) {
  let c = cache.get(points);
  if (c) return c;
  c = new Float64Array(SAMPLES + 1);
  let acc = 0;
  for (let i = 1; i <= SAMPLES; i++) {
    const a = evalCurve(points, (i - 1) / SAMPLES);
    const b = evalCurve(points, i / SAMPLES);
    acc += ((a + b) / 2) * (1 / SAMPLES);
    c[i] = acc;
  }
  cache.set(points, c);
  return c;
}

export const curveAverage = (points) => cumulative(points)[SAMPLES];

/** ∫0^u curve(x) dx */
export function curveIntegral(points, u) {
  const c = cumulative(points);
  const p = clamp(u, 0, 1) * SAMPLES;
  const i = Math.floor(p);
  if (i >= SAMPLES) return c[SAMPLES];
  return c[i] + (c[i + 1] - c[i]) * (p - i);
}

export const hasCurve = (clip) => !!(clip.speedCurve && clip.speedCurve.id !== 'none' && clip.speedCurve.points);

/** Quantos segundos da fonte o clipe consome. */
export function clipSourceSpan(clip) {
  const speed = clip.speed || 1;
  if (!hasCurve(clip)) return clip.duration * speed;
  return clip.duration * speed * curveAverage(clip.speedCurve.points);
}

/** Tempo local do clipe (0..duration) -> deslocamento na fonte em segundos. */
export function sourceOffsetAt(clip, localTime) {
  const speed = clip.speed || 1;
  if (!hasCurve(clip)) return localTime * speed;
  return clip.duration * speed * curveIntegral(clip.speedCurve.points, localTime / clip.duration);
}

/** Velocidade instantânea em um tempo local (usada para playbackRate do áudio). */
export function instantSpeedAt(clip, localTime) {
  const speed = clip.speed || 1;
  if (!hasCurve(clip)) return speed;
  return speed * evalCurve(clip.speedCurve.points, clamp(localTime / clip.duration, 0, 1));
}
