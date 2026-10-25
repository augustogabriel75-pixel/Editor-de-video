/**
 * Integração com o app Android (window.MotionCutNative, ver android/app/src/main/java).
 * No navegador comum tudo isto vira no-op e o app usa as APIs web.
 */
export const native = typeof window !== 'undefined' ? window.MotionCutNative : undefined;
export const isNativeApp = !!native;

export function nativeInfo() {
  try {
    return native ? JSON.parse(native.info()) : null;
  } catch {
    return null;
  }
}

export function nativeKeepScreenOn(on) {
  try {
    native?.keepScreenOn(!!on);
  } catch {
    /* ignore */
  }
}

const CHUNK = 768 * 1024;

function chunkToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function uploadBlob(blob, name, onProgress) {
  const id = native.beginFile(name, blob.type || 'video/mp4');
  if (!id) throw new Error('Não foi possível criar o arquivo');
  for (let off = 0; off < blob.size; off += CHUNK) {
    const b64 = await chunkToBase64(blob.slice(off, off + CHUNK));
    if (!native.appendChunk(id, b64)) throw new Error('Falha ao gravar o arquivo');
    onProgress?.(Math.min(1, (off + CHUNK) / blob.size));
  }
  return id;
}

/** O app nativo sabe montar MP4 com áudio AAC (MediaCodec + MediaMuxer)? */
export const nativeCanMux = () => !!native && typeof native.muxAacAsync === 'function' && typeof native.closeFile === 'function';

/** Grava um Blob no cache do app e devolve o nome do arquivo lá. */
export async function stageBlobNative(blob, name, onProgress) {
  const id = await uploadBlob(blob, name, onProgress);
  const staged = native.closeFile(id);
  if (!staged) throw new Error('Falha ao gravar o arquivo');
  return staged;
}

const pendingCbs = new Map();
if (typeof window !== 'undefined') {
  window.__motioncutNativeCb = (cb, json) => {
    const fn = pendingCbs.get(cb);
    pendingCbs.delete(cb);
    try {
      fn?.(JSON.parse(json));
    } catch {
      fn?.({ ok: false, error: 'resposta inválida' });
    }
  };
}

/** Junta vídeo (H.264) + WAV num MP4 com áudio AAC, no aparelho. */
export function muxAacNative(videoName, wavName, outName) {
  return new Promise((resolve) => {
    const cb = `mux${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    pendingCbs.set(cb, resolve);
    native.muxAacAsync(videoName, wavName || '', outName, cb);
  });
}

/** URL para o WebView ler um arquivo do cache de exportação do app. */
export const nativeExportUrl = (name) => `/__exports/${encodeURIComponent(name)}`;

/**
 * Salva na galeria e/ou compartilha um arquivo que já está no cache do app.
 * target: '' (escolher app) ou 'whatsapp'.
 */
export function publishNative(name, { gallery = true, share = false, target = '' } = {}) {
  if (typeof native.publish !== 'function') return { ok: false, error: 'Atualize o app' };
  return JSON.parse(native.publish(name, gallery, share, target));
}

/**
 * Envia um Blob ao app nativo em pedaços base64 e salva na galeria e/ou abre o compartilhamento.
 * @returns {Promise<{ok:boolean, saved?:boolean, location?:string, error?:string}>}
 */
export async function saveBlobNative(blob, name, { gallery = true, share = false, target = '', onProgress } = {}) {
  if (!native) throw new Error('Disponível apenas no app Android');
  if (typeof native.publish === 'function') return publishNative(await stageBlobNative(blob, name, onProgress), { gallery, share, target });
  const id = await uploadBlob(blob, name, onProgress);
  return JSON.parse(native.finishFile(id, gallery, share));
}
