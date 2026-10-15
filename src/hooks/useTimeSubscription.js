import { useEffect } from 'react';
import { useEditorStore } from '../store/useEditorStore';

/**
 * Executa `fn(currentTime, pxPerSec)` a cada mudança de tempo/zoom SEM re-renderizar o componente
 * (atualização direta no DOM — mantém a interface fluida durante a reprodução).
 */
export function useTimeSubscription(fn, deps = []) {
  useEffect(() => {
    const run = () => {
      const s = useEditorStore.getState();
      fn(s.currentTime, s.pxPerSec, s.duration);
    };
    run();
    const u1 = useEditorStore.subscribe((s) => s.currentTime, run);
    const u2 = useEditorStore.subscribe((s) => s.pxPerSec, run);
    const u3 = useEditorStore.subscribe((s) => s.duration, run);
    return () => {
      u1();
      u2();
      u3();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
