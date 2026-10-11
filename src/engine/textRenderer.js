/**
 * Motor de layout e desenho de texto rico em Canvas: quebra de linha, estilos por palavra
 * (realce de palavras-chave, karaokê), contorno, sombra, brilho neon, gradiente e caixas.
 * Usado por textos, legendas automáticas e tipografia gerada pela IA.
 */
import { clamp } from '../lib/utils';

const supportsLetterSpacing = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;

export function fontString(style, px) {
  return `${style.weight || 700} ${Math.max(1, px).toFixed(1)}px "${style.font || 'Inter'}", Inter, sans-serif`;
}

/** Divide o texto em tokens (palavras e quebras de linha explícitas). */
export function tokenize(text) {
  const tokens = [];
  String(text ?? '')
    .split('\n')
    .forEach((line, li) => {
      if (li > 0) tokens.push({ text: '\n', br: true });
      line
        .split(/\s+/)
        .filter(Boolean)
        .forEach((w) => tokens.push({ text: w }));
    });
  return tokens;
}

function setSpacing(ctx, px) {
  if (supportsLetterSpacing) ctx.letterSpacing = `${px || 0}px`;
}

/**
 * Faz o layout dos tokens em linhas.
 * @returns {{lines: Array<{items: Array, width: number}>, lineHeight: number}}
 */
export function layoutTokens(ctx, tokens, style, px, maxWidth) {
  ctx.font = fontString(style, px);
  setSpacing(ctx, (style.letterSpacing || 0) * (px / 64));
  const space = ctx.measureText(' ').width;
  const lines = [];
  let cur = { items: [], width: 0 };
  tokens.forEach((tok, index) => {
    if (tok.br) {
      lines.push(cur);
      cur = { items: [], width: 0 };
      return;
    }
    const txt = style.uppercase ? tok.text.toUpperCase() : tok.text;
    const tw = ctx.measureText(txt).width;
    const w = tw * (tok.layoutScale || 1);
    const add = cur.items.length ? space + w : w;
    if (cur.items.length && cur.width + add > maxWidth) {
      lines.push(cur);
      cur = { items: [], width: 0 };
    }
    cur.items.push({ ...tok, index, txt, w, tw, x: cur.items.length ? cur.width + space : 0 });
    cur.width += cur.items.length > 1 ? space + w : w;
  });
  lines.push(cur);
  return { lines: lines.filter((l) => l.items.length || lines.length === 1), lineHeight: px * 1.22, space };
}

function fillFor(ctx, style, x0, y0, x1, y1, colorOverride) {
  if (colorOverride) return colorOverride;
  if (style.gradient && style.gradient.length >= 2) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    style.gradient.forEach((c, i) => g.addColorStop(i / (style.gradient.length - 1), c));
    return g;
  }
  return style.color || '#fff';
}

/**
 * Desenha um bloco de texto centrado em (cx, cy).
 * opts.perToken(i, token) pode retornar { color, scale, dy, alpha, box, boxColor, glow }.
 * opts.reveal: número de caracteres visíveis (máquina de escrever).
 */
export function drawTextBlock(ctx, opts) {
  const { tokens, style, px, cx, cy, maxWidth, perToken, reveal = Infinity, alpha = 1 } = opts;
  if (!tokens.length) return null;
  const scaleK = px / 64;
  const { lines, lineHeight } = layoutTokens(ctx, tokens, style, px, maxWidth);
  const totalH = lines.length * lineHeight;
  const align = style.align || 'center';
  let charCount = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  lines.forEach((line, li) => {
    const ly = cy - totalH / 2 + lineHeight * (li + 0.5);
    let lx;
    if (align === 'left') lx = cx - maxWidth / 2;
    else if (align === 'right') lx = cx + maxWidth / 2 - line.width;
    else lx = cx - line.width / 2;
    minX = Math.min(minX, lx);
    maxX = Math.max(maxX, lx + line.width);

    if (style.bg && line.items.length) {
      const padX = px * 0.3;
      const padY = px * 0.12;
      ctx.save();
      ctx.fillStyle = style.bgColor || '#000';
      ctx.beginPath();
      const r = px * 0.22;
      const bx = lx - padX;
      const by = ly - lineHeight / 2 + padY * 0.2;
      const bw = line.width + padX * 2;
      const bh = lineHeight - padY * 0.4;
      ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, r) : ctx.rect(bx, by, bw, bh);
      ctx.fill();
      ctx.restore();
    }

    line.items.forEach((it) => {
      const visibleChars = clamp(reveal - charCount, 0, it.txt.length);
      charCount += it.txt.length + 1;
      if (visibleChars <= 0) return;
      const txt = visibleChars >= it.txt.length ? it.txt : it.txt.slice(0, Math.ceil(visibleChars));
      const mod = (perToken && perToken(it.index, it)) || {};
      if (mod.hidden) return;
      const s = mod.scale ?? 1;
      const wx = lx + it.x + it.w / 2;
      const wy = ly + (mod.dy || 0);
      ctx.save();
      ctx.translate(wx, wy);
      if (mod.rotate) ctx.rotate(mod.rotate);
      ctx.scale(s, s);
      ctx.globalAlpha *= mod.alpha ?? 1;
      ctx.font = fontString(style, px);
      setSpacing(ctx, (style.letterSpacing || 0) * scaleK);
      const x = -it.tw / 2;
      if (mod.box) {
        const padX = px * 0.16;
        const padY = px * 0.08;
        ctx.fillStyle = mod.boxColor || style.highlightColor || '#a855f7';
        ctx.beginPath();
        const bx = x - padX;
        const by = -lineHeight / 2 + padY;
        ctx.roundRect ? ctx.roundRect(bx, by, it.tw + padX * 2, lineHeight - padY * 2, px * 0.16) : ctx.rect(bx, by, it.tw + padX * 2, lineHeight - padY * 2);
        ctx.fill();
      }
      const glow = mod.glow ?? style.glow;
      if (style.shadow && !glow) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = px * 0.18;
        ctx.shadowOffsetY = px * 0.05;
      }
      if (style.stroke > 0) {
        ctx.lineWidth = style.stroke * scaleK * 2;
        ctx.strokeStyle = style.strokeColor || '#000';
        ctx.strokeText(txt, x, 0);
        ctx.shadowColor = 'transparent';
      }
      const fill = fillFor(ctx, style, x, -px / 2, x + it.tw, px / 2, mod.color);
      if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = px * 0.45;
        ctx.fillStyle = fill;
        ctx.fillText(txt, x, 0);
        ctx.shadowBlur = px * 0.15;
      }
      ctx.fillStyle = fill;
      ctx.fillText(txt, x, 0);
      if (mod.underline) {
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = mod.underlineColor || mod.color || style.highlightColor || '#facc15';
        const uw = it.tw * clamp(mod.underline, 0, 1);
        ctx.fillRect(x, px * 0.5, uw, px * 0.09);
      }
      ctx.restore();
    });
  });
  ctx.restore();
  return { x: minX, y: cy - totalH / 2, w: maxX - minX, h: totalH };
}
