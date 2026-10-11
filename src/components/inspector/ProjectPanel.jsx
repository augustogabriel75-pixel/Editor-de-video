import { Settings2, RectangleHorizontal, Smartphone, Square, RectangleVertical, Info } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { ASPECT_RATIOS } from '../../lib/catalog';
import { formatTime } from '../../lib/utils';
import { Section, Segmented, ColorField, cx } from '../ui/primitives';

const ICON = { '16:9': RectangleHorizontal, '9:16': Smartphone, '1:1': Square, '4:5': RectangleVertical };

export default function ProjectPanel() {
  const project = useEditorStore((s) => s.project);
  const setProject = useEditorStore((s) => s.setProject);
  const setAspect = useEditorStore((s) => s.setAspect);
  const duration = useEditorStore((s) => s.duration);
  const clips = useEditorStore((s) => s.clips);
  const ai = clips.filter((c) => c.ai && c.kind === 'motion').length;
  return (
    <>
      <div className="px-4 py-3 border-b border-ink-700">
        <div className="text-[13px] font-bold text-white">Projeto</div>
        <div className="text-[11px] text-ink-400">Nenhum clipe selecionado — clique em um clipe na timeline ou no preview.</div>
      </div>
      <Section title="Proporção" icon={Settings2}>
        <div className="grid grid-cols-4 gap-1.5">
          {ASPECT_RATIOS.map((a) => {
            const I = ICON[a.id];
            return (
              <button
                type="button"
                key={a.id}
                onClick={() => setAspect(a.id)}
                className={cx('rounded-lg border py-2 flex flex-col items-center gap-1', project.aspect === a.id ? 'border-brand bg-brand/10 text-white' : 'border-ink-700 text-ink-300 hover:border-ink-500')}
              >
                <I size={16} />
                <span className="text-[11px] font-semibold">{a.label}</span>
                <span className="text-[9px] text-ink-400">{a.hint}</span>
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="Fundo do quadro" icon={Settings2}>
        <Segmented
          size="sm"
          value={project.background.mode}
          onChange={(mode) => setProject({ background: { ...project.background, mode } })}
          options={[
            { id: 'blur', label: 'Desfoque' },
            { id: 'color', label: 'Cor sólida' },
          ]}
        />
        <ColorField label="Cor" value={project.background.color} onChange={(color) => setProject({ background: { ...project.background, color } }, 'bgcolor')} />
      </Section>
      <Section title="Resumo" icon={Info}>
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          {[
            ['Duração', formatTime(duration)],
            ['Clipes', clips.length],
            ['Motions IA', ai],
            ['Legendas', clips.filter((c) => c.kind === 'caption').length],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-ink-900 border border-ink-700 px-2.5 py-2">
              <dt className="text-ink-400">{k}</dt>
              <dd className="text-white font-semibold font-mono">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
