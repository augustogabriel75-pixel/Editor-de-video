import { useMemo, useRef, useState } from 'react';
import { Upload, Plus, Film, Image as ImageIcon, LoaderCircle } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { importFiles } from '../../lib/importer';
import { mediaKind, IMPORT_ACCEPT } from '../../lib/mediaTypes';
import { formatTime } from '../../lib/utils';
import { cx } from '../ui/primitives';
import { SearchBox, Chips, PanelHeader, ASSET_MIME } from './shared';

const CATS = ['Todos', 'Importado', 'Demo', 'B-roll', 'Green Screen', 'Fundos'];

export function AssetCard({ asset, onAdd }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ASSET_MIME, asset.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className="group relative rounded-lg overflow-hidden bg-ink-800 border border-ink-700 hover:border-brand/60 cursor-grab active:cursor-grabbing"
    >
      <div className="aspect-video bg-ink-900 checker">
        {asset.thumb ? (
          <img src={asset.thumb} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-400">{asset.type === 'image' ? <ImageIcon size={20} /> : <Film size={20} />}</div>
        )}
      </div>
      <span className="absolute top-1.5 left-1.5 px-1.5 py-px rounded bg-black/70 text-[10px] font-mono text-white">{asset.type === 'image' ? 'IMG' : formatTime(asset.duration, false)}</span>
      {asset.category === 'Green Screen' && <span className="absolute top-1.5 right-1.5 px-1.5 py-px rounded bg-emerald-500/90 text-[9px] font-bold text-white">CHROMA</span>}
      <button
        type="button"
        onClick={() => onAdd(asset.id)}
        title="Adicionar à timeline"
        className="absolute right-1.5 bottom-8 w-7 h-7 rounded-full bg-brand text-ink-950 flex items-center justify-center opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 shadow-lg transition-opacity"
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
      <div className="px-2 py-1.5 text-[11px] text-ink-100 truncate">{asset.name}</div>
    </div>
  );
}

export default function MediaTab() {
  const assets = useEditorStore((s) => s.assets);
  const addAssets = useEditorStore((s) => s.addAssets);
  const addToTimeline = useEditorStore((s) => s.addAssetToTimeline);
  const toast = useEditorStore((s) => s.toast);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todos');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const fileRef = useRef(null);

  const list = useMemo(() => {
    const visual = assets.filter((a) => a.type === 'video' || a.type === 'image');
    return visual.filter((a) => {
      if (cat === 'Importado' && !a.imported) return false;
      if (cat === 'Demo' && a.category !== 'Demo') return false;
      if (!['Todos', 'Importado', 'Demo'].includes(cat) && a.category !== cat) return false;
      return !q || a.name.toLowerCase().includes(q.toLowerCase());
    });
  }, [assets, q, cat]);

  const onFiles = async (files) => {
    const arr = [...files];
    if (!arr.length) return;
    if (!arr.some(mediaKind)) return toast('Formato não suportado. Use vídeos (MP4, MOV do iPhone, WebM…), imagens ou áudios.', 'warn');
    setBusy(true);
    try {
      const imported = await importFiles(arr, { onStatus: setBusy });
      addAssets(imported);
      if (imported.length) toast(`${imported.length} arquivo(s) importado(s) — arraste para a timeline`, 'success');
      for (const err of imported.errors) toast(err, 'error');
      if (imported.length) setCat('Importado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cx('min-h-full', over && 'bg-brand/5 outline outline-2 -outline-offset-4 outline-dashed outline-brand/60')}
    >
      <PanelHeader title="Mídia" subtitle="Importe vídeos, fotos e áudios ou use a biblioteca demo.">
        <input ref={fileRef} type="file" multiple accept={IMPORT_ACCEPT} className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-ink-500 hover:border-brand hover:bg-brand/5 py-4 text-[12px] text-ink-200 transition-colors"
        >
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
          {busy ? (typeof busy === 'string' ? busy : 'Processando arquivos…') : 'Importar mídia  ·  ou arraste arquivos aqui'}
        </button>
        <SearchBox value={q} onChange={setQ} placeholder="Buscar mídia" />
        <Chips options={CATS} value={cat} onChange={setCat} />
      </PanelHeader>
      <div className="px-4 pb-6 grid grid-cols-2 gap-2.5">
        {list.map((a) => (
          <AssetCard key={a.id} asset={a} onAdd={addToTimeline} />
        ))}
        {!list.length && <div className="col-span-2 text-center text-[12px] text-ink-400 py-8">Nenhuma mídia nesta categoria.</div>}
      </div>
    </div>
  );
}
