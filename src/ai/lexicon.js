/**
 * Léxico contextual pt-BR: mapeia palavras faladas -> motion visual.
 * Funciona por radicais (stems) sobre texto normalizado (sem acento, minúsculo).
 */
import { normalizeWord } from '../lib/utils';

export const LEXICON = [
  { template: 'coins', label: 'Dinheiro', topic: 'Finanças', sfx: 'cash', stems: ['dinheir', 'grana', 'lucr', 'riquez', 'renda', 'salari', 'pagament', 'faturament', 'dolar', 'money', 'investiment', 'investi', 'economiz', 'moeda', 'valios', 'preco', 'barat', 'descont', 'ofert', 'promoc', 'compr', 'pagar', 'custo', 'bitcoin', 'cripto', 'banco', 'cartao', 'divida', 'milion', 'bilion', 'mil reais'], exact: ['rico', 'rica', 'real', 'reais', 'pix', 'caro', 'cara', 'grátis', 'gratis'] },
  { template: 'rocket', label: 'Decolando', topic: 'Crescimento', sfx: 'whoosh', stems: ['foguet', 'decol', 'lancament', 'acelera', 'dispar', 'explod', 'rapid', 'turbin', 'velocid', 'voar', 'voando', 'espacial'], exact: ['lancar', 'subir'] },
  { template: 'hearts', label: 'Amor', topic: 'Emoção', sfx: 'pop', stems: ['amor', 'coracao', 'paixao', 'apaixon', 'carinho', 'adoro', 'familia', 'amig', 'namor', 'casament', 'filh', 'bebe', 'saudade', 'gratid', 'abraco', 'beijo', 'feliz', 'felicid'], exact: ['ama', 'amo', 'amar', 'amam', 'amei', 'mae', 'pai'] },
  { template: 'lightbulb', label: 'Ideia', topic: 'Criatividade', sfx: 'ding', stems: ['ideia', 'insight', 'inovac', 'inovar', 'solucao', 'inspira', 'genial', 'aprend', 'ensin', 'descobr', 'truque', 'hack', 'segred', 'entend', 'pensa', 'conhecimento', 'estud'] },
  { template: 'chart-up', label: 'Crescimento', topic: 'Negócios', sfx: 'riser', stems: ['cresc', 'vendas', 'numeros', 'resultado', 'aument', 'metrica', 'subiram', 'escalar', 'negoci', 'empres', 'empreend', 'cliente', 'mercado', 'marketing', 'estatistic', 'porcent', 'lucrativ', 'faturar'], exact: ['venda', 'numero', 'alta'] },
  { template: 'clock', label: 'Tempo', topic: 'Produtividade', sfx: 'click', stems: ['tempo', 'minuto', 'prazo', 'relogio', 'segundos', 'horario', 'rotina', 'agenda', 'atrasad', 'pontual', 'madrugad', 'amanha'], exact: ['hora', 'horas', 'cedo', 'tarde'] },
  { template: 'trophy', label: 'Sucesso', topic: 'Conquista', sfx: 'ding', stems: ['sucess', 'vitori', 'vencer', 'venceu', 'conquist', 'campea', 'premio', 'trofeu', 'inevitavel', 'recorde', 'ganhei', 'ganhou', 'vencedor', 'medalha', 'conseg'] },
  { template: 'fire', label: 'Em alta', topic: 'Tendência', sfx: 'whoosh', stems: ['fogo', 'viral', 'quente', 'bombando', 'hype', 'incendi', 'treino', 'academia', 'calor', 'pimenta', 'churrasc', 'novidade', 'tendenc', 'polemic', 'insano', 'absurdo'], exact: ['top'] },
  { template: 'sparkles', label: 'Uau', topic: 'Criatividade', sfx: 'ding', stems: ['criativ', 'magia', 'magic', 'brilh', 'especial', 'incrivel', 'surpreend', 'maravilh', 'lind', 'bonit', 'sonho', 'transform', 'beleza', 'maquiag', 'estilo'], exact: ['uau', 'nossa'] },
  { template: 'target', label: 'Foco', topic: 'Estratégia', sfx: 'whoosh', stems: ['foco', 'focar', 'focad', 'objetiv', 'alvo', 'estrateg', 'precis', 'plano', 'planej', 'desafio', 'disciplin', 'decid'], exact: ['meta', 'metas'] },
  { template: 'subscribe', label: 'Siga', topic: 'Engajamento', sfx: 'click', stems: ['segue', 'seguir', 'sigam', 'inscrev', 'curtiu', 'curta', 'compartilh', 'comenta', 'canal', 'notificac', 'sininho', 'descricao'], exact: ['siga', 'like', 'link'] },
  { template: 'globe', label: 'Mundo', topic: 'Digital', sfx: 'whoosh', stems: ['internet', 'online', 'mundo', 'global', 'digital', 'site', 'viag', 'pais', 'cidade', 'turism', 'aeroport', 'praia', 'europa', 'brasil', 'internacional', 'aplicativo', 'celular', 'tecnolog', 'computador'], exact: ['rede', 'redes', 'app'] },
  { template: 'warning', label: 'Atenção', topic: 'Alerta', sfx: 'pop', stems: ['cuidado', 'atencao', 'alerta', 'perig', 'evite', 'nunca', 'problema', 'risco', 'golpe', 'fraude', 'proibid', 'urgente', 'importante'], exact: ['erro', 'erros', 'pare'] },
  { template: 'people', label: 'Galera', topic: 'Audiência', sfx: 'pop', stems: ['publico', 'pessoas', 'audiencia', 'cliente', 'comunidad', 'seguidor', 'galera', 'pessoal', 'turma', 'equipe', 'inscrito', 'todo mundo'], exact: ['gente', 'voces', 'time'] },
  { template: 'check', label: 'Dica', topic: 'Método', sfx: 'ding', stems: ['consisten', 'garant', 'funciona', 'facil', 'dica', 'passo', 'lista', 'feito', 'simples', 'pratic', 'tutorial', 'resolv', 'certeza'], exact: ['certo', 'pronto', 'primeiro', 'segundo', 'terceiro'] },
  { template: 'music', label: 'Música', topic: 'Música', sfx: 'ding', stems: ['music', 'cancao', 'cantar', 'canto', 'danc', 'batida', 'ritmo', 'festa', 'balada', 'playlist', 'album', 'guitarr', 'violao', 'piano'], exact: ['som', 'show', 'dj'] },
  { template: 'question', label: 'Pergunta', topic: 'Curiosidade', sfx: 'pop', stems: ['pergunt', 'duvid', 'misteri', 'curios', 'sabia', 'imagin', 'porque', 'resposta'] },
  { template: 'lightning', label: 'Energia', topic: 'Energia', sfx: 'whoosh', stems: ['energi', 'forte', 'poder', 'potenc', 'turbo', 'choque', 'eletric', 'bateria', 'intens', 'explosiv', 'motiva'] },
  { template: 'thumbs-up', label: 'Aprovado', topic: 'Opinião', sfx: 'pop', stems: ['otimo', 'legal', 'gostei', 'recomend', 'aprov', 'perfeit', 'excelent', 'show de bola', 'massa', 'demais', 'bacana', 'maneiro'], exact: ['bom', 'boa', 'joia', 'ok'] },
  { template: 'stars', label: 'Nota 10', topic: 'Avaliação', sfx: 'ding', stems: ['estrela', 'avalia', 'nota', 'melhor', 'qualidade', 'premium', 'famos', 'review', 'analise', 'classific'] },
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
