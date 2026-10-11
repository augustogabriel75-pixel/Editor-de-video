/** Importação de arquivos locais (vídeo, imagem, áudio) — tudo processado no navegador. */
import { uid } from './utils';
import { decodeToMono } from '../ai/audioAnalysis';
import { computePeaks } from '../audio/synth';

function loadVideoMeta(src) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.src = src;
    const fail = () => resolve(null);
    v.onerror = fail;
    v.onloadedmetadata = () => {
      const dur = v.duration;
      v.currentTime = Math.min(1, dur / 3);
      v.onseeked = () => {
        let thumb = null;
        try {
          const c = document.createElement('canvas');
          c.height = 180;
          c.width = Math.round((180 * v.videoWidth) / Math.max(1, v.videoHeight));
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          thumb = c.toDataURL('image/jpeg', 0.8);
        } catch {
          /* ignore */
        }
        resolve({ duration: dur, width: v.videoWidth, height: v.videoHeight, thumb });
      };
    };
    setTimeout(fail, 15000);
  });
}

function loadImageMeta(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function importFiles(files) {
  const out = [];
  for (const file of files) {
    const src = URL.createObjectURL(file);
    const base = { id: uid('asset'), name: file.name.replace(/\.[^.]+$/, ''), src, imported: true, category: 'Importado', size: file.size };
    if (file.type.startsWith('video/')) {
      const meta = await loadVideoMeta(src);
      if (!meta) continue;
      const dec = await decodeToMono({ src });
      out.push({ ...base, type: 'video', ...meta, hasAudio: !!dec, peaks: dec ? computePeaks(dec.samples, 600) : null });
    } else if (file.type.startsWith('image/')) {
      const meta = await loadImageMeta(src);
      if (!meta) continue;
      out.push({ ...base, type: 'image', duration: 5, thumb: src, ...meta });
    } else if (file.type.startsWith('audio/')) {
      const dec = await decodeToMono({ src });
      if (!dec) continue;
      out.push({ ...base, type: 'audio', duration: dec.samples.length / dec.sampleRate, peaks: computePeaks(dec.samples, 600), category: 'Música' });
    }
  }
  return out;
}
