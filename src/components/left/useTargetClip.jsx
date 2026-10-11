import { useEditorStore } from '../../store/useEditorStore';
import { isActiveAt } from '../../lib/utils';

/** Clipe visual alvo das bibliotecas: o selecionado, ou o da trilha principal sob o playhead. */
export function useTargetClip() {
  const id = useEditorStore((s) => {
    const sel = s.clips.find((c) => c.id === s.selectedClipId);
    if (sel && (sel.kind === 'video' || sel.kind === 'image')) return sel.id;
    return s.clips.find((c) => c.trackId === 'trk-main' && isActiveAt(c, s.currentTime))?.id ?? null;
  });
  return useEditorStore((s) => (id ? s.clips.find((c) => c.id === id) : null));
}

export function TargetHint({ clip, what = 'efeito' }) {
  return (
    <div className="text-[11px] rounded-lg px-3 py-2 bg-ink-900 border border-ink-700 text-ink-300">
      {clip ? (
        <>
          Aplicando {what} em <span className="text-white font-medium">{clip.name}</span>
        </>
      ) : (
        <>Selecione um clipe de vídeo/imagem na timeline.</>
      )}
    </div>
  );
}
