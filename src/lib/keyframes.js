/** Interpolação de keyframes de transformação (posição, escala, rotação, opacidade). */
import { Easing } from './utils';

export const TRANSFORM_KEYS = ['x', 'y', 'scale', 'rotation', 'opacity'];
export const KF_EPS = 1 / 30 / 2;

export function getTransformAt(clip, localTime) {
  const base = clip.transform;
  const kfs = clip.keyframes;
  if (!kfs || kfs.length === 0) return base;
  if (localTime <= kfs[0].t) return { ...base, ...kfs[0].values };
  const last = kfs[kfs.length - 1];
  if (localTime >= last.t) return { ...base, ...last.values };
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (localTime >= a.t && localTime <= b.t) {
      const p = Easing.inOutQuad((localTime - a.t) / Math.max(1e-6, b.t - a.t));
      const out = { ...base };
      for (const k of TRANSFORM_KEYS) {
        const va = a.values[k] ?? base[k];
        const vb = b.values[k] ?? base[k];
        out[k] = va + (vb - va) * p;
      }
      return out;
    }
  }
  return base;
}

export const keyframeAt = (clip, localTime) => (clip.keyframes || []).find((k) => Math.abs(k.t - localTime) <= KF_EPS);

export const sortKeyframes = (kfs) => [...kfs].sort((a, b) => a.t - b.t);
