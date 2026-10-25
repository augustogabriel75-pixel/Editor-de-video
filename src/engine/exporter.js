/**
 * Exportação de vídeo no navegador.
 *
 * Caminho principal (WebCodecs): renderiza a timeline quadro a quadro com timestamps exatos,
 * mixa o áudio offline (OfflineAudioContext) e grava um MP4 com índice/duração corretos
 * (mp4-muxer). Não depende de tempo real, então o arquivo não congela nem pula quadros.
 *
 * Alternativa (MediaRecorder em tempo real) para navegadores sem WebCodecs.
 */
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { useEditorStore } from '../store/useEditorStore';
import { renderFrame } from './renderer';
import { getExportStream, ensureContext, renderMixOffline } from './audioEngine';
import { seekVideoExact, exportSeekStats } from './mediaPool';
import { createFrameDecoder } from './frameDecoder';
import { encodeAacFallback } from './aacFallback';
import { getAspect } from '../lib/catalog';
import { sourceOffsetAt } from '../lib/speedCurves';
import { isActiveAt } from '../lib/utils';
import { encodeWav } from '../lib/audioExport';
import { nativeCanMux, stageBlobNative, muxAacNative, nativeExportUrl } from '../lib/native';

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

const hasWebCodecs = () => typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;

/** Formatos oferecidos na interface. */
export function supportedFormats() {
  const out = [];
  if (hasWebCodecs()) out.push({ id: 'mp4', label: 'MP4 (recomendado)', engine: 'webcodecs', ext: 'mp4' });
  if (typeof MediaRecorder !== 'undefined') {
    const cands = [
      { mime: 'video/webm;codecs=vp9,opus', label: 'WebM (gravação em tempo real)' },
      { mime: 'video/webm', label: 'WebM (gravação em tempo real)' },
      { mime: 'video/mp4', label: 'MP4 (gravação em tempo real)' },
    ];
    const c = cands.find((x) => {
      try {
        return MediaRecorder.isTypeSupported(x.mime);
      } catch {
        return false;
      }
    });
    if (c) out.push({ id: 'realtime', label: c.label, engine: 'mediarecorder', mime: c.mime, ext: c.mime.includes('mp4') ? 'mp4' : 'webm' });
  }
  return out;
}

/* ------------------------------------------------------------------ negociação de codecs */

function avcCandidates(w, h, fps) {
  const mbs = Math.ceil(w / 16) * Math.ceil(h / 16) * fps;
  // nível H.264 pelo número de macroblocos/s
  const level = mbs <= 108000 ? '1f' : mbs <= 245760 ? '28' : mbs <= 522240 ? '2a' : mbs <= 589824 ? '32' : mbs <= 983040 ? '33' : '34';
  return [`avc1.6400${level}`, `avc1.4d00${level}`, `avc1.4200${level}`, 'avc1.640033', 'avc1.640034'];
}

async function pickVideoCodec(w, h, fps, bitrate, avoid = new Set()) {
  const tries = [
    ...avcCandidates(w, h, fps).map((c) => ({ codec: c, mux: 'avc', extra: { avc: { format: 'avc' } } })),
    ...['vp09.00.10.08', 'vp09.00.40.08', 'vp09.00.51.08'].map((c) => ({ codec: c, mux: 'vp9' })),
    ...['av01.0.08M.08', 'av01.0.12M.08'].map((c) => ({ codec: c, mux: 'av1' })),
  ];
  for (const t of tries) {
    if (avoid.has(t.codec)) continue;
    const config = { codec: t.codec, width: w, height: h, bitrate, framerate: fps, ...(t.extra || {}) };
    try {
      const r = await VideoEncoder.isConfigSupported(config);
      if (r.supported) return { config: r.config || config, mux: t.mux };
    } catch {
      /* próximo */
    }
  }
  return null;
}

async function pickAudioCodec(sampleRate, channels) {
  if (!('AudioEncoder' in window)) return null;
  for (const t of [
    { codec: 'mp4a.40.2', mux: 'aac' },
    { codec: 'opus', mux: 'opus' },
  ]) {
    const config = { codec: t.codec, sampleRate, numberOfChannels: channels, bitrate: 192000 };
    try {
      const r = await AudioEncoder.isConfigSupported(config);
      if (r.supported) return { config: r.config || config, mux: t.mux };
    } catch {
      /* próximo */
    }
  }
  return null;
}

