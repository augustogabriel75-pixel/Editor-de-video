import { CircleCheck, TriangleAlert, Info, CircleX } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { cx } from './primitives';

const ICON = { success: CircleCheck, warn: TriangleAlert, error: CircleX, info: Info };
const TONE = { success: 'text-emerald-300', warn: 'text-amber-300', error: 'text-red-300', info: 'text-brand' };

export default function Toasts() {
  const toasts = useEditorStore((s) => s.toasts);
  return (
    <div className="fixed bottom-4 max-[940px]:bottom-20 left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center gap-2 pointer-events-none w-max max-w-[92vw]">
      {toasts.map((t) => {
        const Icon = ICON[t.type] || Info;
        return (
          <div key={t.id} className="flex items-center gap-2 max-w-lg rounded-2xl bg-ink-750/95 border border-ink-500 shadow-2xl px-4 py-2 text-[12.5px] text-ink-100 backdrop-blur">
            <Icon size={15} className={cx('shrink-0', TONE[t.type])} />
            {t.msg}
          </div>
        );
      })}
    </div>
  );
}
