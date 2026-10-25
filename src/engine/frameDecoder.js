/**
 * Decodificação exata de quadros para a exportação (WebCodecs VideoDecoder via Mediabunny).
 *
 * Em vez de posicionar um <video> com `currentTime` a cada quadro (cada navegador arredonda e
 * apresenta o quadro de um jeito: Firefox, Chrome e o WebView do Android se comportam diferente
 * e geravam quadros repetidos/pulados), lê o arquivo e decodifica os quadros em ordem.
 * Cada pacote é decodificado uma vez só, então também é bem mais rápido que o seek.
 *
 * Se o arquivo ou o codec não puder ser lido assim, devolve null e o exportador usa o seek.
 */
let mbPromise = null;
const loadMediabunny = () => (mbPromise ??= import('mediabunny'));

// mira um pouco depois do início do quadro: os timestamps da fonte são arredondados (WebM usa 1 ms)
const EPS = 0.004;

/**
 * Lê os quadros de um clipe em ordem (VideoSampleSink.samples) e mantém o quadro "atual":
 * o último com início <= t. Desenha-o num canvas próprio do clipe (aplicando rotação/flip).
 */
function makeFeeder(sink) {
  let it = null;
  let cur = null;
  let nxt = null;
  let ended = false;
  let drawn = null;
  let last = -Infinity;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const pull = async () => {
    if (ended) return null;
    const r = await it.next();
    if (r.done) {
      ended = true;
      return null;
    }
    return r.value;
  };
  return {
    last: () => last,
    async get(t) {
      last = t;
      if (!it) {
        it = sink.samples(t);
        cur = await pull();
        nxt = cur ? await pull() : null;
      }
      while (nxt && nxt.timestamp <= t + 1e-9) {
        cur?.close();
        cur = nxt;
        nxt = await pull();
      }
      if (!cur) return null;
      if (drawn !== cur) {
        const w = cur.displayWidth;
        const h = cur.displayHeight;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        cur.drawWithFit(ctx, { fit: 'fill' });
        drawn = cur;
      }
      return canvas;
    },
    close() {
      cur?.close();
      nxt?.close();
      cur = nxt = null;
      it?.return?.().catch(() => {});
    },
  };
}

export async function createFrameDecoder() {
  if (typeof window === 'undefined' || !('VideoDecoder' in window)) return null;
  let mb;
  try {
    mb = await loadMediabunny();
  } catch (e) {
    console.warn('mediabunny indisponível', e);
    return null;
  }
  const { Input, BlobSource, ALL_FORMATS, VideoSampleSink } = mb;
  const tracks = new Map(); // assetId -> Promise<{track, firstTs} | null>
  const feeders = new Map(); // clipId -> feeder
  const inputs = [];
  const stats = { decoded: 0, fallback: 0 };

  const openAsset = (asset) => {
    if (!tracks.has(asset.id)) {
      tracks.set(
        asset.id,
        (async () => {
          try {
            const blob = await (await fetch(asset.src)).blob();
            const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
            inputs.push(input);
            const track = await input.getPrimaryVideoTrack();
            if (!track || !(await track.canDecode())) return null;
            const firstTs = await track.getFirstTimestamp();
            return { track, firstTs: Number.isFinite(firstTs) ? firstTs : 0 };
          } catch (e) {
            console.warn('decodificação direta indisponível para', asset.name, e);
            return null;
          }
        })(),
      );
    }
    return tracks.get(asset.id);
  };

  return {
    stats,
    /** Canvas com o quadro do clipe no tempo de fonte `srcTime` (s), ou null para usar o seek. */
    async frameFor(clip, asset, srcTime) {
      const info = await openAsset(asset);
      if (!info) {
        stats.fallback++;
        return null;
      }
      const t = Math.max(0, srcTime) + info.firstTs + EPS;
      let f = feeders.get(clip.id);
      if (f && t < f.last() - 1e-6) {
        f.close();
        f = null;
      }
      if (!f) {
        f = makeFeeder(new VideoSampleSink(info.track));
        feeders.set(clip.id, f);
      }
      try {
        const c = await f.get(t);
        if (c) stats.decoded++;
        else stats.fallback++;
        return c;
      } catch (e) {
        console.warn('falha ao decodificar quadro', e);
        f.close();
        feeders.delete(clip.id);
        tracks.set(asset.id, Promise.resolve(null));
        stats.fallback++;
        return null;
      }
    },
    dispose() {
      for (const f of feeders.values()) f.close();
      feeders.clear();
      for (const i of inputs) {
        try {
          i.dispose?.();
        } catch {
          /* ignore */
        }
      }
    },
  };
}
