import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './fonts';
import './index.css';
import App from './App';
import { LUTS, lutThumb } from './lib/luts';
import { useEditorStore } from './store/useEditorStore';

// API de depuração/extensão: window.MotionCut.store.getState()
window.MotionCut = { store: useEditorStore, luts: { LUTS, lutThumb } };

// Botão "voltar" do Android: fecha modais/seleção antes de sair (o layout móvel sobrescreve).
if (!window.MotionCutBack) {
  window.MotionCutBack = () => {
    const s = useEditorStore.getState();
    if (s.modal) {
      s.closeModal();
      return true;
    }
    return false;
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
