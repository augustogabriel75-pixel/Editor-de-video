/**
 * Codificador AAC-LC embutido (Fraunhofer FDK em WebAssembly, pacote @audio/encode-aac) para
 * navegadores cujo WebCodecs não codifica AAC (Firefox, Chromium no Linux, alguns WebViews).
 * Sem AAC o MP4 sai com Opus, que o WhatsApp recusa.
 *
 * Devolve os quadros AAC "crus" (sem cabeçalho ADTS) prontos para o mp4-muxer.
 */
const FREQS = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

/** AudioSpecificConfig (ISO 14496-3) para AAC-LC. */
function audioSpecificConfig(sampleRate, channels) {
  const idx = FREQS.indexOf(sampleRate);
  const aot = 2;
  return new Uint8Array([(aot << 3) | (idx >> 1), ((idx & 1) << 7) | (channels << 3)]);
}

/** Separa um fluxo ADTS em quadros AAC crus. */
function splitAdts(bytes, out) {
  let off = 0;
  while (off + 7 <= bytes.length) {
    if (bytes[off] !== 0xff || (bytes[off + 1] & 0xf0) !== 0xf0) {
      off++;
      continue;
    }
    const protectionAbsent = bytes[off + 1] & 1;
    const len = ((bytes[off + 3] & 3) << 11) | (bytes[off + 4] << 3) | (bytes[off + 5] >> 5);
    const head = protectionAbsent ? 7 : 9;
    if (len < head || off + len > bytes.length) break;
    out.push(bytes.slice(off + head, off + len));
    off += len;
  }
}

/**
 * Codifica um AudioBuffer (48 kHz, estéreo) em AAC-LC.
 * @returns {Promise<{frames: Uint8Array[], frameDuration: number, description: Uint8Array, sampleRate: number, channels: number}>}
 */
export async function encodeAacFallback(buffer, { bitrate = 192, onProgress } = {}) {
  const { default: aac } = await import('@audio/encode-aac');
  const sampleRate = buffer.sampleRate;
  const channels = Math.min(2, buffer.numberOfChannels);
  const enc = await aac({ sampleRate, channels, bitrate, profile: 'lc' });
  const chans = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  const frames = [];
  const N = sampleRate; // 1 s por vez
  for (let off = 0; off < buffer.length; off += N) {
    const part = chans.map((d) => d.subarray(off, Math.min(buffer.length, off + N)));
    splitAdts(await enc.encode(part), frames);
    onProgress?.(off / buffer.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  splitAdts(await enc.flush(), frames);
  // o FDK atrasa o áudio em `priming` amostras (2048 = 2 quadros): descarta-os para manter a sincronia
  const frameLength = enc.frameLength || 1024;
  const drop = enc.priming && enc.priming % frameLength === 0 ? enc.priming / frameLength : 0;
  return {
    frames: frames.slice(drop),
    frameDuration: frameLength / sampleRate,
    description: audioSpecificConfig(sampleRate, channels),
    sampleRate,
    channels,
  };
}
