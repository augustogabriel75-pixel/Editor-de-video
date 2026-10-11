/**
 * Catálogos de ativos "prontos" (filtros, efeitos, transições, animações e estilos de texto).
 * A implementação visual de cada item vive em src/engine/*.
 */

export const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', hint: 'YouTube', w: 16, h: 9 },
  { id: '9:16', label: '9:16', hint: 'TikTok / Reels', w: 9, h: 16 },
  { id: '1:1', label: '1:1', hint: 'Instagram', w: 1, h: 1 },
  { id: '4:5', label: '4:5', hint: 'Feed', w: 4, h: 5 },
];

export const getAspect = (id) => ASPECT_RATIOS.find((a) => a.id === id) || ASPECT_RATIOS[0];

/* ----------------------------------------------------------------------------------------------
 * FILTROS — parâmetros de cor; a intensidade (0..100) interpola a partir do "Original".
 * -------------------------------------------------------------------------------------------- */
export const FILTERS = [
  { id: 'none', name: 'Original', category: 'Básico', p: {} },
  { id: 'vivid', name: 'Vívido', category: 'Básico', p: { saturate: 1.55, contrast: 1.12 } },
  { id: 'cinema', name: 'Cinema', category: 'Filme', p: { contrast: 1.18, saturate: 0.9 }, tint: { color: '#0e7490', alpha: 0.22, mode: 'soft-light' } },
  { id: 'teal-orange', name: 'Teal & Orange', category: 'Filme', p: { contrast: 1.15, saturate: 1.2 }, tint: { color: '#fb923c', alpha: 0.2, mode: 'overlay' } },
  { id: 'noir', name: 'Noir P&B', category: 'Filme', p: { grayscale: 1, contrast: 1.35, brightness: 0.95 } },
  { id: 'vintage', name: 'Vintage', category: 'Retrô', p: { sepia: 0.45, contrast: 0.92, saturate: 0.8, brightness: 1.05 } },
  { id: 'retro70', name: 'Retrô 70s', category: 'Retrô', p: { sepia: 0.3, hue: -12, saturate: 1.3 }, tint: { color: '#f59e0b', alpha: 0.18, mode: 'soft-light' } },
  { id: 'kodak', name: 'Kodak', category: 'Retrô', p: { contrast: 1.1, saturate: 1.25, brightness: 1.04 }, tint: { color: '#fde68a', alpha: 0.14, mode: 'soft-light' } },
  { id: 'warm', name: 'Quente', category: 'Básico', p: { saturate: 1.15, hue: -8 }, tint: { color: '#f97316', alpha: 0.16, mode: 'soft-light' } },
  { id: 'cold', name: 'Frio', category: 'Básico', p: { saturate: 0.95, hue: 8 }, tint: { color: '#38bdf8', alpha: 0.2, mode: 'soft-light' } },
  { id: 'neon', name: 'Neon Night', category: 'Estilo', p: { saturate: 1.7, contrast: 1.2, hue: 18 }, tint: { color: '#c026d3', alpha: 0.2, mode: 'overlay' } },
  { id: 'cyberpunk', name: 'Cyberpunk', category: 'Estilo', p: { saturate: 1.4, contrast: 1.25, hue: -25 }, tint: { color: '#22d3ee', alpha: 0.2, mode: 'overlay' } },
  { id: 'pastel', name: 'Pastel', category: 'Estilo', p: { saturate: 0.7, brightness: 1.12, contrast: 0.88 } },
  { id: 'drama', name: 'Dramático', category: 'Estilo', p: { contrast: 1.45, saturate: 0.75, brightness: 0.92 } },
  { id: 'matte', name: 'Fade Matte', category: 'Filme', p: { contrast: 0.8, brightness: 1.08, saturate: 0.85 } },
  { id: 'summer', name: 'Verão', category: 'Estilo', p: { saturate: 1.35, brightness: 1.08 }, tint: { color: '#facc15', alpha: 0.12, mode: 'soft-light' } },
];

export const getFilter = (id) => FILTERS.find((f) => f.id === id) || FILTERS[0];

/** Constrói a string CSS/Canvas `filter` para um filtro + ajustes manuais. */
export function buildFilterString(filterId, intensity = 100, adjust = {}) {
  const f = getFilter(filterId);
  const k = intensity / 100;
  const p = f.p || {};
  const parts = [];
  const mix = (v, neutral) => neutral + ((v ?? neutral) - neutral) * k;
  const brightness = mix(p.brightness, 1) * (1 + (adjust.brightness || 0) / 100);
  const contrast = mix(p.contrast, 1) * (1 + (adjust.contrast || 0) / 100);
  const saturate = mix(p.saturate, 1) * (1 + (adjust.saturation || 0) / 100);
  const hue = mix(p.hue, 0) + (adjust.hue || 0);
  const sepia = mix(p.sepia, 0);
  const grayscale = mix(p.grayscale, 0);
  if (Math.abs(brightness - 1) > 0.001) parts.push(`brightness(${brightness.toFixed(3)})`);
  if (Math.abs(contrast - 1) > 0.001) parts.push(`contrast(${contrast.toFixed(3)})`);
  if (Math.abs(saturate - 1) > 0.001) parts.push(`saturate(${Math.max(0, saturate).toFixed(3)})`);
  if (Math.abs(hue) > 0.01) parts.push(`hue-rotate(${hue.toFixed(1)}deg)`);
  if (sepia > 0.001) parts.push(`sepia(${sepia.toFixed(3)})`);
  if (grayscale > 0.001) parts.push(`grayscale(${grayscale.toFixed(3)})`);
  return parts.length ? parts.join(' ') : 'none';
}

