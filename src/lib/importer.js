/** Importação de arquivos locais (vídeo, imagem, áudio) — tudo processado no navegador. */
import { uid } from './utils';
import { decodeToMono } from '../ai/audioAnalysis';
import { computePeaks } from '../audio/synth';
import { putMedia, storageAvailable } from './projectStore';
import { mediaKind, playableUrl } from './mediaTypes';
import { probeMedia, explainUnplayable, transcodeForPlayback } from './mediaProbe';

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
      // sem imagem (ex.: só o áudio de um HEVC sem decodificador) conta como falha
      if (!v.videoWidth || !Number.isFinite(dur) || dur <= 0) return fail();
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

/**
 * Importa arquivos. Devolve a lista de assets; `lista.errors` traz mensagens dos arquivos recusados.
 * @param {File[]} files
 * @param {{onStatus?: (msg: string) => void}} [opts]
 */
export async function importFiles(files, { onStatus } = {}) {
  const out = [];
  out.errors = [];
  for (const file of files) {
    const kind = mediaKind(file);
    if (!kind) {
      out.errors.push(`“${file.name}”: tipo de arquivo não suportado`);
      continue;
    }
    const id = uid('asset');
    const name = file.name.replace(/\.[^.]+$/, '');
    let stored = file;
    let src = kind === 'video' ? playableUrl(file) : URL.createObjectURL(file);
    const base = { id, mediaKey: id, name, imported: true, category: 'Importado', size: file.size, mime: file.type || '' };
    if (kind === 'video') {
      let meta = window.MOTIONCUT_FORCE_CONVERT ? null : await loadVideoMeta(src);
      const desktop = window.MotionCutDesktop;
      const diskPath = desktop?.pathForFile?.(file);
      // App de PC: HEVC/ProRes que o Chromium não abre, ou HDR (cores lavadas no canvas),
      // vão para o FFmpeg embutido e viram MP4 H.264 + AAC.
      let info = null;
      if (diskPath && (!meta || (info = await probeMedia(file)).video?.hdr)) {
        onStatus?.(`Convertendo “${file.name}”…`);
        const r = await desktop
          .convert(diskPath, (p) => onStatus?.(`Convertendo “${file.name}”… ${Math.round(p * 100)}%`))
          .catch((e) => ({ ok: false, error: String(e?.message || e) }));
        if (r?.ok) {
          const conv = new Blob([await (await fetch(r.url)).blob()], { type: 'video/mp4' });
          const convSrc = URL.createObjectURL(conv);
          const m2 = await loadVideoMeta(convSrc);
          if (m2) {
            URL.revokeObjectURL(src);
            stored = conv;
            src = convSrc;
            meta = m2;
            base.converted = true;
          } else URL.revokeObjectURL(convSrc);
        } else if (!meta) {
          console.warn('FFmpeg falhou', r?.error);
          out.errors.push(`“${file.name}”: falha ao converter com o FFmpeg (${r?.error || 'erro desconhecido'})`);
          URL.revokeObjectURL(src);
          continue;
        }
      }
      if (!meta) {
        // o <video> não abriu: descobre o motivo e, se o WebCodecs decodificar, converte
        info ||= await probeMedia(file);
        if (info.video?.canDecode) {
          onStatus?.(`Convertendo “${file.name}” (${info.video.label}) para um formato compatível…`);
          const conv = await transcodeForPlayback(file, { onProgress: (p) => onStatus?.(`Convertendo “${file.name}”… ${Math.round(p * 100)}%`) }).catch((e) => {
            console.warn('conversão falhou', e);
            return null;
          });
          if (conv) {
            URL.revokeObjectURL(src);
            stored = conv;
            src = URL.createObjectURL(conv);
            meta = await loadVideoMeta(src);
          }
        }
        if (!meta) {
          URL.revokeObjectURL(src);
          out.errors.push(explainUnplayable(file.name, info));
          continue;
        }
        base.converted = true;
      }
      if (stored !== file) base.mime = 'video/mp4';
      const dec = await decodeToMono({ src });
      out.push({ ...base, src, type: 'video', ...meta, hasAudio: !!dec, peaks: dec ? computePeaks(dec.samples, 600) : null });
    } else if (kind === 'image') {
      const meta = await loadImageMeta(src);
      if (!meta) {
        out.errors.push(`“${file.name}”: imagem em formato que este navegador não abre${/heic|heif/i.test(file.type + file.name) ? ' (HEIC do iPhone: exporte como JPG ou use Ajustes › Câmera › Formatos › “Mais Compatível”)' : ''}`);
        continue;
      }
      out.push({ ...base, src, type: 'image', duration: 5, thumb: src, ...meta });
    } else {
      const dec = await decodeToMono({ src });
      if (!dec) {
        out.errors.push(`“${file.name}”: não foi possível decodificar o áudio`);
        continue;
      }
      out.push({ ...base, src, type: 'audio', duration: dec.samples.length / dec.sampleRate, peaks: computePeaks(dec.samples, 600), category: 'Música' });
    }
    // guarda o arquivo no aparelho para o projeto poder ser reaberto depois
    if (storageAvailable()) putMedia(id, stored).catch((e) => console.warn('não foi possível salvar a mídia', e));
  }
  return out;
}
