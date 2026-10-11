import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, StepBack, StepForward, Volume2, VolumeX, Maximize, Grid3x3, RectangleHorizontal, RectangleVertical, Square, ChevronDown, Smartphone } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { ASPECT_RATIOS } from '../../lib/catalog';
import { formatTime } from '../../lib/utils';
import { setMasterVolume } from '../../engine/audioEngine';
import { IconButton, cx } from '../ui/primitives';
import { isNativeApp } from '../../lib/native';

const ASPECT_ICON = { '16:9': RectangleHorizontal, '9:16': Smartphone, '1:1': Square, '4:5': RectangleVertical };

function TimeDisplay({ stacked = false }) {
  const t = useEditorStore((s) => s.currentTime);
  const d = useEditorStore((s) => s.duration);
  if (stacked) {
    return (
      <div className="font-mono tabular-nums">
        <div className="text-brand">{formatTime(t)}</div>
        <div className="text-ink-400">{formatTime(d)}</div>
      </div>
    );
  }
  return (
    <div className="font-mono text-[12px] tabular-nums">
      <span className="text-brand">{formatTime(t)}</span>
      <span className="text-ink-400"> / {formatTime(d)}</span>
    </div>
  );
}

function AspectMenu() {
  const aspect = useEditorStore((s) => s.project.aspect);
  const setAspect = useEditorStore((s) => s.setAspect);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, []);
  const Icon = ASPECT_ICON[aspect];
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1.5 h-7 px-2 rounded-md bg-ink-800 border border-ink-600 text-[12px] hover:border-ink-400" title="Proporção (aspect ratio)">
        <Icon size={13} />
        {aspect}
        <ChevronDown size={12} className="text-ink-400" />
      </button>
      {open && (
        <div className="absolute bottom-9 left-0 z-30 w-48 rounded-lg bg-ink-800 border border-ink-600 shadow-xl p-1">
          {ASPECT_RATIOS.map((a) => {
            const I = ASPECT_ICON[a.id];
            return (
              <button
                type="button"
                key={a.id}
                onClick={() => {
                  setAspect(a.id);
                  setOpen(false);
                }}
                className={cx('w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px]', a.id === aspect ? 'bg-brand/15 text-white' : 'text-ink-200 hover:bg-ink-700')}
              >
                <I size={14} />
                <span className="font-semibold w-9">{a.label}</span>
                <span className="text-ink-400 text-[11px]">{a.hint}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PlayerControls({ compact = false }) {
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const toggle = useEditorStore((s) => s.togglePlay);
  const step = useEditorStore((s) => s.stepFrame);
  const seek = useEditorStore((s) => s.seek);
  const duration = useEditorStore((s) => s.duration);
  const vol = useEditorStore((s) => s.previewVolume);
  const setVol = useEditorStore((s) => s.setPreviewVolume);
  const showSafe = useEditorStore((s) => s.showSafeArea);
  const toggleSafe = useEditorStore((s) => s.toggleSafeArea);

  useEffect(() => setMasterVolume(vol), [vol]);

  const fullscreen = () => {
    const el = document.querySelector('canvas')?.parentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else el?.requestFullscreen?.();
  };

  if (compact) {
    return (
      <div className="h-11 shrink-0 flex items-center gap-1 px-2 border-t border-ink-700 bg-ink-900">
        <AspectMenu />
        <div className="flex-1 flex items-center justify-center gap-0.5">
          <IconButton icon={StepBack} label="Quadro anterior" onClick={() => step(-1)} />
          <button type="button" onClick={toggle} aria-label="Reproduzir/Pausar" className="mx-1 w-9 h-9 rounded-full bg-white text-ink-950 flex items-center justify-center active:scale-95 transition-transform">
            {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="translate-x-px" />}
          </button>
          <IconButton icon={StepForward} label="Próximo quadro" onClick={() => step(1)} />
        </div>
        <div className="w-[92px] text-right text-[10.5px] leading-tight">
          <TimeDisplay stacked />
        </div>
      </div>
    );
  }

  return (
    <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-t border-ink-700 bg-ink-900">
      <div className="flex items-center gap-3 w-[220px]">
        <AspectMenu />
        <TimeDisplay />
      </div>
      <div className="flex-1 flex items-center justify-center gap-1">
        <IconButton icon={SkipBack} label="Início (Home)" onClick={() => seek(0)} />
        <IconButton icon={StepBack} label="Quadro anterior (←)" onClick={() => step(-1)} />
        <button
          type="button"
          onClick={toggle}
          title="Reproduzir/Pausar (Espaço)"
          className="mx-1 w-9 h-9 rounded-full bg-white text-ink-950 flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
        >
          {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="translate-x-px" />}
        </button>
        <IconButton icon={StepForward} label="Próximo quadro (→)" onClick={() => step(1)} />
        <IconButton icon={SkipForward} label="Fim (End)" onClick={() => seek(duration)} />
      </div>
      <div className="flex items-center gap-1 w-[220px] justify-end">
        <IconButton icon={vol > 0 ? Volume2 : VolumeX} label="Mudo no preview" onClick={() => setVol(vol > 0 ? 0 : 1)} />
        <input type="range" min={0} max={1} step={0.01} value={vol} onChange={(e) => setVol(parseFloat(e.target.value))} className="mc-range w-20" style={{ '--fill': `${vol * 100}%` }} aria-label="Volume do preview" />
        <IconButton icon={Grid3x3} label="Guias de área segura" active={showSafe} onClick={toggleSafe} />
        {!isNativeApp && <IconButton icon={Maximize} label="Tela cheia" onClick={fullscreen} />}
      </div>
    </div>
  );
}