/* ------------------------------------------------------------------ preparação de quadros */

/**
 * Garante que os vídeos importados estejam exatamente no quadro do instante t.
 * Com o decodificador direto, preenche `frames` (clipId -> canvas); senão posiciona os <video>.
 */
async function prepareFrame(state, t, fps = 30, decoder = null, frames = null) {
  const assets = new Map(state.assets.map((a) => [a.id, a]));
  const hidden = new Set(state.tracks.filter((x) => x.hidden).map((x) => x.id));
  const jobs = [];
  frames?.clear();
  const want = (clip, at) => {
    const asset = assets.get(clip.assetId);
    if (!asset || asset.type !== 'video' || !asset.src) return;
    const srcTime = clip.trimIn + sourceOffsetAt(clip, Math.max(0, Math.min(clip.duration, at - clip.start)));
    if (decoder) {
      jobs.push(
        decoder.frameFor(clip, asset, srcTime).then((c) => {
          if (c) frames.set(clip.id, c);
          else return seekVideoExact(asset, srcTime, { frameDur: 1 / fps });
        }),
      );
    } else jobs.push(seekVideoExact(asset, srcTime, { frameDur: 1 / fps }));
  };
  for (const clip of state.clips) {
    if (clip.disabled || hidden.has(clip.trackId) || !isActiveAt(clip, t)) continue;
    want(clip, t);
    const tin = clip.transitionIn;
    if (tin && t - clip.start < tin.duration) {
      const prev = state.clips.find((c) => c !== clip && c.trackId === clip.trackId && Math.abs(c.start + c.duration - clip.start) < 0.05);
      if (prev) want(prev, prev.start + prev.duration - 0.001);
    }
  }
  if (jobs.length) await Promise.all(jobs);
}

const nextTick = () => new Promise((r) => setTimeout(r, 0));
if (typeof window !== 'undefined') window.__motioncutSeekStats = exportSeekStats;

/* ------------------------------------------------------------------ WebCodecs */

