import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> dist/ (web, GitHub Pages e app Android)
// `npm run build:single` -> dist-single/MotionCut.html (um único arquivo, abre offline com dois cliques)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    // Caminhos relativos: funciona em subpasta (GitHub Pages), no app Android e via file://
    base: './',
    plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    build: single
      ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 4000 }
      : { chunkSizeWarningLimit: 1200 },
    server: { port: 5173 },
  };
});
