/**
 * Interpreta o prompt livre do usuário ("Gere um motion estilo minimalista futurista para a fala atual")
 * em parâmetros estruturados para o gerador de motions.
 * Para usar um LLM real, substitua parsePrompt por uma chamada que retorne o mesmo formato.
 */
import { normalizeWord } from '../lib/utils';
import { STYLE_LIST } from '../engine/motionStyles';
import { matchWord } from './lexicon';

const COLORS = {
  azul: '#3b82f6', vermelho: '#ef4444', verde: '#22c55e', roxo: '#a855f7', violeta: '#8b5cf6', rosa: '#ec4899',
  amarelo: '#facc15', dourado: '#fbbf24', ouro: '#fbbf24', laranja: '#f97316', branco: '#f8fafc', ciano: '#22d3ee', turquesa: '#14b8a6',
};

export function parsePrompt(text = '') {
  const raw = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const words = raw.split(/[^a-z0-9]+/).filter(Boolean).map(normalizeWord);
  const has = (re) => re.test(raw);

  const styleIds = [];
  for (const st of STYLE_LIST) {
    if (st.words.some((w) => words.includes(w))) styleIds.push(st.id);
  }

  let scope = 'all';
  if (has(/fala atual|nesta fala|nessa fala|essa fala|esta fala|neste trecho|nesse trecho|trecho atual|momento atual|aqui agora|playhead/)) scope = 'current';
  else if (has(/clipe selecionado|selecionado|selecao/)) scope = 'selection';

  const categories = { sticker: true, typography: true, camera: true, transition: true, sfx: true };
  if (has(/(apenas|somente|so) (texto|textos|tipografia|letras)/)) Object.assign(categories, { sticker: false, camera: false, transition: false, sfx: false });
  if (has(/(apenas|somente|so) (sticker|stickers|grafico|graficos|emoji)/)) Object.assign(categories, { typography: false, camera: false, transition: false });
  if (has(/(apenas|somente|so) (zoom|zooms|camera)/)) Object.assign(categories, { sticker: false, typography: false, transition: false, sfx: false });
  if (has(/sem (zoom|zooms|camera|movimento)/)) categories.camera = false;
  if (has(/sem (transic|flash|glitch)/)) categories.transition = false;
  if (has(/sem (sticker|emoji|grafico|desenho)/)) categories.sticker = false;
  if (has(/sem (texto|tipografia|letreiro)/)) categories.typography = false;
  if (has(/sem (som|sons|sfx|efeito sonoro|efeitos sonoros|audio)/)) categories.sfx = false;

  let intensity = 1;
  if (has(/sutil|suave|leve|discret|delicad|calm/)) intensity = 0.55;
  if (has(/intens|explosiv|forte|agressiv|maximo|energetic|insano|exagerad/)) intensity = 1.4;

  let color = null;
  for (const [name, hex] of Object.entries(COLORS)) if (words.includes(name)) color = hex;

  const forcedTemplates = [];
  for (const w of words) {
    const e = matchWord(w);
    if (e && !forcedTemplates.includes(e.template)) forcedTemplates.push(e.template);
  }
  if (has(/moeda/) && !forcedTemplates.includes('coins')) forcedTemplates.push('coins');

  const chips = [];
  if (styleIds.length) chips.push({ k: 'Estilo', v: styleIds.map((id) => STYLE_LIST.find((s) => s.id === id).name).join(' + ') });
  chips.push({ k: 'Escopo', v: scope === 'current' ? 'Fala atual' : scope === 'selection' ? 'Clipe selecionado' : 'Vídeo inteiro' });
  if (intensity !== 1) chips.push({ k: 'Intensidade', v: intensity < 1 ? 'Sutil' : 'Intensa' });
  if (color) chips.push({ k: 'Cor', v: color });
  if (forcedTemplates.length) chips.push({ k: 'Elementos', v: forcedTemplates.join(', ') });
  const off = Object.entries(categories).filter(([, v]) => !v).map(([k]) => k);
  if (off.length) chips.push({ k: 'Sem', v: off.join(', ') });

  return { styleIds, scope, categories, intensity, color, forcedTemplates, chips };
}
