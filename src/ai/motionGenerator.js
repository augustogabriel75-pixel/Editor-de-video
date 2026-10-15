/**
 * Gerador de Motions contextuais.
 * Recebe a análise (transcrição, palavras-chave, batidas, ênfase, cenas) + prompt interpretado
 * e devolve especificações de clipes para as trilhas de IA Motion e SFX.
 */
import { clamp, formatTime } from '../lib/utils';
import { mergeStyles } from '../engine/motionStyles';
import { getTemplate } from '../engine/motionTemplates';
import { templateEntry } from './lexicon';

export const AI_LANES = { sticker: 'trk-ai-sticker', typography: 'trk-ai-typo', camera: 'trk-ai-camera', transition: 'trk-ai-camera', sfx: 'trk-sfx' };

const SFX_OFFSET = { cash: 0.3, whoosh: -0.05, ding: 0.35, pop: 0.05, click: 0.9, riser: -0.2 };

function autoStyle(analysis) {
  if (analysis.topics?.includes('Finanças') || analysis.topics?.includes('Negócios')) return ['vibrante'];
  if (analysis.mood?.startsWith('Calmo') && !analysis.mood?.includes('Noturno')) return ['minimalista'];
  if (analysis.mood?.includes('Noturno')) return ['neon'];
  return ['vibrante'];
}

const capitalize = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);

const STOP = new Set(['e', 'o', 'a', 'os', 'as', 'de', 'do', 'da', 'com', 'na', 'no', 'em', 'um', 'uma', 'que', 'para', 'mas', 'se', 'te', 'eu', 'seu', 'sua', 'mais', 'como', 'por']);
const isStop = (w) => STOP.has(w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, ''));

function phraseFor(sentence, kws) {
  let words = sentence.words.map((w) => w.w);
  if (words.length > 7) {
    const top = kws[0] ? Math.max(0, sentence.words.findIndex((w) => w.start === kws[0].t)) : 0;
    const a = clamp(top - 3, 0, words.length - 6);
    words = words.slice(a, a + 6);
  }
  while (words.length > 2 && isStop(words[words.length - 1])) words.pop();
  while (words.length > 2 && isStop(words[0]) && !/[A-ZÀ-Ú]/.test(words[0][0])) words.shift();
  return words.join(' ').replace(/[.!?:;,]+$/, '');
}

function resolveLane(items, lane) {
  const list = items.filter((i) => i.lane === lane).sort((a, b) => a.start - b.start);
  const keep = [];
  for (const it of list) {
    const prev = keep[keep.length - 1];
    if (!prev || lane === 'sfx' || it.start >= prev.start + prev.duration) {
      keep.push(it);
      continue;
    }
    const gap = it.start - prev.start;
    if (lane === 'camera') {
      if ((it.priority || 0) > (prev.priority || 0) && gap >= 0.4) {
        prev.duration = gap - 0.02;
        keep.push(it);
      } else {
        const ns = prev.start + prev.duration + 0.02;
        const shrink = ns - it.start;
        if (it.duration - shrink >= 0.35) {
          it.start = ns;
          it.duration -= shrink;
          keep.push(it);
        }
      }
    } else if (gap >= 1) {
      prev.duration = gap - 0.05;
      keep.push(it);
    }
  }
  return keep;
}

/**
 * @param analysis  saída de analyzeContext
 * @param opts      { options, spec (parsePrompt), aspect, mainClips, range }
 */
