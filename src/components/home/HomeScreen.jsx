import { useEffect, useRef, useState } from 'react';
import { Plus, Sparkles, Film, Trash2, Copy, Pencil, Clock, RectangleHorizontal, Smartphone, Square, RectangleVertical, FolderOpen, Upload, MoreVertical } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { ASPECT_RATIOS } from '../../lib/catalog';
import { formatTime } from '../../lib/utils';
import { importFiles } from '../../lib/importer';
import { IMPORT_ACCEPT } from '../../lib/mediaTypes';
import { cx } from '../ui/primitives';

const ICON = { '16:9': RectangleHorizontal, '9:16': Smartphone, '1:1': Square, '4:5': RectangleVertical };

function timeAgo(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'agora mesmo';
  if (d < 3600) return `há ${Math.round(d / 60)} min`;
  if (d < 86400) return `há ${Math.round(d / 3600)} h`;
  return new Date(ts).toLocaleDateString('pt-BR');
}

function NewProjectPanel({ onClose }) {
  const newProject = useEditorStore((s) => s.newProject);
  const [aspect, setAspect] = useState('9:16');
  const [title, setTitle] = useState('');
  const fileRef = useRef(null);
  const boxRef = useRef(null);
  useEffect(() => {
    boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);
  const create = async (files) => {
    newProject({ title: title.trim() || `Projeto ${new Date().toLocaleDateString('pt-BR')}`, aspect });
    if (files?.length) {
      const st = useEditorStore.getState();
      const imported = await importFiles([...files]);
      st.addAssets(imported);
      for (const err of imported.errors) st.toast(err, 'error');
      let t = 0;
      for (const a of imported) {
        if (a.type === 'audio') continue;
        useEditorStore.getState().addAssetToTimeline(a.id, { trackId: 'trk-main', start: t });
        t += a.type === 'image' ? 5 : a.duration;
      }
      for (const a of imported) if (a.type === 'audio') useEditorStore.getState().addAssetToTimeline(a.id, { start: 0 });
      useEditorStore.getState().select(null);
    }
    onClose?.();
  };
  return (
    <div ref={boxRef} className="rounded-2xl border border-brand/40 bg-ink-850 p-4 space-y-4 scroll-mt-4">
      <div className="text-[14px] font-bold text-white">Novo projeto</div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nome do projeto (opcional)"
        className="w-full bg-ink-900 border border-ink-600 focus:border-brand rounded-lg px-3 py-2.5 text-[13px] outline-none"
      />
      <div>
        <div className="text-[11px] text-ink-300 mb-2">Formato</div>
        <div className="grid grid-cols-4 gap-2">
          {ASPECT_RATIOS.map((a) => {
            const I = ICON[a.id];
            return (
              <button
                type="button"
                key={a.id}
                onClick={() => setAspect(a.id)}
                className={cx('rounded-xl border py-2.5 flex flex-col items-center gap-1', aspect === a.id ? 'border-brand bg-brand/10 text-white' : 'border-ink-600 text-ink-300')}
              >
                <I size={18} />
                <span className="text-[12px] font-semibold">{a.label}</span>
                <span className="text-[9.5px] text-ink-400">{a.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
      <input ref={fileRef} type="file" multiple accept={IMPORT_ACCEPT} className="hidden" onChange={(e) => create(e.target.files)} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-brand text-ink-950 font-bold text-[13px] py-3">
          <Upload size={16} /> Importar mídia
        </button>
        <button type="button" onClick={() => create(null)} className="flex items-center justify-center gap-2 rounded-xl bg-ink-700 border border-ink-600 text-white font-semibold text-[13px] py-3">
          <Plus size={16} /> Projeto vazio
        </button>
      </div>
    </div>
  );
}

function ProjectCard({ p }) {
  const open = useEditorStore((s) => s.openProject);
  const del = useEditorStore((s) => s.deleteProject);
  const rename = useEditorStore((s) => s.renameProject);
  const dup = useEditorStore((s) => s.duplicateProject);
  const [menu, setMenu] = useState(false);
  const I = ICON[p.aspect] || Film;
  return (
    <div className="relative group rounded-xl overflow-hidden bg-ink-800 border border-ink-700 hover:border-brand/60">
      <button type="button" onClick={() => open(p.id)} className="block w-full text-left">
        <div className="aspect-video bg-ink-900 flex items-center justify-center overflow-hidden">
          {p.thumb ? <img src={p.thumb} alt="" className="w-full h-full object-cover" draggable={false} /> : <Film size={26} className="text-ink-500" />}
        </div>
        <div className="px-3 py-2">
          <div className="text-[13px] font-semibold text-white truncate pr-6">{p.title}</div>
          <div className="text-[10.5px] text-ink-400 flex items-center gap-2 mt-0.5">
            <I size={11} /> {p.aspect}
            <span>· {formatTime(p.duration || 0, false)}</span>
            <span className="flex items-center gap-1">
              · <Clock size={10} /> {timeAgo(p.updatedAt)}
            </span>
          </div>
        </div>
      </button>
      <button type="button" onClick={() => setMenu(!menu)} aria-label="Opções" className="absolute right-1.5 bottom-2 p-1.5 rounded-md text-ink-300 hover:text-white hover:bg-ink-700">
        <MoreVertical size={16} />
      </button>
      {menu && (
        <div className="absolute right-2 bottom-10 z-10 w-40 rounded-lg bg-ink-750 border border-ink-600 shadow-xl p-1 text-[12px]">
          <button type="button" className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-ink-600" onClick={() => { setMenu(false); open(p.id); }}>
            <FolderOpen size={13} /> Abrir
          </button>
          <button type="button" className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-ink-600" onClick={() => { setMenu(false); const t = window.prompt('Novo nome do projeto', p.title); if (t && t.trim()) rename(p.id, t.trim()); }}>
            <Pencil size={13} /> Renomear
          </button>
          <button type="button" className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-ink-600" onClick={() => { setMenu(false); dup(p.id); }}>
            <Copy size={13} /> Duplicar
          </button>
          <button type="button" className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-red-500/20 text-red-300" onClick={() => { setMenu(false); if (window.confirm(`Excluir “${p.title}”? Isso não pode ser desfeito.`)) del(p.id); }}>
            <Trash2 size={13} /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}

/** Tela inicial: novo projeto, exemplo e projetos salvos no aparelho. */
export default function HomeScreen() {
  const projects = useEditorStore((s) => s.projectList);
  const refresh = useEditorStore((s) => s.refreshProjects);
  const openDemo = useEditorStore((s) => s.openDemo);
  const [showNew, setShowNew] = useState(false);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    window.MotionCutBack = () => {
      if (showNew) {
        setShowNew(false);
        return true;
      }
      return false;
    };
  }, [showNew]);

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-ink-950 text-ink-100">
      <div className="max-w-5xl mx-auto px-4 pt-5 pb-12 space-y-6">
        <header className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-ink-900 border border-ink-600 flex items-center justify-center">
            <svg viewBox="0 0 64 64" className="w-7 h-7">
              <defs>
                <linearGradient id="mch" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#22d3ee" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              <path d="M12 48V16l12 15 12-15v32" fill="none" stroke="url(#mch)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M43 22l10-5v30l-10-5z" fill="url(#mch)" />
            </svg>
          </div>
          <div>
            <div className="text-[19px] font-extrabold tracking-tight">
              Motion<span className="ai-text">Cut</span>
            </div>
            <div className="text-[11px] text-ink-400">Editor de vídeo com IA Motion</div>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="relative overflow-hidden rounded-2xl p-5 text-left bg-gradient-to-br from-cyan-400/25 via-ink-800 to-fuchsia-500/20 border border-brand/40 hover:border-brand"
          >
            <div className="w-11 h-11 rounded-xl bg-brand text-ink-950 flex items-center justify-center mb-3">
              <Plus size={24} strokeWidth={2.5} />
            </div>
            <div className="text-[16px] font-bold text-white">Novo projeto</div>
            <div className="text-[12px] text-ink-300">Escolha o formato e importe seus vídeos</div>
          </button>
          <button type="button" onClick={openDemo} className="relative overflow-hidden rounded-2xl p-5 text-left bg-ink-850 border border-ai/40 hover:border-ai">
            <div className="w-11 h-11 rounded-xl ai-gradient flex items-center justify-center mb-3">
              <Sparkles size={22} />
            </div>
            <div className="text-[16px] font-bold text-white">Abrir exemplo</div>
            <div className="text-[12px] text-ink-300">Projeto demonstrativo com IA Motion pronto para testar</div>
          </button>
        </div>

        {showNew && <NewProjectPanel onClose={() => setShowNew(false)} />}

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[15px] font-bold text-white">Meus projetos</h2>
            <span className="text-[11px] text-ink-400">Salvos automaticamente neste aparelho</span>
          </div>
          {projects.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-ink-600 py-10 text-center text-[13px] text-ink-400">
              Nenhum projeto ainda. Toque em <b className="text-white">Novo projeto</b> para começar.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