async function exportWebCodecs({ state, width, height, fps, onProgress, signal, fileName, avoid }) {
  // ~0,1 bit por pixel por quadro, com teto: arquivos gigantes travam no WhatsApp e em celulares mais simples
  const bitrate = Math.min(Math.round(width * height * fps * 0.1), 40_000_000);
  const video = await pickVideoCodec(width, height, fps, bitrate, avoid);
  if (!video) throw new Error('Nenhum codec de vídeo disponível (WebCodecs)');
  avoid?.add(video.config.codec);
  const sampleRate = 48000;
  const audio = await pickAudioCodec(sampleRate, 2);

  onProgress?.(0.01, 'Mixando áudio…');
  let mix = null;
  try {
    mix = await renderMixOffline(state, sampleRate);
  } catch (e) {
    console.warn('mixagem offline falhou', e);
  }
  // Sem AAC no WebCodecs (Firefox, Chromium no Linux, muitos WebViews): AAC embutido (FDK/WASM).
  // Opus dentro de MP4 não é aceito pelo WhatsApp.
  let fdk = null;
  if (mix && audio?.mux !== 'aac' && !window.MOTIONCUT_NO_FDK) {
    try {
      fdk = await encodeAacFallback(mix, { onProgress: (p) => onProgress?.(0.01 + 0.03 * p, 'Codificando áudio AAC…') });
    } catch (e) {
      console.warn('AAC embutido falhou', e);
    }
  }
  // Último recurso no app Android: o próprio aparelho codifica o AAC e monta o MP4.
  const nativeAudio = !!mix && !fdk && nativeCanMux() && (video.mux === 'avc' || window.MOTIONCUT_TEST_NATIVE_MUX) && audio?.mux !== 'aac';
  const mainAudio = !mix ? null : fdk ? 'aac' : audio && !nativeAudio ? audio.mux : null;

  const makeMuxer = (audioCodec) => {
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: video.mux, width, height, frameRate: fps },
      ...(audioCodec ? { audio: { codec: audioCodec, numberOfChannels: 2, sampleRate } } : {}),
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });
    return { target, muxer, audioCodec };
  };
  const main = makeMuxer(mainAudio);
  // reserva com o áudio do navegador, caso a montagem nativa falhe
  const backup = nativeAudio && audio ? makeMuxer(audio.mux) : null;
  const muxers = [main, backup].filter(Boolean);

  let encError = null;
  if (fdk) {
    const dur = Math.round(fdk.frameDuration * 1e6);
    const meta = { decoderConfig: { codec: 'mp4a.40.2', sampleRate: fdk.sampleRate, numberOfChannels: fdk.channels, description: fdk.description } };
    fdk.frames.forEach((d, k) => main.muxer.addAudioChunkRaw(d, 'key', k * dur, dur, k === 0 ? meta : undefined));
  }
  // Áudio pelo WebCodecs
  const audioTargets = muxers.filter((m) => m.audioCodec && !(fdk && m === main));
  if (audio && mix && audioTargets.length) {
    const aenc = new AudioEncoder({ output: (chunk, meta) => audioTargets.forEach((m) => m.muxer.addAudioChunk(chunk, meta)), error: (e) => (encError = e) });
    aenc.configure(audio.config);
    const L = mix.getChannelData(0);
    const R = mix.numberOfChannels > 1 ? mix.getChannelData(1) : L;
    const N = 4800;
    for (let off = 0; off < mix.length; off += N) {
      const n = Math.min(N, mix.length - off);
      const data = new Float32Array(n * 2);
      data.set(L.subarray(off, off + n), 0);
      data.set(R.subarray(off, off + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((off / sampleRate) * 1e6), data });
      aenc.encode(ad);
      ad.close();
      if (aenc.encodeQueueSize > 20) await nextTick();
    }
    await aenc.flush();
    aenc.close();
  }
  if (encError) throw encError;

  // Vídeo
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const venc = new VideoEncoder({ output: (chunk, meta) => muxers.forEach((m) => m.muxer.addVideoChunk(chunk, meta)), error: (e) => (encError = e) });
  venc.configure({ ...video.config, latencyMode: 'quality' });
  const total = Math.max(1, Math.round(state.duration * fps));
  const frameDur = Math.round(1e6 / fps);
  const span = nativeAudio ? 0.88 : 0.93;
  const hasVideo = state.clips.some((c) => c.kind === 'video' && state.assets.find((a) => a.id === c.assetId)?.src);
  const decoder = hasVideo && !window.MOTIONCUT_EXPORT_SEEK ? await createFrameDecoder() : null;
  const frames = new Map();
  if (typeof window !== 'undefined') window.__motioncutDecodeStats = decoder?.stats || null;
  try {
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) {
      venc.close();
      return null;
    }
    if (encError) throw encError;
    const t = i / fps;
    await prepareFrame(state, t, fps, decoder, frames);
    renderFrame(ctx, width, height, state, t, { export: true, playing: false, frames });
    const frame = new VideoFrame(canvas, { timestamp: i * frameDur, duration: frameDur });
    venc.encode(frame, { keyFrame: i % fps === 0 });
    frame.close();
    while (venc.encodeQueueSize > 4) await nextTick();
    if (i % 3 === 0) {
      onProgress?.(0.05 + span * (i / total), `Renderizando quadro ${i + 1}/${total}`);
      await nextTick();
    }
  }
  } finally {
    decoder?.dispose();
  }
  await venc.flush();
  venc.close();
  if (encError) throw encError;
  onProgress?.(0.94, 'Finalizando arquivo…');
  muxers.forEach((m) => m.muxer.finalize());
  const vlabel = video.mux === 'avc' ? 'H.264' : video.mux.toUpperCase();
  const finish = (blob, alabel, extra = {}) => ({
    blob,
    url: URL.createObjectURL(blob),
    width,
    height,
    ext: 'mp4',
    size: blob.size,
    codecs: `${vlabel}${alabel ? ` + ${alabel}` : ''}`,
    whatsapp: video.mux === 'avc' && (!alabel || alabel === 'AAC'),
    ...extra,
  });

  if (nativeAudio && mix) {
    onProgress?.(0.95, 'Montando MP4 com áudio AAC…');
    try {
      const stamp = Date.now();
      const vName = await stageBlobNative(new Blob([main.target.buffer], { type: 'video/mp4' }), `mc-video-${stamp}.mp4`);
      const L = mix.getChannelData(0);
      const R = mix.numberOfChannels > 1 ? mix.getChannelData(1) : L;
      const wName = await stageBlobNative(encodeWav([L, R], sampleRate), `mc-audio-${stamp}.wav`);
      const r = await muxAacNative(vName, wName, fileName || `motioncut-${stamp}.mp4`);
      if (!r.ok) throw new Error(r.error || 'falha ao montar MP4');
      onProgress?.(0.99, 'Preparando pré-visualização…');
      const blob = await (await fetch(nativeExportUrl(r.name))).blob();
      return finish(new Blob([blob], { type: 'video/mp4' }), 'AAC', { nativeName: r.name });
    } catch (e) {
      console.warn('montagem nativa falhou', e);
      if (backup) return finish(new Blob([backup.target.buffer], { type: 'video/mp4' }), audio.mux.toUpperCase(), { warning: `Não foi possível codificar o áudio em AAC (${e.message}).` });
      throw e;
    }
  }
  return finish(new Blob([main.target.buffer], { type: 'video/mp4' }), mainAudio ? mainAudio.toUpperCase() : '');
}

