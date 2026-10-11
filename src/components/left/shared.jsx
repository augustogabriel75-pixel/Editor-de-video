import { Search } from 'lucide-react';
import { cx } from '../ui/primitives';

export function SearchBox({ value, onChange, placeholder = 'Buscar' }) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-ink-900 border border-ink-700 focus:border-brand rounded-lg pl-8 pr-3 py-2 text-[12px] outline-none placeholder:text-ink-400"
      />
    </div>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          type="button"
          key={o}
          onClick={() => onChange(o)}
          className={cx('px-2.5 py-1 rounded-full text-[11px] border transition-colors', value === o ? 'bg-ink-100 text-ink-950 border-ink-100 font-semibold' : 'border-ink-600 text-ink-200 hover:border-ink-400')}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function PanelHeader({ title, subtitle, children }) {
  return (
    <div className="px-4 pt-4 pb-3 space-y-3">
      <div>
        <h2 className="text-[14px] font-bold text-white">{title}</h2>
        {subtitle && <p className="text-[11px] text-ink-300 mt-0.5 leading-snug">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export const ASSET_MIME = 'application/x-motioncut-asset';
