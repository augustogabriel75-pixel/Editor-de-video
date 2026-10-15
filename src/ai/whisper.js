/**
 * Speech-to-text real no aparelho com Whisper (transformers.js), rodando num Web Worker.
 * O modelo é baixado do Hugging Face na primeira vez e fica em cache no navegador/app.
 * Para usar outro servidor de modelos: window.MOTIONCUT_MODEL_HOST = 'https://meu-servidor/modelos/'.
 */
export const STT_MODELS = {
  base: { id: 'Xenova/whisper-base', label: 'Preciso (whisper-base, ~80 MB)' },
  tiny: { id: 'Xenova/whisper-tiny', label: 'Rápido (whisper-tiny, ~40 MB)' },
};

let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./sttWorker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'progress') {
      for (const p of pending.values()) p.onProgress?.(msg);
      return;
    }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.type === 'result') p.resolve(msg);
    else p.reject(new Error(msg.error));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'falha no worker de transcrição'));
    pending.clear();
    worker = null;
  };
  return worker;
}

/** Fallback: roda o Whisper na própria página (quando o Worker não consegue carregar o runtime). */
async function transcribeInPage(params, onProgress) {
  const { transcribeSegments } = await import('./sttCore');
  return transcribeSegments(params, (m) => m.type === 'progress' && onProgress?.(m));
}

/** Transcreve trechos de voz (Float32Array mono 16 kHz cada). Retorna um texto por trecho. */
export async function whisperTranscribeSegments(segments, { language = 'portuguese', model = 'base', onProgress } = {}) {
  const modelId = window.MOTIONCUT_STT_MODEL || (STT_MODELS[model] || STT_MODELS.base).id;
  const params = { segments, language: language === 'auto' ? null : language, model: modelId, host: window.MOTIONCUT_MODEL_HOST || undefined, wasmPaths: window.MOTIONCUT_WASM_PATHS || undefined };
  if (!window.MOTIONCUT_STT_NO_WORKER) {
    try {
      const w = getWorker();
      const id = ++seq;
      const copies = segments.map((s) => s.slice());
      return await new Promise((resolve, reject) => {
        pending.set(id, { resolve: (m) => resolve(m.texts), reject, onProgress });
        w.postMessage({ ...params, id, segments: copies }, copies.map((s) => s.buffer));
      });
    } catch (e) {
      console.warn('Worker de transcrição falhou; tentando na página', e);
    }
  }
  return transcribeInPage({ ...params, id: 0 }, onProgress);
}
