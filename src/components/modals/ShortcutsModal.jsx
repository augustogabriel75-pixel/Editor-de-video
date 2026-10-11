import { Keyboard } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import Modal from './Modal';

const SHORTCUTS = [
  ['Espaço', 'Reproduzir / pausar'],
  ['← / →', 'Quadro anterior / próximo (Shift = 1s)'],
  ['Home / End', 'Início / fim'],
  ['S ou Ctrl+B', 'Dividir no playhead'],
  ['Delete / Backspace', 'Excluir clipe'],
  ['Ctrl+D', 'Duplicar clipe'],
  ['K', 'Adicionar/remover keyframe'],
  ['Ctrl+Z / Ctrl+Shift+Z', 'Desfazer / refazer'],
  ['+ / −', 'Zoom da timeline'],
  ['Ctrl + roda do mouse', 'Zoom da timeline'],
  ['G', 'Gerar Motion IA'],
  ['Esc', 'Limpar seleção'],
];

export default function ShortcutsModal() {
  const close = useEditorStore((s) => s.closeModal);
  return (
    <Modal title="Atalhos de teclado" onClose={close} icon={Keyboard} width="max-w-md">
      <ul className="space-y-1.5">
        {SHORTCUTS.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between text-[12.5px]">
            <span className="text-ink-200">{v}</span>
            <kbd className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-ink-700 border border-ink-500 text-white">{k}</kbd>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
