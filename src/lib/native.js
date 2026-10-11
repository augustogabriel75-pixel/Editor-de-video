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

/**
 * Envia um Blob ao app nativo em pedaços base64 e salva na galeria e/ou abre o compartilhamento.
 * @returns {Promise<{ok:boolean, saved?:boolean, location?:string, error?:string}>}
 */
export async function saveBlobNative(blob, name, { gallery = true, share = false, onProgress } = {}) {
  if (!native) throw new Error('Disponível apenas no app Android');
  const id = native.beginFile(name, blob.type || 'video/mp4');
  if (!id) throw new Error('Não foi possível criar o arquivo');
  for (let off = 0; off < blob.size; off += CHUNK) {
    const b64 = await chunkToBase64(blob.slice(off, off + CHUNK));
    if (!native.appendChunk(id, b64)) throw new Error('Falha ao gravar o arquivo');
    onProgress?.(Math.min(1, (off + CHUNK) / blob.size));
  }
  return JSON.parse(native.finishFile(id, gallery, share));
}
