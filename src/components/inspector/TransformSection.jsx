import { Diamond, ChevronLeft, ChevronRight, Move } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { getTransformAt, keyframeAt } from '../../lib/keyframes';
import { Section, Slider, IconButton, cx } from '../ui/primitives';

export default function TransformSection({ clip, title = 'Transformação' }) {
  const hasKf = (clip.keyframes?.length || 0) > 0;
  // Sem keyframes só precisamos saber se o playhead está dentro do clipe (evita re-render a cada quadro).
  const now = useEditorStore((s) =>
    hasKf ? s.currentTime : s.currentTime >= clip.start && s.currentTime <= clip.start + clip.duration ? clip.start + 0.001 : clip.start - 1,
  );
  const set = useEditorStore((s) => s.setTransformProp);
  const addKf = useEditorStore((s) => s.addKeyframe);
  const seek = useEditorStore((s) => s.seek);
  const lt = now - clip.start;
  const inside = lt >= 0 && lt <= clip.duration;
  const tr = hasKf ? getTransformAt(clip, lt) : clip.transform;
  const atKf = hasKf && keyframeAt(clip, lt);
  const kfs = clip.keyframes || [];
  const prev = [...kfs].reverse().find((k) => k.t < lt - 0.01);
  const next = kfs.find((k) => k.t > lt + 0.01);
  const key = (p) => `tr:${clip.id}:${p}`;

  return (
    <Section
      title={title}
      icon={Move}
      right={
        <div className="flex items-center gap-0.5">
          <IconButton icon={ChevronLeft} size={13} label="Keyframe anterior" disabled={!prev} onClick={() => prev && seek(clip.start + prev.t)} />
          <button
            type="button"
            title={inside ? (atKf ? 'Remover keyframe' : 'Adicionar keyframe no playhead') : 'Posicione o playhead dentro do clipe'}
            onClick={addKf}
            disabled={!inside}
            className={cx('p-1.5 rounded-md disabled:opacity-30', atKf ? 'text-brand' : 'text-ink-300 hover:text-white hover:bg-ink-700')}
          >
            <Diamond size={14} fill={atKf ? 'currentColor' : 'none'} />
          </button>
          <IconButton icon={ChevronRight} size={13} label="Próximo keyframe" disabled={!next} onClick={() => next && seek(clip.start + next.t)} />
        </div>
      }
    >
      {hasKf && (
        <div className="text-[10.5px] text-brand/90 bg-brand/10 border border-brand/20 rounded-md px-2 py-1">
          {kfs.length} keyframe(s) · editar valores cria/atualiza keyframe no playhead
        </div>
      )}
      <Slider label="Escala" value={Math.round(tr.scale * 100)} min={5} max={400} suffix="%" onChange={(v) => set(clip.id, 'scale', v / 100, key('scale'))} onReset={() => set(clip.id, 'scale', clip.kind === 'video' || clip.kind === 'image' ? 1 : 1)} />
      <div className="grid grid-cols-2 gap-3">
        <Slider label="Posição X" value={Math.round(tr.x * 100)} min={-100} max={100} onChange={(v) => set(clip.id, 'x', v / 100, key('x'))} onReset={() => set(clip.id, 'x', 0)} />
        <Slider label="Posição Y" value={Math.round(tr.y * 100)} min={-100} max={100} onChange={(v) => set(clip.id, 'y', v / 100, key('y'))} onReset={() => set(clip.id, 'y', 0)} />
      </div>
      <Slider label="Rotação" value={Math.round(tr.rotation || 0)} min={-180} max={180} suffix="°" onChange={(v) => set(clip.id, 'rotation', v, key('rot'))} onReset={() => set(clip.id, 'rotation', 0)} />
      <Slider label="Opacidade" value={Math.round((tr.opacity ?? 1) * 100)} min={0} max={100} suffix="%" onChange={(v) => set(clip.id, 'opacity', v / 100, key('op'))} />
    </Section>
  );
}
