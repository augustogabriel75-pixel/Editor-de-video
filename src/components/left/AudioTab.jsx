import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, Plus, Music, Mic, Zap } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { previewAsset, stopPreview } from '../../engine/audioEngine';
import { getAssetPeaks } from '../../lib/peaks';
import { formatTime } from '../../lib/utils';
import { SearchBox, Chips, PanelHeader, ASSET_MIME } from './shared';

const CATS = ['Música', 'Efeitos Sonoros', 'Voz', 'Importado'];

function MiniWave({ asset, color = '#22d3ee' }) {
  const ref = useRef(null);
  const peaks = useMemo(() => getAssetPeaks(asset), [asset]);
  useEffect(() => {
    const c = ref.current;
    if (!c || !peaks) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth * dpr;
    const h = c.clientHeight * dpr;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    const n = Math.floor(w / (3 * dpr));
    for (let i = 0; i < n; i++) {
      const v = peaks.data[Math.floor((i / n) * peaks.data.length)] || 0;
      const bh = Math.max(dpr, v * h * 0.9);
      ctx.fillRect(i * 3 * dpr, (h - bh) / 2, 2 * dpr, bh);
    }
  }, [peaks, color]);
  return <canvas ref={ref} className="w-full h-5 opacity-70" />;
}

export default function AudioTab() {
  const assets = useEditorStore((s) => s.assets);
  const add = useEditorStore((s) => s.addAssetToTimeline);
  const [cat, setCat] = useState('Música');
  const [q, setQ] = useState('');
  const [playing, setPlaying] = useState(null);

  useEffect(() => () => stopPreview(), []);

  const list = useMemo(
    () =>
      assets.filter((a) => {
        if (a.type !== 'audio' && !(cat === 'Importado' && a.type === 'video' && a.hasAudio)) return false;
        if (cat === 'Importado' ? !a.imported : a.category !== cat || a.imported) return false;
        return !q || a.name.toLowerCase().includes(q.toLowerCase());
      }),
    [assets, cat, q],
  );

  const toggle = async (asset) => {
    if (playing === asset.id) {
      stopPreview();
      setPlaying(null);
      return;
    }
    if (asset.voiceOnly) return;
    setPlaying(asset.id);
    await previewAsset(asset, () => setPlaying((p) => (p === asset.id ? null : p)));
  };

  return (
    <div>
      <PanelHeader title="Áudio" subtitle="Músicas e efeitos sonoros livres de direitos, gerados no navegador.">
        <SearchBox value={q} onChange={setQ} placeholder="Buscar músicas e efeitos" />
        <Chips options={CATS} value={cat} onChange={setCat} />
      </PanelHeader>
      <div className="px-3 pb-6 space-y-1">
        {list.map((a) => {
          const Icon = a.category === 'Voz' ? Mic : a.category === 'Efeitos Sonoros' ? Zap : Music;
          const [c1, c2] = a.colors || ['#22d3ee', '#a855f7'];
          return (
            <div
              key={a.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(ASSET_MIME, a.id)}
              className="group flex items-center gap-3 p-2 rounded-lg hover:bg-ink-750 cursor-grab"
            >
              <button
                type="button"
                onClick={() => toggle(a)}
                title={a.voiceOnly ? 'Narração demo (voz sintetizada durante a reprodução)' : 'Pré-escutar'}
                className="relative w-11 h-11 shrink-0 rounded-lg flex items-center justify-center text-white"
                style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
              >
                {playing === a.id ? <Square size={14} fill="currentColor" /> : a.voiceOnly ? <Icon size={16} /> : <Play size={15} fill="currentColor" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-ink-100 truncate font-medium">{a.name}</div>
                <div className="text-[10px] text-ink-400 flex gap-1.5">
                  <span className="font-mono">{formatTime(a.duration, false)}</span>
                  {a.bpm && <span>· {a.bpm} BPM</span>}
                  {a.mood && <span>· {a.mood}</span>}
                  {a.transcript && <span>· com transcrição</span>}
                </div>
                <MiniWave asset={a} color={c1} />
              </div>
              <button
                type="button"
                onClick={() => add(a.id)}
                title="Adicionar à timeline"
                className="w-7 h-7 shrink-0 rounded-full bg-ink-600 hover:bg-brand hover:text-ink-950 flex items-center justify-center opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition"
              >
                <Plus size={15} />
              </button>
            </div>
          );
        })}
        {!list.length && <div className="text-center text-[12px] text-ink-400 py-8">Nada por aqui. Importe áudios na aba Mídia.</div>}
      </div>
    </div>
  );
}
