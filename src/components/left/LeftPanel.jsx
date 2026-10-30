import { Film, Music, Type, Zap, Shuffle, Palette, WandSparkles, Aperture } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { cx } from '../ui/primitives';
import MediaTab from './MediaTab';
import AudioTab from './AudioTab';
import TextTab from './TextTab';
import EffectsTab from './EffectsTab';
import TransitionsTab from './TransitionsTab';
import FiltersTab from './FiltersTab';
import AIMotionTab from './AIMotionTab';
import LutTab from './LutTab';

export const PANEL_TABS = [
  { id: 'media', label: 'Mídia', icon: Film, el: MediaTab },
  { id: 'audio', label: 'Áudio', icon: Music, el: AudioTab },
  { id: 'text', label: 'Texto', icon: Type, el: TextTab },
  { id: 'effects', label: 'Efeitos', icon: Zap, el: EffectsTab },
  { id: 'transitions', label: 'Transições', icon: Shuffle, el: TransitionsTab },
  { id: 'filters', label: 'Filtros', icon: Palette, el: FiltersTab },
  { id: 'lut', label: 'LUT', icon: Aperture, el: LutTab },
  { id: 'ai', label: 'IA Motion', icon: WandSparkles, el: AIMotionTab, ai: true },
];

export default function LeftPanel() {
  const tab = useEditorStore((s) => s.leftTab);
  const setTab = useEditorStore((s) => s.setLeftTab);
  const Active = (PANEL_TABS.find((t) => t.id === tab) || PANEL_TABS[0]).el;
  return (
    <aside className="w-[348px] shrink-0 flex flex-col bg-ink-850 border-r border-ink-700 min-h-0">
      <nav className="flex shrink-0 border-b border-ink-700 bg-ink-900 px-1 pt-1" role="tablist">
        {PANEL_TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cx(
                'relative flex-1 flex flex-col items-center gap-1 pt-1.5 pb-2 text-[10px] font-medium rounded-t-md transition-colors',
                active ? 'text-white' : 'text-ink-300 hover:text-ink-100',
                t.ai && !active && 'text-ai-soft',
              )}
            >
              {t.ai ? (
                <span className={cx('w-7 h-7 rounded-lg flex items-center justify-center', active ? 'ai-gradient animate-shimmer shadow-lg shadow-ai/40' : 'bg-ai/15')}>
                  <t.icon size={15} />
                </span>
              ) : (
                <span className={cx('w-7 h-7 rounded-lg flex items-center justify-center', active && 'bg-ink-700')}>
                  <t.icon size={15} />
                </span>
              )}
              <span className={cx(t.ai && 'font-semibold')}>{t.label}</span>
              {active && <span className={cx('absolute bottom-0 left-2 right-2 h-0.5 rounded-full', t.ai ? 'ai-gradient' : 'bg-brand')} />}
            </button>
          );
        })}
      </nav>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Active />
      </div>
    </aside>
  );
}

/** Conteúdo de uma aba do painel (usado nos "bottom sheets" do layout móvel). */
export function PanelTabBody({ id }) {
  const T = (PANEL_TABS.find((t) => t.id === id) || PANEL_TABS[0]).el;
  return <T />;
}
