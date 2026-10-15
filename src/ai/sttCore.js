/* Núcleo do speech-to-text (Whisper). Usado pelo Web Worker e, como fallback, na página. */
import { pipeline, env } from '@huggingface/transformers';
import ortWasm from '../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import ortMjs from '../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url';

// Runtime ONNX empacotado com o app (funciona sem CDN). No build de arquivo único usa o CDN.
const LOCAL_WASM = import.meta.env.MODE === 'single' ? null : { wasm: new URL(ortWasm, import.meta.url).href, mjs: new URL(ortMjs, import.meta.url).href };

let asr = null;
let loadedKey = null;

async function load({ model, host, wasmPaths }, post) {
  const key = `${model}|${host || ''}`;
  if (asr && loadedKey === key) return asr;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  if (host) {
    env.remoteHost = host;
    env.remotePathTemplate = '{model}/';
  }
  const paths = wasmPaths || LOCAL_WASM;
  if (paths) env.backends.onnx.wasm.wasmPaths = paths;
  env.backends.onnx.wasm.numThreads = 1;
  const files = {};
  asr = await pipeline('automatic-speech-recognition', model, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p) => {
      if (p.status === 'progress' && p.file) {
        files[p.file] = { loaded: p.loaded || 0, total: p.total || 0 };
        const vals = Object.values(files);
        const loaded = vals.reduce((a, f) => a + f.loaded, 0);
        const total = vals.reduce((a, f) => a + f.total, 0);
        post({ type: 'progress', stage: 'download', progress: total ? loaded / total : 0, loaded, total });
      }
    },
  });
  loadedKey = key;
  return asr;
}

/** Remove repetições em loop (alucinação típica do Whisper): "a b c a b c a b c" -> "a b c". */
function dedupeLoops(text) {
  let words = text.split(/\s+/).filter(Boolean);
  for (let n = 1; n <= 8; n++) {
    const out = [];
    for (let i = 0; i < words.length; i++) {
      out.push(words[i]);
      if (out.length >= 2 * n) {
        const a = out.slice(-2 * n, -n).join(' ').toLowerCase();
        const b = out.slice(-n).join(' ').toLowerCase();
        if (a === b) out.splice(-n, n);
      }
    }
    words = out;
  }
  return words.join(' ');
}

const HALLUCINATIONS = /^(legendas? (pela|por)|obrigad[oa]( por assistir)?\.?$|inscreva-se|amara\.org|\[.*\]|\(.*\))/i;

/** Transcreve trechos de áudio 16 kHz; `post` recebe mensagens de progresso. */
export async function transcribeSegments({ id, segments, language, model, host, wasmPaths }, post) {
  const pipe = await load({ model, host, wasmPaths }, post);
  const texts = [];
  for (let i = 0; i < segments.length; i++) {
    post({ id, type: 'progress', stage: 'transcribe', progress: i / segments.length });
    const audio = segments[i];
    const secs = audio.length / 16000;
    const out = await pipe(audio, {
      language,
      task: 'transcribe',
      max_new_tokens: Math.min(220, Math.round(10 + secs * 7)),
      no_repeat_ngram_size: 4,
    });
    let text = dedupeLoops(String(out?.text || '').trim());
    if (HALLUCINATIONS.test(text)) text = '';
    texts.push(text);
  }
  return texts;
}
