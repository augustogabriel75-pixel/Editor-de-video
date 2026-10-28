/**
 * Leitura direta de arquivos de mídia com Mediabunny (MP4, MOV/QuickTime, WebM, MKV…).
 * Usada quando o <video>/decodeAudioData do navegador não consegue abrir o arquivo,
 * por exemplo .mov do iPhone no Firefox, e para explicar o motivo (ex.: HEVC sem decodificador).
 */
let mbPromise = null;
const loadMediabunny = () => (mbPromise ??= import('mediabunny'));

const CODEC_LABEL = { avc: 'H.264', hevc: 'HEVC (H.265)', vp8: 'VP8', vp9: 'VP9', av1: 'AV1', prores: 'ProRes' };

async function openInput(blob) {
  const { Input, BlobSource, ALL_FORMATS } = await loadMediabunny();
  return new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
}

/** Informações do arquivo: codecs, tamanho e se o navegador consegue decodificar (WebCodecs). */
export async function probeMedia(blob) {
  let input;
  try {
    input = await openInput(blob);
    const [video, audio] = await Promise.all([input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()]);
    const info = { ok: true, container: (await input.getFormat())?.name || '', duration: await input.computeDuration().catch(() => 0) };
    if (video) {
      const codec = await video.getCodec();
      const space = await video.getColorSpace().catch(() => ({}));
      info.video = {
        codec,
        label: CODEC_LABEL[codec] || codec || 'desconhecido',
        width: await video.getDisplayWidth(),
        height: await video.getDisplayHeight(),
        hdr: ['hlg', 'pq'].includes(space?.transfer) || space?.primaries === 'bt2020',
        canDecode: 'VideoDecoder' in window ? await video.canDecode().catch(() => false) : false,
      };
    }
    if (audio) {
      info.audio = { codec: await audio.getCodec(), canDecode: 'AudioDecoder' in window ? await audio.canDecode().catch(() => false) : false };
    }
    return info;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    input?.dispose?.();
  }
}

/** Decodifica o áudio do arquivo com WebCodecs (reserva do decodeAudioData). Devolve um AudioBuffer ou null. */
export async function decodeAudioFallback(blob, ctx) {
  if (!('AudioDecoder' in window)) return null;
  const { AudioBufferSink } = await loadMediabunny();
  const input = await openInput(blob);
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const parts = [];
    let rate = 0;
    let channels = 0;
    for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers()) {
      rate ||= buffer.sampleRate;
      channels = Math.max(channels, buffer.numberOfChannels);
      parts.push({ buffer, start: Math.max(0, Math.round(timestamp * buffer.sampleRate)) });
    }
    if (!parts.length) return null;
    const first = parts[0].start;
    const length = Math.max(...parts.map((p) => p.start - first + p.buffer.length));
    const out = (ctx || new OfflineAudioContext(channels, 1, rate)).createBuffer(channels, length, rate);
    for (const { buffer, start } of parts) {
      for (let c = 0; c < channels; c++) {
        out.copyToChannel(buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1)), c, start - first);
      }
    }
    return out;
  } finally {
    input.dispose?.();
  }
}

/** Mensagem amigável quando um vídeo não pode ser aberto. */
export function explainUnplayable(name, info) {
  const v = info?.video;
  if (v?.codec === 'hevc') {
    return (
      `“${name}” está em HEVC (H.265), formato padrão do iPhone, e este navegador não tem decodificador HEVC. ` +
      'Abra no Chrome ou Edge no Windows/Mac (com aceleração de vídeo do computador), no Safari do Mac ou no app Android. ' +
      'No iPhone você também pode gravar em H.264: Ajustes › Câmera › Formatos › “Mais Compatível”.'
    );
  }
  if (v && !v.canDecode) return `“${name}” usa o codec ${v.label}, que este navegador não consegue decodificar.`;
  if (!info?.ok) return `Não foi possível ler “${name}” (arquivo corrompido ou formato não suportado).`;
  return `Não foi possível abrir o vídeo “${name}” neste navegador.`;
}

/**
 * Converte um vídeo que o <video> do navegador não toca, mas que o WebCodecs decodifica
 * (ex.: HEVC/.mov em alguns navegadores), para um MP4 H.264 (ou VP9) tocável.
 */
export async function transcodeForPlayback(blob, { onProgress } = {}) {
  const mb = await loadMediabunny();
  const { Output, Mp4OutputFormat, BufferTarget, Conversion, QUALITY_HIGH, canEncodeVideo } = mb;
  const codec = (await canEncodeVideo('avc').catch(() => false)) ? 'avc' : (await canEncodeVideo('vp9').catch(() => false)) ? 'vp9' : null;
  if (!codec) return null;
  const input = await openInput(blob);
  try {
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const conv = await Conversion.init({ input, output, tracks: 'primary', video: { codec, quality: QUALITY_HIGH, forceTranscode: true, keyFrameInterval: 1 } });
    if (!conv.isValid) return null;
    conv.onProgress = (p) => onProgress?.(p);
    await conv.execute();
    return new Blob([output.target.buffer], { type: 'video/mp4' });
  } finally {
    input.dispose?.();
  }
}
