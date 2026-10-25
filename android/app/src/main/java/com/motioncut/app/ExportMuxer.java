package com.motioncut.app;

import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.List;

/**
 * Monta o MP4 final "padrão Android" (o mesmo formato da câmera do celular, aceito pelo WhatsApp):
 * copia a trilha de vídeo H.264 gerada pelo WebView e codifica o áudio (WAV PCM 16 bits) em AAC-LC
 * com o MediaCodec do aparelho. Usado quando o WebView não tem codificador AAC (WebCodecs).
 */
final class ExportMuxer {
    private ExportMuxer() {}

    private static final class Sample {
        final byte[] data;
        final long pts;
        final int flags;

        Sample(byte[] data, long pts, int flags) {
            this.data = data;
            this.pts = pts;
            this.flags = flags;
        }
    }

    private static final class Wav {
        int channels;
        int sampleRate;
        int bits;
        long dataOffset;
        long dataSize;
    }

    static void mux(File video, File wav, File out) throws Exception {
        List<Sample> audio = new ArrayList<Sample>();
        MediaFormat audioFormat = wav != null && wav.length() > 44 ? encodeAac(wav, audio) : null;

        MediaExtractor ex = new MediaExtractor();
        MediaMuxer mux = null;
        try {
            ex.setDataSource(video.getAbsolutePath());
            int vIndex = -1;
            for (int i = 0; i < ex.getTrackCount(); i++) {
                String mime = ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("video/")) {
                    vIndex = i;
                    break;
                }
            }
            if (vIndex < 0) throw new IOException("vídeo sem trilha de imagem");
            MediaFormat vf = ex.getTrackFormat(vIndex);
            ex.selectTrack(vIndex);

            if (out.exists()) out.delete();
            mux = new MediaMuxer(out.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            int vTrack = mux.addTrack(vf);
            int aTrack = audioFormat != null ? mux.addTrack(audioFormat) : -1;
            mux.start();

            int cap = vf.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE) ? vf.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE) : 0;
            ByteBuffer buf = ByteBuffer.allocateDirect(Math.max(cap, 8 * 1024 * 1024));
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            int ai = 0;
            boolean videoDone = false;
            long vPts = 0;
            int vSize = -1;
            int vFlags = 0;
            while (true) {
                if (!videoDone && vSize < 0) {
                    buf.clear();
                    vSize = ex.readSampleData(buf, 0);
                    if (vSize < 0) {
                        videoDone = true;
                    } else {
                        vPts = ex.getSampleTime();
                        vFlags = (ex.getSampleFlags() & MediaExtractor.SAMPLE_FLAG_SYNC) != 0 ? MediaCodec.BUFFER_FLAG_KEY_FRAME : 0;
                    }
                }
                boolean haveAudio = aTrack >= 0 && ai < audio.size();
                if (videoDone && !haveAudio) break;
                // intercala vídeo e áudio pela ordem de tempo
                if (!videoDone && (!haveAudio || vPts <= audio.get(ai).pts)) {
                    info.set(0, vSize, vPts, vFlags);
                    buf.position(0);
                    buf.limit(vSize);
                    mux.writeSampleData(vTrack, buf, info);
                    ex.advance();
                    vSize = -1;
                } else {
                    Sample s = audio.get(ai++);
                    ByteBuffer ab = ByteBuffer.wrap(s.data);
                    info.set(0, s.data.length, s.pts, s.flags);
                    mux.writeSampleData(aTrack, ab, info);
                }
            }
            mux.stop();
        } finally {
            ex.release();
            if (mux != null) {
                try {
                    mux.release();
                } catch (Exception ignored) {
                    // já liberado
                }
            }
        }
    }

    private static Wav readWavHeader(InputStream in) throws IOException {
        byte[] head = new byte[12];
        readFully(in, head);
        if (head[0] != 'R' || head[1] != 'I' || head[2] != 'F' || head[3] != 'F' || head[8] != 'W' || head[9] != 'A') throw new IOException("WAV inválido");
        Wav w = new Wav();
        long pos = 12;
        byte[] ch = new byte[8];
        while (true) {
            readFully(in, ch);
            pos += 8;
            String id = new String(ch, 0, 4, "US-ASCII");
            long size = ByteBuffer.wrap(ch, 4, 4).order(ByteOrder.LITTLE_ENDIAN).getInt() & 0xffffffffL;
            if ("fmt ".equals(id)) {
                byte[] f = new byte[(int) size];
                readFully(in, f);
                pos += size;
                ByteBuffer b = ByteBuffer.wrap(f).order(ByteOrder.LITTLE_ENDIAN);
                b.getShort();
                w.channels = b.getShort();
                w.sampleRate = b.getInt();
                b.getInt();
                b.getShort();
                w.bits = b.getShort();
            } else if ("data".equals(id)) {
                w.dataOffset = pos;
                w.dataSize = size;
                return w;
            } else {
                skipFully(in, size);
                pos += size;
            }
        }
    }

    /** Codifica o WAV em AAC-LC e devolve o formato de saída (com csd-0) para o MediaMuxer. */
    private static MediaFormat encodeAac(File wavFile, List<Sample> out) throws Exception {
        InputStream in = new FileInputStream(wavFile);
        MediaCodec enc = null;
        try {
            Wav w = readWavHeader(in);
            if (w.bits != 16 || w.channels < 1 || w.channels > 2) throw new IOException("WAV não suportado");
            MediaFormat f = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, w.sampleRate, w.channels);
            f.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
            f.setInteger(MediaFormat.KEY_BIT_RATE, w.channels == 2 ? 192000 : 128000);
            f.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 64 * 1024);
            enc = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
            enc.configure(f, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            enc.start();

            int frameBytes = 2 * w.channels;
            long remaining = w.dataSize;
            long framesFed = 0;
            boolean inputDone = false;
            MediaFormat outFormat = null;
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            byte[] tmp = new byte[64 * 1024];
            while (true) {
                if (!inputDone) {
                    int idx = enc.dequeueInputBuffer(10000);
                    if (idx >= 0) {
                        ByteBuffer ib = enc.getInputBuffer(idx);
                        ib.clear();
                        int want = (int) Math.min(Math.min(ib.capacity(), tmp.length), remaining);
                        want -= want % frameBytes;
                        int n = want > 0 ? readUpTo(in, tmp, want) : 0;
                        n -= n % frameBytes;
                        long pts = framesFed * 1000000L / w.sampleRate;
                        if (n <= 0) {
                            enc.queueInputBuffer(idx, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputDone = true;
                        } else {
                            ib.put(tmp, 0, n);
                            enc.queueInputBuffer(idx, 0, n, pts, 0);
                            framesFed += n / frameBytes;
                            remaining -= n;
                        }
                    }
                }
                int o = enc.dequeueOutputBuffer(info, 10000);
                if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    outFormat = enc.getOutputFormat();
                } else if (o >= 0) {
                    ByteBuffer ob = enc.getOutputBuffer(o);
                    if ((info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0 && info.size > 0 && ob != null) {
                        byte[] d = new byte[info.size];
                        ob.position(info.offset);
                        ob.limit(info.offset + info.size);
                        ob.get(d);
                        out.add(new Sample(d, info.presentationTimeUs, 0));
                    }
                    enc.releaseOutputBuffer(o, false);
                    if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) break;
                }
            }
            if (outFormat == null) throw new IOException("codificador AAC sem formato");
            return outFormat;
        } finally {
            in.close();
            if (enc != null) {
                try {
                    enc.stop();
                } catch (Exception ignored) {
                    // já parado
                }
                enc.release();
            }
        }
    }

    private static void readFully(InputStream in, byte[] b) throws IOException {
        int off = 0;
        while (off < b.length) {
            int n = in.read(b, off, b.length - off);
            if (n < 0) throw new IOException("fim inesperado do arquivo");
            off += n;
        }
    }

    private static int readUpTo(InputStream in, byte[] b, int len) throws IOException {
        int off = 0;
        while (off < len) {
            int n = in.read(b, off, len - off);
            if (n < 0) break;
            off += n;
        }
        return off;
    }

    private static void skipFully(InputStream in, long n) throws IOException {
        while (n > 0) {
            long s = in.skip(n);
            if (s <= 0) {
                if (in.read() < 0) throw new IOException("fim inesperado do arquivo");
                s = 1;
            }
            n -= s;
        }
    }
}
