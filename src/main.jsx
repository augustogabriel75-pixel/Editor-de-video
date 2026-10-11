import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { useEditorStore } from './store/useEditorStore';

// API de depuração/extensão: window.MotionCut.store.getState()
window.MotionCut = { store: useEditorStore };

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
