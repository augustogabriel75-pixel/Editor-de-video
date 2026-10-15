/* Web Worker de speech-to-text (Whisper). */
import { transcribeSegments } from './sttCore';

self.onmessage = async (e) => {
  const { id } = e.data;
  try {
    const texts = await transcribeSegments(e.data, (m) => self.postMessage(m));
    self.postMessage({ id, type: 'result', texts });
  } catch (err) {
    self.postMessage({ id, type: 'error', error: String(err?.message || err) });
  }
};
