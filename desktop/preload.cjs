/** Ponte segura entre o editor (página) e o processo principal do app de PC. */
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('MotionCutDesktop', {
  info: () => ipcRenderer.invoke('motioncut:info'),
  /** Caminho no disco de um File escolhido no seletor ou arrastado. */
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || '';
    } catch {
      return '';
    }
  },
  /** Converte com o FFmpeg embutido para MP4 H.264 + AAC. onProgress(0..1). */
  convert: async (inputPath, onProgress) => {
    const listener = (_e, msg) => msg.inputPath === inputPath && onProgress?.(msg.progress);
    ipcRenderer.on('motioncut:convert-progress', listener);
    try {
      return await ipcRenderer.invoke('motioncut:convert', { inputPath });
    } finally {
      ipcRenderer.removeListener('motioncut:convert-progress', listener);
    }
  },
});
