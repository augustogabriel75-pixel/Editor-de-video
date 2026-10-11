import { useState } from 'react';
import { Clapperboard, Ban } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { ANIMATIONS } from '../../lib/catalog';
import { Section, Segmented, Slider, cx } from '../ui/primitives';

export default function AnimationPanel({ clip }) {
  const setAnim = useEditorStore((s) => s.setAnimation);
  const updateClip = useEditorStore((s) => s.updateClip);
  const [slot, setSlot] = useState('in');
  const isText = clip.kind === 'text' || clip.kind === 'caption';
  const current = clip.animation?.[slot];
  const list = ANIMATIONS[slot].filter((a) => !a.textOnly || isText);
  return (
    <Section title="Animações" icon={Clapperboard}>
      <Segmented
        value={slot}
        onChange={setSlot}
        options={[
          { id: 'in', label: `Entrada${clip.animation?.in ? ' •' : ''}` },
          { id: 'out', label: `Saída${clip.animation?.out ? ' •' : ''}` },
          { id: 'loop', label: `Loop${clip.animation?.loop ? ' •' : ''}` },
        ]}
      />
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => setAnim(clip.id, slot, null)}
          className={cx('h-14 rounded-lg border flex flex-col items-center justify-center gap-1 text-[10px]', !current ? 'border-brand bg-brand/10 text-white' : 'border-ink-700 bg-ink-900 text-ink-300 hover:border-ink-500')}
        >
          <Ban size={15} /> Nenhuma
        </button>
        {list.map((a) => (
          <button
            type="button"
            key={a.id}
            onClick={() => setAnim(clip.id, slot, a.id)}
            className={cx(
              'group h-14 rounded-lg border flex flex-col items-center justify-center gap-1 text-[10px]',
              current?.id === a.id ? 'border-brand bg-brand/10 text-white' : 'border-ink-700 bg-ink-900 text-ink-300 hover:border-ink-500',
            )}
          >
            <span className="w-6 h-4 rounded-sm bg-gradient-to-br from-brand to-ai group-hover:animate-float" />
            {a.name}
          </button>
        ))}
      </div>
      {current && slot !== 'loop' && (
        <Slider
          label="Duração"
          value={current.duration}
          min={0.1}
          max={Math.max(0.2, Math.min(3, clip.duration))}
          step={0.05}
          suffix="s"
          format={(v) => v.toFixed(2)}
          onChange={(v) => updateClip(clip.id, (c) => ({ animation: { ...c.animation, [slot]: { ...c.animation[slot], duration: v } } }), `anim:${clip.id}:${slot}`)}
        />
      )}
    </Section>
  );
}
