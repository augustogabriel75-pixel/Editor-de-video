import { useMemo, useRef, useState } from 'react';
import { Download, Film, CircleCheck, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { exportVideo, RESOLUTIONS, frameSize, supportedFormats } from '../../engine/exporter';
import { formatTime } from '../../lib/utils';
import { Button, cx } from '../ui/primitives';
import Modal from './Modal';

const fmtBytes = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

export default function ExportModal() {
  const close = useEditorStore((s) => s.closeModal);
  const project = useEditorStore((s) => s.project);
  const duration = useEditorStore((s) => s.duration);
  const formats = useMemo(() => supportedFormats(), []);
  const [res, setRes] = useState('2160p');
  const [fps, setFps] = useState(30);
  const [fmt, setFmt] = useState(formats[0]?.id);
  const [state, setState] = useState({ phase: 'idle', progress: 0, result: null, error: null });
  const abortRef = useRef(null);
  const r = RESOLUTIONS.find((x) => x.id === res);
  const size = frameSize(project.aspect, r.short);
  const est = (size.width * size.height * fps * 0.12 * duration) / 8;

  const start = async () => {
    const format = formats.find((f) => f.id === fmt);
    if (!format) return;
    abortRef.current = new AbortController();
    setState({ phase: 'running', progress: 0, result: null, error: null });
    try {
      const result = await exportVideo({ aspect: project.aspect, short: r.short, fps, format, signal: abortRef.current.signal, onProgress: (progress) => setState((s) => ({ ...s, progress })) });
      if (!result) setState({ phase: 'idle', progress: 0, result: null, error: null });
      else setState({ phase: 'done', progress: 1, result, error: null });
    } catch (e) {
      console.error(e);
      useEditorStore.getState().setExporting(false);
      setState({ phase: 'error', progress: 0, result: null, error: String(e?.message || e) });
    }
  };

  const onClose = () => {
    if (state.phase === 'running') abortRef.current?.abort();
    close();
  };

  const fileName = `${(project.title || 'motioncut').replace(/[^\w\- ]+/g, '').trim() || 'motioncut'}.${state.result?.ext || 'webm'}`;

  return (
    <Modal title="Exportar vídeo" subtitle="Grátis, sem marca d'água, renderizado 100% no seu navegador." onClose={onClose} icon={Download} width="max-w-2xl">
      {!formats.length ? (
        <div className="flex items-center gap-2 text-[13px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <TriangleAlert size={16} /> Seu navegador não suporta MediaRecorder. Use Chrome, Edge ou Firefox atualizados.
        </div>
      ) : state.phase === 'done' ? (
        <div className="text-center space-y-4 py-2">
          <CircleCheck size={44} className="mx-auto text-emerald-400" />
          <div>
            <div className="text-[15px] font-bold text-white">Exportação concluída!</div>
            <div className="text-[12px] text-ink-300 mt-1">
              {state.result.width}×{state.result.height} · {fps} fps · {fmtBytes(state.result.size)}
            </div>
          </div>
          <video src={state.result.url} controls className="w-full max-h-64 rounded-lg bg-black" />
          <a href={state.result.url} download={fileName} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand text-ink-950 font-bold text-[13px] hover:brightness-110">
            <Download size={16} /> Baixar {fileName}
          </a>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="text-[12px] font-semibold text-ink-100 mb-2">Resolução</div>
            <div className="grid grid-cols-4 gap-2">
              {RESOLUTIONS.map((x) => {
                const fs = frameSize(project.aspect, x.short);
                return (
                  <button
                    type="button"
                    key={x.id}
                    disabled={state.phase === 'running'}
                    onClick={() => setRes(x.id)}
                    className={cx('relative rounded-xl border p-3 text-left transition-colors', res === x.id ? 'border-brand bg-brand/10' : 'border-ink-600 hover:border-ink-400')}
                  >
                    {x.id === '2160p' && <span className="absolute -top-2 right-2 text-[9px] font-bold px-1.5 py-px rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 text-ink-950">GRÁTIS</span>}
                    <div className="text-[14px] font-extrabold text-white">{x.label.split(' ')[0]}</div>
                    <div className="text-[10px] text-ink-400">{x.label.split(' ').slice(1).join(' ')}</div>
                    <div className="text-[10px] font-mono text-ink-300 mt-1">
                      {fs.width}×{fs.height}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[12px] font-semibold text-ink-100 mb-2">Taxa de quadros</div>
              <div className="flex gap-2">
                {[24, 30, 60].map((f) => (
                  <button type="button" key={f} onClick={() => setFps(f)} className={cx('flex-1 rounded-lg border py-2 text-[12px]', fps === f ? 'border-brand bg-brand/10 text-white' : 'border-ink-600 text-ink-300')}>
                    {f} fps
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-ink-100 mb-2">Formato</div>
              <select value={fmt} onChange={(e) => setFmt(e.target.value)} className="w-full bg-ink-900 border border-ink-600 rounded-lg px-3 py-2 text-[12px] outline-none focus:border-brand">
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-ink-900 border border-ink-700 p-3 text-[12px] text-ink-300">
            <Film size={18} className="text-brand shrink-0" />
            <div className="flex-1">
              Duração <span className="text-white font-mono">{formatTime(duration)}</span> · tamanho estimado <span className="text-white">~{fmtBytes(est)}</span>
              <div className="text-[11px] text-ink-400 mt-0.5">A renderização acontece em tempo real; mantenha esta aba visível. Em 4K o desempenho depende do seu computador.</div>
            </div>
          </div>
          {state.phase === 'running' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[12px]">
                <span className="text-white flex items-center gap-2">
                  <LoaderCircle size={14} className="animate-spin text-brand" /> Renderizando {size.width}×{size.height}…
                </span>
                <span className="font-mono text-ink-200">{Math.round(state.progress * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-ink-700 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 transition-all" style={{ width: `${state.progress * 100}%` }} />
              </div>
            </div>
          )}
          {state.phase === 'error' && <div className="text-[12px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">Falha: {state.error}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {state.phase === 'running' ? 'Cancelar' : 'Fechar'}
            </Button>
            <Button variant="primary" icon={Download} onClick={start} disabled={state.phase === 'running'}>
              Exportar {r.label.split(' ')[0]} grátis
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
