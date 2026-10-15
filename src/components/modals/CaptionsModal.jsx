import { useState } from 'react';
import { Captions, LoaderCircle } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { CAPTION_PRESETS } from '../../lib/catalog';
import { Button, Slider, cx } from '../ui/primitives';
import { cssForTextStyle } from '../left/TextTab';
import Modal from './Modal';

function PresetPreview({ preset }) {
  const words = ['GANHAR', 'DINHEIRO', 'ONLINE'];
  const st = preset.style;
  return (
    <div className="h-16 rounded-lg bg-gradient-to-br from-indigo-950 to-slate-900 flex items-center justify-center gap-1.5 text-[17px] overflow-hidden">
      {words.map((w, i) => {
        const active = i === 1;
        const style = { ...cssForTextStyle({ ...st, size: 20 }) };
        if (preset.highlight === 'pop' && active) Object.assign(style, { color: st.highlightColor, transform: 'scale(1.15)' });
        if (preset.highlight === 'fill' && i <= 1) Object.assign(style, { color: st.highlightColor });
        if (preset.highlight === 'color' && active) Object.assign(style, { color: st.highlightColor });
        if (preset.highlight === 'box' && active) Object.assign(style, { background: st.highlightColor, borderRadius: 6, padding: '0 5px' });
        return (
          <span key={w} style={style} className="inline-block">
            {st.uppercase ? w : w.charAt(0) + w.slice(1).toLowerCase()}
          </span>
        );
      })}
    </div>
  );
}

export default function CaptionsModal() {
  const close = useEditorStore((s) => s.closeModal);
  const generate = useEditorStore((s) => s.generateCaptions);
  const [preset, setPreset] = useState('tiktok');
  const [maxWords, setMaxWords] = useState(3);
  const [busy, setBusy] = useState(false);
  const detail = useEditorStore((s) => s.ai.stepDetail);
  return (
    <Modal title="Legendas Automáticas" subtitle="Transcreve a fala e cria legendas dinâmicas com realce palavra por palavra." onClose={close} icon={Captions}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {CAPTION_PRESETS.map((p) => (
            <button type="button" key={p.id} onClick={() => setPreset(p.id)} className={cx('text-left rounded-xl border p-2 transition-colors', preset === p.id ? 'border-ai bg-ai/10' : 'border-ink-600 hover:border-ink-400')}>
              <PresetPreview preset={p} />
              <div className="text-[12px] font-semibold text-white mt-2">{p.name}</div>
              <div className="text-[10.5px] text-ink-400">{p.desc}</div>
            </button>
          ))}
        </div>
        <Slider label="Palavras por legenda" value={maxWords} min={1} max={7} onChange={setMaxWords} />
        {busy && <div className="text-[12px] text-ai-soft flex items-center gap-2"><LoaderCircle size={14} className="animate-spin" />{detail || 'Transcrevendo o áudio…'}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant="ai"
            icon={busy ? LoaderCircle : Captions}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await generate(preset, { maxWords });
              setBusy(false);
            }}
          >
            Gerar legendas
          </Button>
        </div>
      </div>
    </Modal>
  );
}
