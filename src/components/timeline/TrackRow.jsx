import { memo, useState } from 'react';
import { Lock, Unlock, Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../store/useEditorStore';
import { accepts, clipKindForAsset } from '../../lib/clipFactory';
import { TRACK_ICONS } from '../ui/icons';
import { cx } from '../ui/primitives';
import { ASSET_MIME } from '../left/shared';
import ClipView from './ClipView';
import { HEADER_W } from './constants';

const PLACEHOLDER = {
  'trk-pip': 'Arraste mídia aqui para Picture-in-Picture',
  'trk-captions': 'Auto-Legendas aparecem aqui',
  'trk-text': 'Textos e títulos',
  'trk-ai-sticker': '✨ Stickers e gráficos contextuais gerados pela IA',
  'trk-ai-typo': '✨ Typography Motion com destaques',
  'trk-ai-camera': '✨ Zooms de câmera e transições na batida',
  'trk-sfx': 'Efeitos sonoros',
};

function TrackHeader({ track }) {
  const toggle = useEditorStore((s) => s.toggleTrack);
  const Icon = TRACK_ICONS[track.kind];
  const visual = track.kind !== 'audio';
  const audible = track.kind === 'audio' || track.kind === 'video';
  return (
    <div
      className={cx('sticky left-0 z-20 shrink-0 flex items-center gap-1.5 pl-2 pr-1 border-r border-ink-700', track.ai ? 'bg-[#16122a]' : 'bg-ink-850')}
      style={{ width: HEADER_W }}
    >
      <span className={cx('w-5 h-5 rounded flex items-center justify-center shrink-0', track.ai ? 'ai-gradient' : track.main ? 'bg-sky-500/25 text-sky-300' : 'bg-ink-700 text-ink-300')}>
        <Icon size={11} />
      </span>
      <span className={cx('flex-1 min-w-0 truncate text-[11px]', track.ai ? 'text-ai-soft font-semibold' : 'text-ink-200', track.main && 'font-semibold text-white')}>{track.name}</span>
      {visual && (
        <button type="button" title={track.hidden ? 'Mostrar trilha' : 'Ocultar trilha'} onClick={() => toggle(track.id, 'hidden')} className="p-1 rounded text-ink-400 hover:text-white hover:bg-ink-700">
          {track.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      )}
      {audible && (
        <button type="button" title={track.muted ? 'Ativar som' : 'Silenciar trilha'} onClick={() => toggle(track.id, 'muted')} className={cx('p-1 rounded hover:bg-ink-700', track.muted ? 'text-red-300' : 'text-ink-400 hover:text-white')}>
          {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
      )}
      <button type="button" title={track.locked ? 'Desbloquear' : 'Bloquear'} onClick={() => toggle(track.id, 'locked')} className={cx('p-1 rounded hover:bg-ink-700', track.locked ? 'text-amber-300' : 'text-ink-400 hover:text-white')}>
        {track.locked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>
    </div>
  );
}

function TrackRow({ track }) {
  const clips = useEditorStore(useShallow((s) => s.clips.filter((c) => c.trackId === track.id)));
  const select = useEditorStore((s) => s.select);
  const [over, setOver] = useState(false);

  const onDrop = (e) => {
    const id = e.dataTransfer.getData(ASSET_MIME);
    setOver(false);
    if (!id) return;
    e.preventDefault();
    const st = useEditorStore.getState();
    const asset = st.assets.find((a) => a.id === id);
    if (!asset || !accepts(track, clipKindForAsset(asset))) {
      st.toast(`“${track.name}” não aceita esse tipo de mídia`, 'warn');
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    st.addAssetToTimeline(id, { trackId: track.id, start: Math.max(0, (e.clientX - r.left) / st.pxPerSec) });
  };

  return (
    <div className={cx('flex border-b border-ink-800/80', track.hidden && 'opacity-50')} style={{ height: track.height }}>
      <TrackHeader track={track} />
      <div
        data-track-id={track.id}
        className={cx('relative flex-1', track.ai ? 'bg-ai/[0.04]' : track.main ? 'bg-sky-500/[0.04]' : '', over && 'bg-brand/10 outline outline-1 outline-brand/60 -outline-offset-1')}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) select(null);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(ASSET_MIME)) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        {!clips.length && PLACEHOLDER[track.id] && <div className="absolute inset-0 flex items-center pl-3 text-[10.5px] text-ink-500 pointer-events-none">{PLACEHOLDER[track.id]}</div>}
        {clips.map((c) => (
          <ClipView key={c.id} clip={c} track={track} height={track.height} />
        ))}
      </div>
    </div>
  );
}

export default memo(TrackRow);
