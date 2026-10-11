import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ title, subtitle, onClose, children, width = 'max-w-xl', icon: Icon }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-6" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`w-full ${width} max-h-full overflow-y-auto rounded-2xl bg-ink-850 border border-ink-600 shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-ink-700">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-9 h-9 rounded-xl ai-gradient flex items-center justify-center">
                <Icon size={17} />
              </div>
            )}
            <div>
              <h3 className="text-[15px] font-bold text-white">{title}</h3>
              {subtitle && <p className="text-[12px] text-ink-300 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md text-ink-300 hover:text-white hover:bg-ink-700" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
