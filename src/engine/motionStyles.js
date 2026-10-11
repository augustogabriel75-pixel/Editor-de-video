/**
 * Estilos visuais do motor IA Motion. O parser de prompt (src/ai/promptParser.js)
 * combina estes estilos a partir do texto que o usuário escreve.
 */
export const MOTION_STYLES = {
  vibrante: {
    id: 'vibrante',
    name: 'Vibrante',
    words: ['vibrante', 'colorido', 'divertido', 'alegre', 'padrao'],
    primary: '#facc15',
    secondary: '#ec4899',
    accent: '#22d3ee',
    text: '#ffffff',
    font: 'Montserrat',
    weight: 900,
    glow: false,
    outline: true,
    flat: false,
    density: 1,
    typography: 'kinetic-pop',
    transition: 'flash',
  },
  minimalista: {
    id: 'minimalista',
    name: 'Minimalista',
    words: ['minimalista', 'minimal', 'minimalismo', 'clean', 'limpo', 'simples', 'sutil', 'elegante'],
    primary: '#f8fafc',
    secondary: '#94a3b8',
    accent: '#e2e8f0',
    text: '#ffffff',
    font: 'Inter',
    weight: 500,
    glow: false,
    outline: false,
    flat: true,
    density: 0.45,
    typography: 'minimal-line',
    transition: 'light-sweep',
  },
  futurista: {
    id: 'futurista',
    name: 'Futurista',
    words: ['futurista', 'futuro', 'tech', 'tecnologico', 'tecnologia', 'holografico', 'sci', 'scifi', 'hud', 'digital'],
    primary: '#22d3ee',
    secondary: '#818cf8',
    accent: '#a5f3fc',
    text: '#ecfeff',
    font: 'Space Grotesk',
    weight: 700,
    glow: true,
    outline: false,
    flat: true,
    density: 0.8,
    typography: 'glitch-type',
    transition: 'glitch-hit',
  },
  neon: {
    id: 'neon',
    name: 'Neon',
    words: ['neon', 'cyberpunk', 'noturno', 'balada', 'synthwave'],
    primary: '#f0abfc',
    secondary: '#22d3ee',
    accent: '#d946ef',
    text: '#fdf4ff',
    font: 'Space Grotesk',
    weight: 700,
    glow: true,
    outline: false,
    flat: true,
    density: 0.9,
    typography: 'neon-sign',
    transition: 'glitch-hit',
  },
  retro: {
    id: 'retro',
    name: 'Retrô',
    words: ['retro', 'vintage', 'anos', '80', '90', 'nostalgico', 'antigo'],
    primary: '#fb923c',
    secondary: '#14b8a6',
    accent: '#fde68a',
    text: '#fff7ed',
    font: 'Bebas Neue',
    weight: 400,
    glow: false,
    outline: true,
    flat: false,
    density: 0.85,
    typography: 'slide-stack',
    transition: 'zoom-blur',
  },
  cartoon: {
    id: 'cartoon',
    name: 'Cartoon',
    words: ['cartoon', 'desenho', 'gibi', 'quadrinhos', 'fofo', 'infantil', 'engracado'],
    primary: '#fde047',
    secondary: '#fb7185',
    accent: '#60a5fa',
    text: '#ffffff',
    font: 'Bangers',
    weight: 400,
    glow: false,
    outline: true,
    flat: false,
    density: 1.2,
    typography: 'kinetic-pop',
    transition: 'flash',
  },
  luxo: {
    id: 'luxo',
    name: 'Luxo',
    words: ['luxo', 'luxuoso', 'premium', 'dourado', 'sofisticado', 'rico', 'gold'],
    primary: '#fbbf24',
    secondary: '#fef3c7',
    accent: '#d97706',
    text: '#fffbeb',
    font: 'Poppins',
    weight: 700,
    glow: true,
    outline: false,
    flat: false,
    density: 0.7,
    typography: 'minimal-line',
    transition: 'light-sweep',
  },
  cinematografico: {
    id: 'cinematografico',
    name: 'Cinematográfico',
    words: ['cinematografico', 'cinema', 'filme', 'epico', 'dramatico', 'trailer'],
    primary: '#fde68a',
    secondary: '#f97316',
    accent: '#fef3c7',
    text: '#ffffff',
    font: 'Bebas Neue',
    weight: 400,
    glow: false,
    outline: false,
    flat: false,
    density: 0.6,
    typography: 'slide-stack',
    transition: 'zoom-blur',
  },
};

export const STYLE_LIST = Object.values(MOTION_STYLES);

export const getStyle = (id) => MOTION_STYLES[id] || MOTION_STYLES.vibrante;

/** Combina estilos (ex.: "minimalista futurista"): cores do último, densidade mínima. */
export function mergeStyles(ids, overrides = {}) {
  const list = (ids && ids.length ? ids : ['vibrante']).map(getStyle);
  const base = { ...list[list.length - 1] };
  if (list.length > 1) {
    base.id = list.map((s) => s.id).join('+');
    base.name = list.map((s) => s.name).join(' + ');
    base.density = Math.min(...list.map((s) => s.density));
    base.flat = list.some((s) => s.flat);
    if (list.some((s) => s.id === 'minimalista')) {
      base.typography = 'minimal-line';
      base.weight = Math.min(base.weight, 600);
      base.outline = false;
    }
  }
  return { ...base, ...overrides };
}