export function generateMotions(analysis, opts) {
  const { options, spec, aspect = '16:9', mainClips = [], range = null } = opts;
  const cats = {
    sticker: options.stickers && spec.categories.sticker,
    typography: options.typography && spec.categories.typography,
    camera: options.camera && spec.categories.camera,
    transition: options.transitions && spec.categories.transition,
    sfx: options.sfx && spec.categories.sfx,
  };
  const styleIds = spec.styleIds.length ? spec.styleIds : options.styleId && options.styleId !== 'auto' ? [options.styleId] : autoStyle(analysis);
  const style = mergeStyles(styleIds);
  const k = (options.intensity / 70) * spec.intensity;
  const intensity = Math.round(clamp(70 * k, 15, 140));
  const portrait = aspect === '9:16' || aspect === '4:5';
  const inRange = (t) => !range || (t >= range.start - 0.05 && t <= range.end + 0.05);
  const focusX = analysis.frames?.focusX ?? 0.5;
  const focusY = clamp(analysis.frames?.focusY ?? 0.45, 0.3, 0.6);
  const items = [];
  const motion = (extra) => ({ styleIds, color: spec.color, intensity, prompt: options.prompt, generatedAt: Date.now(), params: { focusX, focusY }, ...extra });

  /* --- Stickers & tipografia (falas com palavras-chave) --- */
  let stickerN = 0;
  let plainN = 0;
  const recent = [];
  const sentences = analysis.transcript.sentences.filter((s) => !range || (s.end >= range.start && s.start <= range.end));
  sentences.forEach((s) => {
    let kws = analysis.keywords.filter((kw) => kw.sentence === s.index && inRange(kw.t)).sort((a, b) => b.emphasis - a.emphasis || a.t - b.t);
    const forced = spec.forcedTemplates.map((tpl, j) => {
      const e = templateEntry(tpl);
      return { template: tpl, t: s.start + 0.25 + j * 0.7, word: e?.label || tpl, label: e?.label, sfx: e?.sfx, emphasis: 1, forced: true };
    });
    if (forced.length && range) kws = forced;
    const maxPicks = k > 1.25 ? 2 : 1 + (s.end - s.start > 3.2 && k > 0.9 ? 1 : 0);
    const picks = [];
    for (const kw of kws) {
      if (picks.length >= maxPicks) break;
      if (picks.some((p) => p.template === kw.template || Math.abs(p.t - kw.t) < 1.5)) continue;
      if (!kw.forced && recent.some((r) => r.template === kw.template && Math.abs(r.t - kw.t) < 6)) continue;
      picks.push(kw);
    }
    // Frase sem palavra-chave do léxico: sticker genérico pelo tom da frase (pergunta, exclamação, números).
    if (!picks.length && cats.sticker) {
      const top = [...s.words].sort((a, b) => (b.emphasis ?? 0) - (a.emphasis ?? 0))[0];
      const at = top ? top.start : s.start + 0.2;
      const generic = /\?\s*$/.test(s.text) ? 'question' : /!\s*$/.test(s.text) ? (k > 1 ? 'lightning' : 'fire') : /\d/.test(s.text) ? 'chart-up' : range || plainN % 3 === 2 ? 'sparkles' : null;
      if (generic && !recent.some((r) => r.template === generic && Math.abs(r.t - at) < 6)) {
        const e = templateEntry(generic);
        picks.push({ template: generic, t: at, word: null, sfx: e?.sfx || 'pop', emphasis: top?.emphasis ?? 0.6, generic: true, label: null });
      }
    }
    if (!kws.length) plainN++;
    const enoughWords = s.words.length >= 3;
    const useTypo = cats.typography && enoughWords && (!cats.sticker || !picks.length || s.index % 2 === 1 || k > 1.25 || !!range || (!kws.length && plainN % 2 === 1));
    const useSticker = cats.sticker && picks.length && (!useTypo || k > 1.25 || !!range || !cats.typography || !kws.length);
    if (!useSticker && !useTypo) return;
    // destaques da tipografia: palavras-chave ou, sem elas, as palavras mais enfatizadas da fala
    const highlightWords = kws.length
      ? kws.map((kw) => kw.norm).filter(Boolean)
      : [...s.words]
          .filter((w) => w.norm && w.norm.length >= 4 && !isStop(w.w))
          .sort((a, b) => (b.emphasis ?? 0) - (a.emphasis ?? 0))
          .slice(0, 2)
          .map((w) => w.norm);

    if (useSticker) {
      picks.forEach((kw) => {
        recent.push(kw);
        const tpl = getTemplate(kw.template);
        const side = stickerN++ % 2 === 0 ? (focusX < 0.42 ? 1 : -1) : focusX < 0.42 ? -1 : 1;
        const start = Math.max(0, kw.t - 0.15);
        items.push({
          lane: 'sticker',
          priority: 2,
          start,
          duration: 2.4,
          name: tpl.name,
          transform: portrait ? { x: side * 0.16, y: -0.27, scale: 1.05, rotation: 0, opacity: 1 } : { x: side * 0.31, y: 0.02, scale: 1, rotation: 0, opacity: 1 },
          motion: motion({
            templateId: kw.template,
            category: 'sticker',
            keyword: kw.word,
            label: kw.word ? capitalize(kw.word) : null,
            reason: kw.forced ? `Pedido no prompt: “${kw.word}”` : kw.generic ? `Tom da fala (${s.text.trim().slice(-1) === '?' ? 'pergunta' : s.text.trim().slice(-1) === '!' ? 'exclamação' : 'ênfase'}) em ${formatTime(kw.t)}` : `Palavra-chave “${kw.word}” falada em ${formatTime(kw.t)}`,
            confidence: clamp(0.8 + 0.17 * (kw.emphasis ?? 0.5), 0.5, 0.99),
          }),
        });
        if (cats.sfx && kw.sfx) {
          items.push({ lane: 'sfx', start: Math.max(0, start + (SFX_OFFSET[kw.sfx] ?? 0)), assetId: `sfx-${kw.sfx}`, name: `SFX · ${kw.sfx}` });
        }
      });
    }
    if (useTypo) {
      const text = phraseFor(s, kws);
      items.push({
        lane: 'typography',
        priority: 1,
        start: Math.max(0, s.start - 0.1),
        duration: Math.max(1.8, s.end - s.start + 0.45),
        name: `Tipografia · ${text.split(' ').slice(0, 3).join(' ')}…`,
        transform: { x: 0, y: portrait ? -0.33 : -0.31, scale: portrait ? 1.1 : 1, rotation: 0, opacity: 1 },
        motion: motion({
          templateId: style.typography,
          category: 'typography',
          text,
          highlights: highlightWords,
          reason: kws.length ? `Frase-chave com ${kws.length} destaque(s): ${kws.map((x) => x.word).join(', ')}` : `Frase de destaque da fala (ênfase da voz) em ${formatTime(s.start)}`,
          confidence: clamp(0.78 + 0.05 * kws.length, 0.5, 0.97),
        }),
      });
    }
  });

  /* --- Sem fala: título de abertura, destaques no ritmo e chamada final --- */
  if (!analysis.transcript.words.length) {
    const dur = analysis.duration;
    const title = (opts.title || '').trim();
    if (cats.typography && title && inRange(0.3)) {
      items.push({
        lane: 'typography',
        priority: 1,
        start: 0.3,
        duration: Math.min(3.2, Math.max(1.8, dur * 0.3)),
        name: `Título · ${title.split(' ').slice(0, 3).join(' ')}`,
        transform: { x: 0, y: portrait ? -0.3 : -0.28, scale: portrait ? 1.1 : 1, rotation: 0, opacity: 1 },
        motion: motion({
          templateId: style.typography,
          category: 'typography',
          text: title,
          highlights: title.split(/\s+/).filter((w) => w.length >= 5 && !isStop(w)).slice(0, 2).map((w) => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')),
          reason: 'Título de abertura (vídeo sem fala)',
          confidence: 0.8,
        }),
      });
    }
    if (cats.sticker) {
      const pool = style.flat ? ['sparkles', 'lightning', 'stars'] : ['sparkles', 'fire', 'lightning', 'stars', 'music'];
      const strong = [...(analysis.beats || [])].filter((b) => inRange(b.t) && b.t > 3.6 && b.t < dur - 4).sort((a, b) => b.strength - a.strength);
      const chosen = [];
      for (const b of strong) {
        if (chosen.length >= Math.max(1, Math.round((dur / 8) * k))) break;
        if (chosen.some((c) => Math.abs(c.t - b.t) < 5)) continue;
        chosen.push(b);
      }
      chosen.sort((a, b) => a.t - b.t).forEach((b, i) => {
        const tplId = pool[i % pool.length];
        const side = i % 2 === 0 ? 1 : -1;
        items.push({
          lane: 'sticker',
          priority: 2,
          start: Math.max(0, b.t - 0.05),
          duration: 1.8,
          name: getTemplate(tplId).name,
          transform: portrait ? { x: side * 0.16, y: -0.27, scale: 1, rotation: 0, opacity: 1 } : { x: side * 0.3, y: 0.02, scale: 0.95, rotation: 0, opacity: 1 },
          motion: motion({ templateId: tplId, category: 'sticker', label: null, reason: `Destaque na batida forte (${formatTime(b.t)})`, confidence: 0.72 }),
        });
      });
      if (dur > 8 && inRange(dur - 3)) {
        items.push({
          lane: 'sticker',
          priority: 3,
          start: Math.max(0, dur - 3.2),
          duration: 2.8,
          name: getTemplate('subscribe').name,
          transform: portrait ? { x: 0, y: 0.18, scale: 1, rotation: 0, opacity: 1 } : { x: 0.28, y: 0.22, scale: 0.9, rotation: 0, opacity: 1 },
          motion: motion({ templateId: 'subscribe', category: 'sticker', label: null, reason: 'Chamada para ação no final do vídeo', confidence: 0.8 }),
        });
      }
    }
  }

  /* --- Transições dinâmicas (cortes + batidas) --- */
  const transitionTimes = [];
  if (cats.transition) {
    const cuts = [];
    mainClips.slice(1).forEach((c) => cuts.push({ t: c.start, reason: 'Corte entre clipes' }));
    (analysis.scenes || []).forEach((sc) => {
      if (!cuts.some((c) => Math.abs(c.t - sc.t) < 0.6)) cuts.push({ t: sc.t, reason: sc.reason });
    });
    cuts.filter((c) => inRange(c.t)).forEach((c) => {
      const beat = (analysis.beats || []).find((b) => Math.abs(b.t - c.t) < 0.3);
      transitionTimes.push(c.t);
      items.push({
        lane: 'camera',
        priority: 3,
        start: Math.max(0, c.t - 0.18),
        duration: 0.5,
        name: getTemplate(style.transition).name,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        motion: motion({
          templateId: style.transition,
          category: 'transition',
          reason: `${c.reason}${beat ? ' sincronizado com a batida' : ''} em ${formatTime(c.t)}`,
          confidence: beat ? 0.95 : 0.86,
        }),
      });
      if (cats.sfx) items.push({ lane: 'sfx', start: Math.max(0, c.t - 0.35), assetId: 'sfx-whoosh', name: 'SFX · whoosh' });
    });
    const maxBeats = Math.round(4 * k);
    const strong = [...(analysis.beats || [])].filter((b) => inRange(b.t) && b.strength > 0.55).sort((a, b) => b.strength - a.strength);
    const chosen = [];
    for (const b of strong) {
      if (chosen.length >= maxBeats) break;
      if (chosen.some((c) => Math.abs(c.t - b.t) < 3.2) || transitionTimes.some((t) => Math.abs(t - b.t) < 1.6)) continue;
      chosen.push(b);
    }
    chosen.forEach((b) => {
      const tpl = style.glow ? 'rgb-pulse' : 'beat-pulse';
      items.push({
        lane: 'camera',
        priority: 2,
        start: Math.max(0, b.t - 0.04),
        duration: 0.34,
        name: getTemplate(tpl).name,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        motion: motion({ templateId: tpl, category: 'transition', reason: `Batida forte da música (${Math.round(b.strength * 100)}%)${analysis.bpm ? ` · ${analysis.bpm} BPM` : ''}`, confidence: 0.75 + 0.2 * b.strength }),
      });
    });
  }

  /* --- Câmera automática (ênfase da fala) --- */
  if (cats.camera) {
    const cands = [];
    analysis.keywords.filter((kw) => kw.emphasis >= 0.9 && inRange(kw.t)).forEach((kw) => cands.push({ t: kw.t, strength: 1, why: `Ênfase em “${kw.word}”`, template: kw.template }));
    (analysis.emphasis || []).filter((e) => inRange(e.t)).forEach((e) => {
      if (!cands.some((c) => Math.abs(c.t - e.t) < 1.2)) cands.push({ t: e.t, strength: e.strength, why: 'Pico de intensidade da voz' });
    });
    cands.sort((a, b) => b.strength - a.strength);
    const maxCam = Math.round((range ? 2 : 7) * k);
    const picked = [];
    for (const c of cands) {
      if (picked.length >= maxCam) break;
      if (picked.some((p) => Math.abs(p.t - c.t) < 2.6)) continue;
      picked.push(c);
    }
    picked.forEach((c) => {
      const impact = ['rocket', 'fire', 'warning'].includes(c.template);
      const tpl = impact ? 'shake' : 'punch-zoom';
      items.push({
        lane: 'camera',
        priority: 1,
        start: Math.max(0, c.t - 0.06),
        duration: impact ? 0.9 : 1.15,
        name: getTemplate(tpl).name,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        motion: motion({ templateId: tpl, category: 'camera', reason: `${c.why} em ${formatTime(c.t)}`, confidence: clamp(0.8 + 0.18 * c.strength, 0.5, 0.98) }),
      });
    });
    mainClips.forEach((mc) => {
      const s = mc.start + 0.05;
      if (!inRange(s) || mc.duration < 3) return;
      const d = Math.min(3.4, mc.duration * 0.45);
      if (picked.some((p) => p.t > s && p.t < s + d)) return;
      items.push({
        lane: 'camera',
        priority: 0,
        start: s,
        duration: d,
        name: getTemplate('slow-push').name,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        motion: motion({ templateId: 'slow-push', category: 'camera', reason: 'Movimento de câmera sutil no início da cena', confidence: 0.8 }),
      });
    });
  }

  const end = analysis.duration;
  return ['sticker', 'typography', 'camera', 'sfx']
    .flatMap((lane) => resolveLane(items, lane))
    .filter((it) => it.start < end - 0.25)
    .map((it) => (it.duration && it.start + it.duration > end ? { ...it, duration: end - it.start } : it));
}
