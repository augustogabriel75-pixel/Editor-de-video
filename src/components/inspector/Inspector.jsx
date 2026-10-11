import { Film, Volume2, Gauge, Clapperboard, WandSparkles, Type, Move, Trash2, Image as ImageIcon, AudioLines, Captions } from 'lucide-react';
import { useEditorStore, selectSelectedClip } from '../../store/useEditorStore';
import { formatTime } from '../../lib/utils';
import { getTemplate } from '../../engine/motionTemplates';
import { iconFor } from '../ui/icons';
import { cx, IconButton, AIBadge } from '../ui/primitives';
import VideoPanel from './VideoPanel';
import AudioPanel from './AudioPanel';
import SpeedPanel from './SpeedPanel';
import AnimationPanel from './AnimationPanel';
import TextPanel from './TextPanel';
import TransformSection from './TransformSection';
import { MotionAIPanel, ClipAIPanel } from './AIPanel';
import ProjectPanel from './ProjectPanel';

function tabsFor(clip, asset) {
  switch (clip.kind) {
    case 'video':
      return [
        { id: 'video', label: 'Vídeo', icon: Film },
        ...(asset?.hasAudio ? [{ id: 'audio', label: 'Áudio', icon: Volume2 }] : []),
        { id: 'speed', label: 'Velocidade', icon: Gauge },
        { id: 'anim', label: 'Animações', icon: Clapperboard },
        { id: 'ai', label: 'IA', icon: WandSparkles, ai: true },
      ];
    case 'image':
      return [
        { id: 'video', label: 'Imagem', icon: ImageIcon },
        { id: 'anim', label: 'Animações', icon: Clapperboard },
        { id: 'ai', label: 'IA', icon: WandSparkles, ai: true },
      ];
    case 'audio':
      return [
        { id: 'audio', label: 'Áudio', icon: Volume2 },
        { id: 'speed', label: 'Velocidade', icon: Gauge },
        { id: 'ai', label: 'IA', icon: WandSparkles, ai: true },
      ];
    case 'text':
    case 'caption':
      return [
        { id: 'text', label: 'Texto', icon: Type },
        { id: 'transform', label: 'Posição', icon: Move },
        { id: 'anim', label: 'Animações', icon: Clapperboard },
        { id: 'ai', label: 'IA', icon: WandSparkles, ai: true },
      ];
    case 'motion':
      return [
        { id: 'motion', label: 'Motion IA', icon: WandSparkles, ai: true },
        { id: 'transform', label: 'Posição', icon: Move },
      ];
    default:
      return [];
  }
}

const KIND_ICON = { video: Film, image: ImageIcon, audio: AudioLines, text: Type, caption: Captions };

export default function Inspector({ embedded = false }) {
  const clip = useEditorStore(selectSelectedClip);
  const asset = useEditorStore((s) => (clip ? s.assets.find((a) => a.id === clip.assetId) : null));
  const tab = useEditorStore((s) => s.inspectorTab);
  const setTab = useEditorStore((s) => s.setInspectorTab);
  const updateClip = useEditorStore((s) => s.updateClip);
  const del = useEditorStore((s) => s.deleteSelected);

  if (!clip) {
    return (
      <aside className={embedded ? 'w-full' : 'w-[320px] shrink-0 bg-ink-850 border-l border-ink-700 overflow-y-auto'}>
        <ProjectPanel />
      </aside>
    );
  }
  const tabs = tabsFor(clip, asset);
  const active = tabs.find((t) => t.id === tab)?.id || tabs[0].id;
  const Icon = clip.kind === 'motion' ? iconFor(getTemplate(clip.motion.templateId).icon) : KIND_ICON[clip.kind];

  return (
    <aside className={embedded ? 'w-full h-full flex flex-col min-h-0' : 'w-[320px] shrink-0 bg-ink-850 border-l border-ink-700 flex flex-col min-h-0'}>
      <div className="px-4 pt-3 pb-2 border-b border-ink-700 space-y-2">
        <div className="flex items-center gap-2">
          <div className={cx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', clip.kind === 'motion' ? 'ai-gradient' : 'bg-ink-700')}>
            <Icon size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <input
              value={clip.name}
              onChange={(e) => updateClip(clip.id, { name: e.target.value }, `name:${clip.id}`)}
              className="w-full bg-transparent text-[13px] font-semibold text-white outline-none truncate hover:bg-ink-800 focus:bg-ink-800 rounded px-1 -mx-1"
            />
            <div className="text-[10.5px] font-mono text-ink-400">
              {formatTime(clip.start)} → {formatTime(clip.start + clip.duration)} · {clip.duration.toFixed(2)}s
            </div>
          </div>
          <IconButton icon={Trash2} tone="danger" label="Excluir clipe (Del)" onClick={del} />
        </div>
        {clip.ai && clip.kind !== 'motion' && <AIBadge small>Gerado por IA</AIBadge>}
        <div className="flex gap-0.5 -mb-2">
          {tabs.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                'relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-1.5 pb-2 text-[10.5px] font-medium transition-colors whitespace-nowrap',
                active === t.id ? 'text-white' : 'text-ink-400 hover:text-ink-100',
                t.ai && active !== t.id && 'text-ai-soft/80',
              )}
            >
              <t.icon size={14} />
              {t.label}
              {active === t.id && <span className={cx('absolute bottom-0 left-1 right-1 h-0.5 rounded-full', t.ai ? 'ai-gradient' : 'bg-brand')} />}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {active === 'video' && <VideoPanel clip={clip} />}
        {active === 'audio' && <AudioPanel clip={clip} />}
        {active === 'speed' && <SpeedPanel clip={clip} />}
        {active === 'anim' && <AnimationPanel clip={clip} />}
        {active === 'text' && <TextPanel clip={clip} />}
        {active === 'transform' && <TransformSection clip={clip} title="Posição e escala" />}
        {active === 'motion' && <MotionAIPanel clip={clip} />}
        {active === 'ai' && <ClipAIPanel clip={clip} />}
      </div>
    </aside>
  );
}