/* ------------------------------------------------------------------ MediaRecorder (tempo real) */

async function exportRealtime({ width, height, fps, format, onProgress, signal }) {
  const store = useEditorStore;
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
  const rec = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: Math.round(width * height * fps * 0.12), audioBitsPerSecond: 192000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  const stopped = new Promise((res) => (rec.onstop = res));
  const s0 = store.getState();
  s0.pause();
  s0.seek(0);
  renderFrame(ctx, width, height, store.getState(), 0, { export: true, playing: false });
  await new Promise((r) => setTimeout(r, 150));
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
      onProgress?.(Math.min(1, st.currentTime / Math.max(0.001, st.duration)), 'Gravando em tempo real…');
      if (!st.isPlaying || st.currentTime >= st.duration - 0.001) return resolve();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  await new Promise((r) => setTimeout(r, 200));
  rec.stop();
  await stopped;
  tracks.forEach((t) => t.kind === 'video' && t.stop());
  if (signal?.aborted) return null;
  const blob = new Blob(chunks, { type: format.mime.split(';')[0] });
  return { blob, url: URL.createObjectURL(blob), width, height, ext: format.ext, size: blob.size, codecs: 'tempo real' };
}

/* ------------------------------------------------------------------ API */

export async function exportVideo({ aspect, short, fps = 30, format, onProgress, signal, fileName }) {
  const store = useEditorStore;
  const { width, height } = frameSize(aspect, short);
  store.getState().pause();
  store.getState().setExporting(true);
  try {
    if (format.engine === 'webcodecs') {
      // Alguns codificadores de hardware dizem aceitar um perfil e falham ao codificar:
      // tenta os próximos perfis H.264 antes de cair na gravação em tempo real (WebM).
      const avoid = new Set();
      let lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await exportWebCodecs({ state: store.getState(), width, height, fps, onProgress, signal, fileName, avoid });
        } catch (e) {
          lastErr = e;
          console.warn('WebCodecs falhou com', [...avoid].pop(), e);
          if (signal?.aborted || /Nenhum codec/.test(String(e?.message))) break;
          onProgress?.(0.01, 'Tentando outro codificador…');
        }
      }
      {
        const e = lastErr;
        console.warn('WebCodecs falhou, usando gravação em tempo real', e);
        const fallback = supportedFormats().find((f) => f.engine === 'mediarecorder');
        if (!fallback) throw e;
        return await exportRealtime({ width, height, fps, format: fallback, onProgress, signal });
      }
    }
    return await exportRealtime({ width, height, fps, format, onProgress, signal });
  } finally {
    store.getState().setExporting(false);
  }
}
