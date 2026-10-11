/**
 * Exportação real no navegador: renderiza a timeline em um canvas na resolução escolhida
 * (até 4K), captura com captureStream() + áudio mixado do WebAudio e grava com MediaRecorder.
 * Sem marca d'água, sem servidor.
 */
import { useEditorStore } from '../store/useEditorStore';
import { renderFrame } from './renderer';
import { getExportStream, ensureContext } from './audioEngine';
import { getAspect } from '../lib/catalog';

export const RESOLUTIONS = [
  { id: '720p', label: '720p HD', short: 720 },
  { id: '1080p', label: '1080p Full HD', short: 1080 },
  { id: '1440p', label: '2K QHD', short: 1440 },
  { id: '2160p', label: '4K UHD', short: 2160 },
];

export function frameSize(aspectId, short) {
  const a = getAspect(aspectId);
  const even = (v) => Math.round(v / 2) * 2;
  if (a.w >= a.h) return { width: even((short * a.w) / a.h), height: short };
  return { width: short, height: even((short * a.h) / a.w) };
}

export function supportedFormats() {
  if (typeof MediaRecorder === 'undefined') return [];
  const cands = [
    { id: 'mp4', label: 'MP4 (H.264)', mime: 'video/mp4;codecs=avc1.640028,mp4a.40.2', ext: 'mp4' },
    { id: 'mp4b', label: 'MP4', mime: 'video/mp4', ext: 'mp4' },
    { id: 'webm9', label: 'WebM (VP9)', mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { id: 'webm8', label: 'WebM (VP8)', mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { id: 'webm', label: 'WebM', mime: 'video/webm', ext: 'webm' },
  ];
  const out = [];
  for (const c of cands) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime) && !out.some((o) => o.ext === c.ext)) out.push(c);
    } catch {
      /* ignore */
    }
  }
  return out;
}

export async function exportVideo({ aspect, short, fps = 30, format, onProgress, signal }) {
  const store = useEditorStore;
  const { width, height } = frameSize(aspect, short);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ensureContext();
  const vStream = canvas.captureStream(fps);
  const tracks = [...vStream.getVideoTracks()];
  const aStream = getExportStream();
  if (aStream) tracks.push(...aStream.getAudioTracks());
  const stream = new MediaStream(tracks);
  const bitrate = Math.round(width * height * fps * 0.12);
  const rec = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 192000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  const stopped = new Promise((res) => (rec.onstop = res));

  const s0 = store.getState();
  s0.pause();
  s0.seek(0);
  s0.setExporting(true);
  renderFrame(ctx, width, height, store.getState(), 0, { export: true, playing: false });
  await new Promise((r) => setTimeout(r, 120));
  rec.start(250);
  store.getState().play();

  await new Promise((resolve) => {
    const step = () => {
      const st = store.getState();
      if (signal?.aborted) {
        st.pause();
        resolve();
        return;
      }
      renderFrame(ctx, width, height, st, st.currentTime, { export: true, playing: st.isPlaying });
      onProgress?.(Math.min(1, st.currentTime / Math.max(0.001, st.duration)));
      if (!st.isPlaying || st.currentTime >= st.duration - 0.001) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  await new Promise((r) => setTimeout(r, 200));
  rec.stop();
  await stopped;
  tracks.forEach((t) => t.kind === 'video' && t.stop());
  store.getState().setExporting(false);
  if (signal?.aborted) return null;
  const blob = new Blob(chunks, { type: format.mime.split(';')[0] });
  return { blob, url: URL.createObjectURL(blob), width, height, ext: format.ext, size: blob.size };
}
