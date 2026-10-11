import { useEffect, useState } from 'react';
import { useEditorStore } from './store/useEditorStore';
import { initPlayback } from './engine/playback';
import { useShortcuts } from './hooks/useShortcuts';
import TopBar from './components/layout/TopBar';
import LeftPanel from './components/left/LeftPanel';
import PreviewPlayer from './components/preview/PreviewPlayer';
import Inspector from './components/inspector/Inspector';
import Timeline from './components/timeline/Timeline';
import ExportModal from './components/modals/ExportModal';
import CaptionsModal from './components/modals/CaptionsModal';
import ShortcutsModal from './components/modals/ShortcutsModal';
import Toasts from './components/ui/Toasts';

function ResizeHandle({ onDrag }) {
  return (
    <div
      className="h-1.5 shrink-0 cursor-row-resize bg-ink-950 hover:bg-brand/40 transition-colors"
      title="Arraste para redimensionar a timeline"
      onPointerDown={(e) => {
        e.preventDefault();
        const y0 = e.clientY;
        const move = (ev) => onDrag(y0 - ev.clientY, false);
        const up = () => {
          onDrag(0, true);
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
    />
  );
}

export default function App() {
  const modal = useEditorStore((s) => s.modal);
  const [tlH, setTlH] = useState(() => Math.round(Math.min(420, Math.max(300, window.innerHeight * 0.4))));
  const [base, setBase] = useState(tlH);

  useShortcuts();
  useEffect(() => {
    initPlayback();
  }, []);

  return (
    <div className="h-full flex flex-col bg-ink-950 text-ink-100">
      <TopBar />
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex">
          <LeftPanel />
          <PreviewPlayer />
          <Inspector />
        </div>
        <ResizeHandle
          onDrag={(dy, end) => {
            const h = Math.max(200, Math.min(window.innerHeight - 260, base + dy));
            setTlH(h);
            if (end) setBase(tlH);
          }}
        />
        <Timeline height={tlH} />
      </div>
      {modal === 'export' && <ExportModal />}
      {modal === 'captions' && <CaptionsModal />}
      {modal === 'shortcuts' && <ShortcutsModal />}
      <Toasts />
    </div>
  );
}