/* ----------------------------------------------------------------------------------------------
 * EFEITOS DE VÍDEO
 * -------------------------------------------------------------------------------------------- */
export const EFFECT_CATEGORIES = ['Todos', 'Glitch', 'Zoom', 'Flash', 'Desfoque', 'Retrô', 'Luz'];

export const EFFECTS = [
  { id: 'glitch', name: 'Glitch Digital', category: 'Glitch', colors: ['#22d3ee', '#ec4899'] },
  { id: 'rgb-split', name: 'Separação RGB', category: 'Glitch', colors: ['#ef4444', '#3b82f6'] },
  { id: 'vhs', name: 'VHS', category: 'Glitch', colors: ['#64748b', '#a855f7'] },
  { id: 'pixelate', name: 'Pixelizar', category: 'Glitch', colors: ['#22c55e', '#0ea5e9'] },
  { id: 'zoom-pulse', name: 'Zoom Pulsante', category: 'Zoom', colors: ['#f97316', '#facc15'] },
  { id: 'shake', name: 'Tremor de Câmera', category: 'Zoom', colors: ['#f43f5e', '#f97316'] },
  { id: 'zoom-blur', name: 'Zoom Radial', category: 'Zoom', colors: ['#8b5cf6', '#22d3ee'] },
  { id: 'flash', name: 'Flash Branco', category: 'Flash', colors: ['#ffffff', '#cbd5e1'] },
  { id: 'strobe', name: 'Estroboscópio', category: 'Flash', colors: ['#fde047', '#ffffff'] },
  { id: 'blur', name: 'Desfoque Gaussiano', category: 'Desfoque', colors: ['#94a3b8', '#475569'] },
  { id: 'dreamy', name: 'Sonho (Glow)', category: 'Desfoque', colors: ['#f0abfc', '#a5b4fc'] },
  { id: 'film-grain', name: 'Granulado de Filme', category: 'Retrô', colors: ['#a8a29e', '#57534e'] },
  { id: 'old-film', name: 'Filme Antigo', category: 'Retrô', colors: ['#d6a35c', '#78350f'] },
  { id: 'vignette', name: 'Vinheta', category: 'Retrô', colors: ['#1f2937', '#000000'] },
  { id: 'light-leak', name: 'Vazamento de Luz', category: 'Luz', colors: ['#fb923c', '#f43f5e'] },
  { id: 'sparkle', name: 'Brilhos Bokeh', category: 'Luz', colors: ['#fde68a', '#f472b6'] },
  { id: 'mirror', name: 'Espelho', category: 'Luz', colors: ['#38bdf8', '#818cf8'] },
];

export const getEffect = (id) => EFFECTS.find((e) => e.id === id);

/* ----------------------------------------------------------------------------------------------
 * TRANSIÇÕES (aplicadas na entrada do clipe; o clipe anterior da trilha fica por baixo)
 * -------------------------------------------------------------------------------------------- */
export const TRANSITIONS = [
  { id: 'fade', name: 'Dissolver', category: 'Básico' },
  { id: 'black', name: 'Fade Preto', category: 'Básico' },
  { id: 'white-flash', name: 'Flash Branco', category: 'Dinâmico' },
  { id: 'slide-left', name: 'Deslizar ←', category: 'Movimento' },
  { id: 'slide-up', name: 'Deslizar ↑', category: 'Movimento' },
  { id: 'whip', name: 'Chicote (Whip Pan)', category: 'Dinâmico' },
  { id: 'zoom-in', name: 'Zoom In', category: 'Zoom' },
  { id: 'zoom-out', name: 'Zoom Out', category: 'Zoom' },
  { id: 'spin', name: 'Giro', category: 'Dinâmico' },
  { id: 'wipe', name: 'Cortina →', category: 'Movimento' },
  { id: 'circle', name: 'Íris Circular', category: 'Formas' },
  { id: 'glitch', name: 'Glitch', category: 'Dinâmico' },
  { id: 'blur', name: 'Desfoque', category: 'Básico' },
];

export const getTransition = (id) => TRANSITIONS.find((t) => t.id === id);

/* ----------------------------------------------------------------------------------------------
 * ANIMAÇÕES de clipe (entrada, saída e loop)
 * -------------------------------------------------------------------------------------------- */
