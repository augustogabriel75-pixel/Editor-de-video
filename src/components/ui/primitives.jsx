/** Componentes de UI reutilizáveis (Tailwind). */
import { useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';

export const cx = (...c) => c.filter(Boolean).join(' ');

export function IconButton({ icon: Icon, label, onClick, active, disabled, size = 16, className = '', tone = 'default', ...rest }) {
  const tones = {
    default: active ? 'bg-ink-600 text-white' : 'text-ink-200 hover:bg-ink-700 hover:text-white',
    ai: active ? 'bg-ai/25 text-ai-soft' : 'text-ai-soft hover:bg-ai/15',
    danger: 'text-ink-200 hover:bg-red-500/15 hover:text-red-300',
  };
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cx('inline-flex items-center justify-center rounded-md p-1.5 transition-colors disabled:opacity-35 disabled:pointer-events-none', tones[tone], className)}
      {...rest}
    >
      <Icon size={size} strokeWidth={2} />
    </button>
  );
}

export function Button({ children, icon: Icon, onClick, variant = 'secondary', className = '', disabled, size = 'md', title, type = 'button' }) {
  const v = {
    primary: 'bg-brand text-ink-950 hover:bg-cyan-300 font-semibold',
    secondary: 'bg-ink-700 text-ink-100 hover:bg-ink-600 border border-ink-600',
    ghost: 'text-ink-200 hover:bg-ink-700',
    ai: 'ai-gradient text-white font-semibold shadow-lg shadow-ai/25 hover:brightness-110',
    danger: 'bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30',
  };
  const s = { sm: 'text-xs px-2.5 py-1.5 gap-1.5', md: 'text-[13px] px-3 py-2 gap-2', lg: 'text-sm px-4 py-2.5 gap-2' };
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} className={cx('inline-flex items-center justify-center rounded-lg transition-all disabled:opacity-40 disabled:pointer-events-none', v[variant], s[size], className)}>
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format, suffix = '', ai = false, onReset, disabled }) {
  const v = Number.isFinite(value) ? value : min;
  const pct = ((v - min) / (max - min)) * 100;
  return (
    <div className={cx('block', disabled && 'opacity-40 pointer-events-none')}>
      <div className="flex items-center justify-between text-[11px] text-ink-300 mb-1.5">
        <span>{label}</span>
        <span className="flex items-center gap-1">
          <span className="font-mono text-ink-100 tabular-nums">
            {format ? format(v) : v}
            {suffix}
          </span>
          {onReset && (
            <button type="button" title="Redefinir" onClick={onReset} className="text-ink-400 hover:text-ink-100">
              <RotateCcw size={11} />
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        className={cx('mc-range w-full', ai && 'ai')}
        style={{ '--fill': `${pct}%` }}
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, ai = false, disabled }) {
  return (
    <label className={cx('flex items-start justify-between gap-3 cursor-pointer select-none', disabled && 'opacity-40 pointer-events-none')}>
      <span className="min-w-0">
        <span className="block text-[12px] text-ink-100">{label}</span>
        {description && <span className="block text-[11px] text-ink-400 leading-snug mt-0.5">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5', checked ? (ai ? 'bg-ai' : 'bg-brand') : 'bg-ink-500')}
      >
        <span className={cx('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
      </button>
    </label>
  );
}

export function Section({ title, icon: Icon, children, defaultOpen = true, right, accent }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-ink-700/70">
      <div className="flex items-center justify-between px-4 py-2.5">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2 text-[12px] font-semibold text-ink-100 hover:text-white">
          {Icon && <Icon size={14} className={accent === 'ai' ? 'text-ai-soft' : 'text-brand'} />}
          {title}
          <ChevronDown size={13} className={cx('text-ink-400 transition-transform', !open && '-rotate-90')} />
        </button>
        {right}
      </div>
      {open && <div className="px-4 pb-4 space-y-3.5">{children}</div>}
    </section>
  );
}

export function Segmented({ options, value, onChange, size = 'md', ai = false }) {
  return (
    <div className="flex rounded-lg bg-ink-850 p-0.5 border border-ink-700">
      {options.map((o) => (
        <button
          type="button"
          key={o.id}
          onClick={() => onChange(o.id)}
          title={o.title}
          className={cx(
            'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md transition-colors whitespace-nowrap',
            size === 'sm' ? 'text-[11px] px-1.5 py-1' : 'text-[12px] px-2 py-1.5',
            value === o.id ? (ai ? 'bg-ai/25 text-white' : 'bg-ink-600 text-white shadow') : 'text-ink-300 hover:text-ink-100',
          )}
        >
          {o.icon && <o.icon size={13} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ColorField({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-ink-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-ink-200 uppercase">{value}</span>
        <input type="color" className="mc-color" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

export function SelectField({ label, value, onChange, options }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-ink-300 shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 max-w-[180px] bg-ink-850 border border-ink-600 rounded-md text-[12px] text-ink-100 px-2 py-1.5 outline-none focus:border-brand"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AIBadge({ children = 'IA Motion Generated', small = false, className = '' }) {
  return (
    <span className={cx('relative inline-flex items-center gap-1 rounded-full ai-gradient text-white font-semibold overflow-hidden animate-shimmer', small ? 'text-[9px] px-1.5 py-px' : 'text-[10px] px-2 py-0.5', className)}>
      <span className="absolute inset-0 ai-shimmer" />
      <span className="relative">✨ {children}</span>
    </span>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10 text-ink-300">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-ink-700 flex items-center justify-center mb-3">
          <Icon size={22} className="text-ink-200" />
        </div>
      )}
      <div className="text-[13px] font-semibold text-ink-100">{title}</div>
      <div className="text-[12px] mt-1 leading-relaxed">{children}</div>
    </div>
  );
}
