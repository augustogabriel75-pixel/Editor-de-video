import { useEffect, useRef } from 'react';
import { getAssetPeaks } from '../../lib/peaks';
import { clipSourceSpan } from '../../lib/speedCurves';

export default function Waveform({ asset, clip, width, height, color = '#5eead4' }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const peaks = getAssetPeaks(asset);
    if (!c || !peaks) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.min(4000, Math.round(width)));
    c.width = w * dpr;
    c.height = height * dpr;
    c.style.width = `${w}px`;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, height);
    const N = peaks.data.length;
    const i0 = (clip.trimIn / peaks.duration) * N;
    const i1 = ((clip.trimIn + clipSourceSpan(clip)) / peaks.duration) * N;
    const vol = clip.audio?.muted ? 0.15 : Math.min(1.6, clip.audio?.volume ?? 1);
    ctx.fillStyle = color;
    const mid = height / 2;
    for (let x = 0; x < w; x += 2) {
      const a = Math.floor(i0 + (x / w) * (i1 - i0));
      const b = Math.max(a + 1, Math.floor(i0 + ((x + 2) / w) * (i1 - i0)));
      let v = 0;
      for (let i = a; i < b && i < N; i++) if (i >= 0 && peaks.data[i] > v) v = peaks.data[i];
      const bh = Math.max(1, Math.min(1, v * vol) * (height - 2));
      ctx.fillRect(x, mid - bh / 2, 1.4, bh);
    }
  }, [asset, clip, width, height, color]);
  return <canvas ref={ref} className="absolute left-0 top-0 pointer-events-none" style={{ height }} />;
}