export const ANIMATIONS = {
  in: [
    { id: 'fade-in', name: 'Aparecer' },
    { id: 'pop', name: 'Pop' },
    { id: 'zoom-in', name: 'Zoom In' },
    { id: 'zoom-out', name: 'Zoom Out' },
    { id: 'slide-up', name: 'Subir' },
    { id: 'slide-down', name: 'Descer' },
    { id: 'slide-left', name: 'Da Direita' },
    { id: 'slide-right', name: 'Da Esquerda' },
    { id: 'spin-in', name: 'Girar' },
    { id: 'blur-in', name: 'Desfoque' },
    { id: 'bounce', name: 'Quicar' },
    { id: 'drop', name: 'Cair' },
    { id: 'typewriter', name: 'Máquina de Escrever', textOnly: true },
    { id: 'wave', name: 'Onda (letras)', textOnly: true },
  ],
  out: [
    { id: 'fade-out', name: 'Sumir' },
    { id: 'pop-out', name: 'Pop Out' },
    { id: 'zoom-out-out', name: 'Afastar' },
    { id: 'slide-up-out', name: 'Sair p/ Cima' },
    { id: 'slide-down-out', name: 'Sair p/ Baixo' },
    { id: 'spin-out', name: 'Girar' },
    { id: 'blur-out', name: 'Desfoque' },
  ],
  loop: [
    { id: 'float', name: 'Flutuar' },
    { id: 'pulse', name: 'Pulsar' },
    { id: 'wiggle', name: 'Balançar' },
    { id: 'heartbeat', name: 'Batimento' },
    { id: 'shake', name: 'Tremer' },
  ],
};

/* ----------------------------------------------------------------------------------------------
 * ESTILOS DE TEXTO
 * -------------------------------------------------------------------------------------------- */
export const FONTS = ['Inter', 'Montserrat', 'Poppins', 'Bebas Neue', 'Space Grotesk', 'Bangers', 'Pacifico'];

export const TEXT_STYLES = [
  { id: 'classic', name: 'Clássico', style: { font: 'Inter', weight: 800, color: '#ffffff', stroke: 0, shadow: true } },
  { id: 'outline', name: 'Contorno', style: { font: 'Montserrat', weight: 900, color: '#ffffff', stroke: 6, strokeColor: '#000000', uppercase: true } },
  { id: 'neon', name: 'Neon', style: { font: 'Space Grotesk', weight: 700, color: '#f0abfc', glow: '#d946ef', stroke: 0 } },
  { id: 'box', name: 'Caixa', style: { font: 'Poppins', weight: 700, color: '#0a0a0a', bg: true, bgColor: '#facc15', stroke: 0 } },
  { id: 'impact', name: 'Impacto', style: { font: 'Bebas Neue', weight: 400, color: '#ffffff', stroke: 4, strokeColor: '#111827', uppercase: true, letterSpacing: 2 } },
  { id: 'gradient', name: 'Gradiente', style: { font: 'Montserrat', weight: 900, color: '#22d3ee', gradient: ['#22d3ee', '#a855f7'], stroke: 0, shadow: true } },
  { id: 'comic', name: 'Gibi', style: { font: 'Bangers', weight: 400, color: '#fde047', stroke: 6, strokeColor: '#1e1b4b', letterSpacing: 2 } },
  { id: 'script', name: 'Manuscrito', style: { font: 'Pacifico', weight: 400, color: '#ffffff', stroke: 0, shadow: true } },
  { id: 'minimal', name: 'Minimal', style: { font: 'Inter', weight: 500, color: '#e5e7eb', stroke: 0, letterSpacing: 4, uppercase: true } },
];

export const DEFAULT_TEXT_STYLE = {
  font: 'Inter',
  weight: 800,
  size: 64,
  color: '#ffffff',
  stroke: 0,
  strokeColor: '#000000',
  shadow: true,
  glow: null,
  bg: false,
  bgColor: '#000000',
  uppercase: false,
  letterSpacing: 0,
  align: 'center',
  gradient: null,
  highlightColor: '#facc15',
};

/* Estilos de legenda automática */
export const CAPTION_PRESETS = [
  { id: 'tiktok', name: 'TikTok Pop', desc: 'Caixa alta, contorno, palavra atual em amarelo com pop', style: { font: 'Montserrat', weight: 900, size: 58, color: '#ffffff', stroke: 7, strokeColor: '#000000', uppercase: true, highlightColor: '#facc15', shadow: true }, highlight: 'pop' },
  { id: 'karaoke', name: 'Karaokê', desc: 'Preenchimento progressivo palavra por palavra', style: { font: 'Poppins', weight: 900, size: 52, color: '#ffffff', stroke: 5, strokeColor: '#1e1b4b', highlightColor: '#22d3ee', shadow: true }, highlight: 'fill' },
  { id: 'boxed', name: 'Reels Box', desc: 'Palavra atual dentro de uma caixa colorida', style: { font: 'Inter', weight: 800, size: 50, color: '#ffffff', stroke: 0, highlightColor: '#a855f7', shadow: true }, highlight: 'box' },
  { id: 'minimal', name: 'Minimal', desc: 'Limpo e elegante, destaque sutil', style: { font: 'Inter', weight: 600, size: 44, color: '#f1f5f9', stroke: 0, highlightColor: '#fde68a', shadow: true }, highlight: 'color' },
];
