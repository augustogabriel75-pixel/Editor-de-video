import { useEffect } from 'react';
import { useEditorStore } from '../store/useEditorStore';

/** Atalhos de teclado globais estilo CapCut. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      const s = useEditorStore.getState();
      if (s.modal || s.exporting) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (k === ' ') {
        e.preventDefault();
        s.togglePlay();
      } else if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        s.redo();
      } else if (mod && k === 'd') {
        e.preventDefault();
        s.duplicateSelected();
      } else if ((mod && k === 'b') || (!mod && k === 's')) {
        e.preventDefault();
        s.splitAtPlayhead();
      } else if (k === 'delete' || k === 'backspace') {
        e.preventDefault();
        s.deleteSelected();
      } else if (!mod && k === 'k') s.addKeyframe();
      else if (!mod && k === 'g') {
        if (s.ai.analysis) s.generateAIMotions({ prompt: '', scope: 'all' });
        else s.runAIAnalysis();
      } else if (k === 'arrowleft') {
        e.preventDefault();
        if (e.shiftKey) s.seek(s.currentTime - 1);
        else s.stepFrame(-1);
      } else if (k === 'arrowright') {
        e.preventDefault();
        if (e.shiftKey) s.seek(s.currentTime + 1);
        else s.stepFrame(1);
      } else if (k === 'home') s.seek(0);
      else if (k === 'end') s.seek(s.duration);
      else if (k === '+' || k === '=') s.setZoom(s.pxPerSec * 1.25);
      else if (k === '-') s.setZoom(s.pxPerSec / 1.25);
      else if (k === 'escape') s.select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
