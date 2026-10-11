/**
 * Léxico contextual pt-BR: mapeia palavras faladas -> motion visual.
 * Funciona por radicais (stems) sobre texto normalizado (sem acento, minúsculo).
 */
import { normalizeWord } from '../lib/utils';

export const LEXICON = [
  { template: 'coins', label: 'Dinheiro', topic: 'Finanças', sfx: 'cash', stems: ['dinheir', 'grana', 'lucr', 'riquez', 'renda', 'salari', 'pagament', 'faturament', 'dolar', 'money', 'investiment', 'economiz', 'moeda', 'valios'], exact: ['rico', 'rica', 'real', 'reais', 'pix', 'caro'] },
  { template: 'rocket', label: 'Decolando', topic: 'Crescimento', sfx: 'whoosh', stems: ['foguet', 'decol', 'lancament', 'acelera', 'disparar', 'dispar', 'explod', 'rapid', 'turbin'], exact: ['lancar'] },
  { template: 'hearts', label: 'Amor', topic: 'Emoção', sfx: 'pop', stems: ['amor', 'coracao', 'paixao', 'apaixon', 'carinho', 'adoro'], exact: ['ama', 'amo', 'amar', 'amam', 'amei'] },
  { template: 'lightbulb', label: 'Ideia', topic: 'Criatividade', sfx: 'ding', stems: ['ideia', 'insight', 'inovac', 'inovar', 'solucao', 'inspira', 'genial'] },
  { template: 'chart-up', label: 'Crescimento', topic: 'Negócios', sfx: 'riser', stems: ['cresc', 'vendas', 'numeros', 'resultado', 'aument', 'metrica', 'subiram', 'subir', 'escalar', 'alta'], exact: ['venda', 'numero'] },
  { template: 'clock', label: 'Tempo', topic: 'Produtividade', sfx: 'click', stems: ['tempo', 'minuto', 'prazo', 'relogio', 'segundos', 'horario'], exact: ['hora', 'horas'] },
  { template: 'trophy', label: 'Sucesso', topic: 'Conquista', sfx: 'ding', stems: ['sucess', 'vitori', 'vencer', 'venceu', 'conquist', 'campea', 'premio', 'trofeu', 'inevitavel'] },
  { template: 'fire', label: 'Em alta', topic: 'Tendência', sfx: 'whoosh', stems: ['fogo', 'viral', 'quente', 'bombando', 'hype', 'incendi'] },
  { template: 'sparkles', label: 'Criatividade', topic: 'Criatividade', sfx: 'ding', stems: ['criativ', 'magia', 'magic', 'brilh', 'especial', 'incrivel', 'surpreend'] },
  { template: 'target', label: 'Foco', topic: 'Estratégia', sfx: 'whoosh', stems: ['foco', 'focar', 'focad', 'objetiv', 'alvo', 'estrateg', 'precis'], exact: ['meta', 'metas'] },
  { template: 'subscribe', label: 'Siga', topic: 'Engajamento', sfx: 'click', stems: ['segue', 'seguir', 'sigam', 'inscrev', 'curtiu', 'curta', 'compartilh'], exact: ['siga', 'like'] },
  { template: 'globe', label: 'Internet', topic: 'Digital', sfx: 'whoosh', stems: ['internet', 'online', 'mundo', 'global', 'digital', 'site'], exact: ['rede', 'redes'] },
  { template: 'warning', label: 'Atenção', topic: 'Alerta', sfx: 'pop', stems: ['cuidado', 'atencao', 'alerta', 'perig', 'evite', 'nunca'], exact: ['erro', 'erros'] },
  { template: 'people', label: 'Público', topic: 'Audiência', sfx: 'pop', stems: ['publico', 'pessoas', 'audiencia', 'cliente', 'comunidad', 'seguidor'], exact: ['gente'] },
  { template: 'check', label: 'Consistência', topic: 'Método', sfx: 'ding', stems: ['consisten', 'garant', 'funciona', 'facil'], exact: ['certo', 'pronto'] },
];

/** Encontra a entrada do léxico para uma palavra (ou null). */
export function matchWord(word) {
  const n = normalizeWord(word);
  if (n.length < 2) return null;
  for (const e of LEXICON) {
    if (e.exact?.includes(n)) return e;
    if (e.stems.some((s) => n.startsWith(s))) return e;
  }
  return null;
}

export const templateEntry = (templateId) => LEXICON.find((e) => e.template === templateId);
