/** Picos de forma de onda por asset (memoizados). */
import { getSynthSamples, computePeaks } from '../audio/synth';
import { narrationEnvelope } from '../ai/demoTranscript';

const cache = new Map();

export function getAssetPeaks(asset) {
  if (!asset) return null;
  if (cache.has(asset.id)) return cache.get(asset.id);
  let data = null;
  if (asset.synth) data = computePeaks(getSynthSamples(asset.synth.kind, asset.synth.id), Math.max(200, Math.round(asset.duration * 40)));
  else if (asset.transcript) data = narrationEnvelope(asset.transcript, asset.duration, 40);
  else if (asset.peaks) data = asset.peaks;
  const res = data ? { data, duration: asset.duration } : null;
  cache.set(asset.id, res);
  return res;
}
