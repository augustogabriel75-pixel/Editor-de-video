/**
 * Biblioteca de "Motions" que o motor de IA gera: stickers/gráficos animados, tipografia
 * cinética, movimentos de câmera e transições de pós-processamento. Tudo procedural
 * (Canvas 2D), com estilo controlado pelo prompt do usuário.
 */
import { clamp, Easing, seeded, lerp, rgba } from '../lib/utils';
import { drawTextBlock, tokenize } from './textRenderer';
import { getCanvas, glitch, rgbSplit, zoomBlur, flashOverlay } from './fx';

/* ------------------------------------------------------------------------------------------ */
/* Helpers                                                                                     */
/* ------------------------------------------------------------------------------------------ */

const pop = (t, d = 0.38) => Easing.outBack(clamp(t / d, 0, 1));
const outFade = (t, dur, d = 0.35) => clamp((dur - t) / d, 0, 1);
const inFade = (t, d = 0.15) => clamp(t / d, 0, 1);

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function heartPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.32);
  ctx.bezierCurveTo(-s * 0.12, s * 0.2, -s * 0.56, 0, -s * 0.5, -s * 0.3);
  ctx.bezierCurveTo(-s * 0.45, -s * 0.6, -s * 0.06, -s * 0.6, 0, -s * 0.3);
  ctx.bezierCurveTo(s * 0.06, -s * 0.6, s * 0.45, -s * 0.6, s * 0.5, -s * 0.3);
  ctx.bezierCurveTo(s * 0.56, 0, s * 0.12, s * 0.2, 0, s * 0.32);
  ctx.closePath();
}

function star4(ctx, s) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? s : s * 0.22;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

function star5(ctx, s) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? s : s * 0.45;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

function applyLook(ctx, style, color, S) {
  if (style.glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = S * 0.25;
  } else if (!style.flat) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = S * 0.08;
    ctx.shadowOffsetY = S * 0.03;
  }
}

/** Pílula com a palavra-chave que disparou o motion. */
export function drawLabel(ctx, m, text, x, y) {
  if (!text || m.style.showLabel === false) return;
  const { style, S, t, dur } = m;
  const k = pop(t - 0.12, 0.35);
  if (k <= 0.01) return;
  const px = S * 0.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.globalAlpha *= outFade(t, dur);
  ctx.font = `${style.weight >= 800 ? 900 : 700} ${px}px "${style.font}", Inter, sans-serif`;
  const label = style.font === 'Bebas Neue' || style.outline ? text.toUpperCase() : text;
  const w = ctx.measureText(label).width + px * 1.2;
  const h = px * 1.7;
  applyLook(ctx, style, style.primary, S);
  ctx.fillStyle = style.flat ? 'rgba(2,6,23,0.72)' : style.primary;
  rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  if (style.flat) {
    ctx.strokeStyle = style.primary;
    ctx.lineWidth = Math.max(1, S * 0.012);
    ctx.stroke();
  }
  ctx.fillStyle = style.flat ? style.primary : '#0b0b0f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, px * 0.06);
  ctx.restore();
}

/* ------------------------------------------------------------------------------------------ */
/* Stickers                                                                                    */
/* ------------------------------------------------------------------------------------------ */

function drawCoin(ctx, r, flat, front, style, alpha) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const rx = Math.max(r * 0.1, r * flat);
  const pal = style.flat
    ? [style.accent, style.primary, style.secondary]
    : style.id?.includes('retro')
      ? ['#fed7aa', '#fb923c', '#9a3412']
      : ['#fef08a', '#facc15', '#b45309'];
  const edge = style.flat ? style.secondary : '#92400e';
  if (style.glow) {
    ctx.shadowColor = pal[1];
    ctx.shadowBlur = r * 0.9;
  }
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.ellipse(r * 0.12 * (1 - flat) * (front ? 1 : -1), 0, rx, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  const g = ctx.createLinearGradient(-rx, -r, rx, r);
  g.addColorStop(0, pal[0]);
  g.addColorStop(0.5, pal[1]);
  g.addColorStop(1, pal[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = style.flat ? rgba('#ffffff', 0.45) : 'rgba(146,64,14,0.6)';
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.78, r * 0.78, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (flat > 0.3) {
    ctx.save();
    ctx.scale(flat, 1);
    ctx.fillStyle = style.flat ? rgba('#020617', 0.7) : '#92400e';
    ctx.font = `900 ${r * 1.15}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, r * 0.06);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-rx * 0.35, -r * 0.45, rx * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function coins(ctx, m) {
  const { t, dur, S, style, intensity, H } = m;
  const rnd = seeded(m.seed);
  const n = Math.round(22 * Math.max(0.6, style.density) * clamp(intensity, 0.3, 1.6));
  const spread = S * 4.4;
  const spawn = Math.max(0.4, dur - 1.1);
  const fade = outFade(t, dur, 0.5);
  for (let i = 0; i < n; i++) {
    const delay = rnd() * spawn;
    const v0 = (0.12 + rnd() * 0.22) * H;
    const x0 = m.x + (rnd() - 0.5) * spread;
    const r = S * (0.13 + rnd() * 0.1);
    const spin = 3 + rnd() * 5;
    const ph = rnd() * 6;
    const tt = t - delay;
    if (tt < 0) continue;
    const y = m.y - H * 0.55 + tt * v0 + 0.16 * H * tt * tt;
    if (y > H + r * 2) continue;
    const ang = tt * spin + ph;
    ctx.save();
    ctx.translate(x0 + Math.sin(tt * 2 + i) * S * 0.12, y);
    ctx.rotate(Math.sin(tt * 3 + i) * 0.3);
    drawCoin(ctx, r, Math.abs(Math.cos(ang)), Math.cos(ang) > 0, style, fade * inFade(tt, 0.12));
    ctx.restore();
  }
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.15);
}

function rocket(ctx, m) {
  const { t, dur, S, style } = m;
  const p = clamp(t / dur, 0, 1);
  const pos = (q) => {
    const e = Easing.inOutCubic(clamp(q, 0, 1));
    return [lerp(m.x - S * 1.6, m.x + S * 1.7, e) + Math.sin(q * 9) * S * 0.05, lerp(m.y + S * 1.5, m.y - S * 1.9, e)];
  };
  const fade = outFade(t, dur, 0.3) * inFade(t, 0.12);
  ctx.save();
  ctx.globalAlpha *= fade;
  for (let k = 14; k >= 1; k--) {
    const [sx, sy] = pos(p - k * 0.022);
    const a = (1 - k / 15) * 0.5;
    ctx.fillStyle = style.flat ? rgba(style.secondary, a * 0.6) : `rgba(226,232,240,${a})`;
    ctx.beginPath();
    ctx.arc(sx, sy, S * (0.06 + k * 0.016), 0, Math.PI * 2);
    ctx.fill();
  }
  const [x, y] = pos(p);
  const [nx, ny] = pos(p + 0.01);
  const ang = Math.atan2(ny - y, nx - x) + Math.PI / 2;
  ctx.translate(x, y);
  ctx.rotate(ang);
  const fl = S * (0.34 + 0.12 * Math.sin(t * 42));
  const fg = ctx.createLinearGradient(0, S * 0.28, 0, S * 0.28 + fl);
  fg.addColorStop(0, '#fef08a');
  fg.addColorStop(0.4, '#f97316');
  fg.addColorStop(1, 'rgba(239,68,68,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-S * 0.11, S * 0.28);
  ctx.quadraticCurveTo(0, S * 0.28 + fl * 1.2, S * 0.11, S * 0.28);
  ctx.fill();
  applyLook(ctx, style, style.accent, S);
  ctx.fillStyle = style.secondary;
  ctx.beginPath();
  ctx.moveTo(-S * 0.15, S * 0.05);
  ctx.lineTo(-S * 0.3, S * 0.34);
  ctx.lineTo(-S * 0.12, S * 0.28);
  ctx.moveTo(S * 0.15, S * 0.05);
  ctx.lineTo(S * 0.3, S * 0.34);
  ctx.lineTo(S * 0.12, S * 0.28);
  ctx.fill();
  const bg = ctx.createLinearGradient(-S * 0.17, 0, S * 0.17, 0);
  bg.addColorStop(0, style.flat ? style.primary : '#cbd5e1');
  bg.addColorStop(0.5, '#ffffff');
  bg.addColorStop(1, style.flat ? style.accent : '#94a3b8');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(0, -S * 0.58);
  ctx.bezierCurveTo(S * 0.22, -S * 0.36, S * 0.18, S * 0.1, S * 0.13, S * 0.3);
  ctx.lineTo(-S * 0.13, S * 0.3);
  ctx.bezierCurveTo(-S * 0.18, S * 0.1, -S * 0.22, -S * 0.36, 0, -S * 0.58);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = style.secondary;
  ctx.beginPath();
  ctx.moveTo(0, -S * 0.58);
  ctx.bezierCurveTo(S * 0.1, -S * 0.5, S * 0.14, -S * 0.42, S * 0.15, -S * 0.36);
  ctx.lineTo(-S * 0.15, -S * 0.36);
  ctx.bezierCurveTo(-S * 0.14, -S * 0.42, -S * 0.1, -S * 0.5, 0, -S * 0.58);
  ctx.fill();
  ctx.fillStyle = '#0ea5e9';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = S * 0.025;
  ctx.beginPath();
  ctx.arc(0, -S * 0.15, S * 0.075, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 1.05);
}

function hearts(ctx, m) {
  const { t, dur, S, style, intensity } = m;
  const rnd = seeded(m.seed);
  const n = Math.round(10 * style.density * clamp(intensity, 0.3, 1.6));
  const fade = outFade(t, dur, 0.4);
  const main = style.flat ? style.primary : style.secondary;
  for (let i = 0; i < n; i++) {
    const delay = rnd() * 1.0;
    const x0 = m.x + (rnd() - 0.5) * S * 2.6;
    const sp = S * (0.8 + rnd() * 0.9);
    const size = S * (0.16 + rnd() * 0.22);
    const tt = t - delay;
    if (tt < 0) continue;
    const life = clamp(1 - tt / 2, 0, 1);
    ctx.save();
    ctx.translate(x0 + Math.sin(tt * 3 + i) * S * 0.16, m.y + S * 0.9 - tt * sp);
    ctx.rotate(Math.sin(tt * 2 + i) * 0.25);
    const k = pop(tt, 0.3);
    ctx.scale(k, k);
    ctx.globalAlpha *= fade * life;
    heartPath(ctx, size);
    if (style.flat) {
      ctx.strokeStyle = main;
      ctx.lineWidth = size * 0.1;
      if (style.glow) {
        ctx.shadowColor = main;
        ctx.shadowBlur = size * 0.6;
      }
      ctx.stroke();
    } else {
      const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.3);
      g.addColorStop(0, '#fda4af');
      g.addColorStop(1, '#e11d48');
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }
  const beat = 1 + 0.12 * Math.max(0, Math.sin(t * 9)) * (t < dur - 0.4 ? 1 : 0);
  ctx.save();
  ctx.translate(m.x, m.y);
  const k = pop(t, 0.4) * beat;
  ctx.scale(k, k);
  ctx.globalAlpha *= fade;
  applyLook(ctx, style, main, S);
  heartPath(ctx, S * 0.8);
  if (style.flat) {
    ctx.strokeStyle = main;
    ctx.lineWidth = S * 0.05;
    ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(-S * 0.15, -S * 0.2, S * 0.05, 0, 0, S * 0.6);
    g.addColorStop(0, '#fecdd3');
    g.addColorStop(0.4, '#fb7185');
    g.addColorStop(1, '#be123c');
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.62);
}

function lightbulb(ctx, m) {
  const { t, dur, S, style } = m;
  const k = pop(t, 0.4);
  const fade = outFade(t, dur);
  const on = t > 0.42 ? 1 : t > 0.25 ? (Math.sin(t * 90) > 0 ? 1 : 0.2) : 0.15;
  const col = style.flat ? style.primary : '#fde047';
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(k, k);
  ctx.globalAlpha *= fade;
  if (on > 0.5) {
    const g = ctx.createRadialGradient(0, -S * 0.12, 0, 0, -S * 0.12, S * 1.2);
    g.addColorStop(0, rgba(col, 0.55));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-S * 1.2, -S * 1.3, S * 2.4, S * 2.4);
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineWidth = S * 0.045;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + t * 0.6;
      const r0 = S * (0.56 + 0.05 * Math.sin(t * 8 + i));
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, -S * 0.12 + Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * (r0 + S * 0.2), -S * 0.12 + Math.sin(a) * (r0 + S * 0.2));
      ctx.stroke();
    }
  }
  applyLook(ctx, style, col, S);
  const bg = ctx.createRadialGradient(-S * 0.1, -S * 0.25, S * 0.02, 0, -S * 0.12, S * 0.42);
  bg.addColorStop(0, on > 0.5 ? '#fffbeb' : '#f1f5f9');
  bg.addColorStop(1, on > 0.5 ? col : '#94a3b8');
  ctx.fillStyle = style.flat ? rgba(col, on > 0.5 ? 0.3 : 0.08) : bg;
  ctx.beginPath();
  ctx.arc(0, -S * 0.15, S * 0.36, Math.PI * 0.82, Math.PI * 2.18);
  ctx.lineTo(S * 0.14, S * 0.26);
  ctx.lineTo(-S * 0.14, S * 0.26);
  ctx.closePath();
  ctx.fill();
  if (style.flat) {
    ctx.strokeStyle = col;
    ctx.lineWidth = S * 0.035;
    ctx.stroke();
  }
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = on > 0.5 ? '#f59e0b' : '#64748b';
  ctx.lineWidth = S * 0.025;
  ctx.beginPath();
  ctx.moveTo(-S * 0.08, S * 0.18);
  ctx.lineTo(-S * 0.06, -S * 0.08);
  ctx.lineTo(-S * 0.02, -S * 0.02);
  ctx.lineTo(S * 0.02, -S * 0.1);
  ctx.lineTo(S * 0.06, -S * 0.02);
  ctx.lineTo(S * 0.08, S * 0.18);
  ctx.stroke();
  ctx.fillStyle = '#64748b';
  rr(ctx, -S * 0.15, S * 0.27, S * 0.3, S * 0.08, S * 0.03);
  ctx.fill();
  ctx.fillStyle = '#475569';
  rr(ctx, -S * 0.12, S * 0.37, S * 0.24, S * 0.07, S * 0.03);
  ctx.fill();
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.72);
}

function chartUp(ctx, m) {
  const { t, dur, S, style } = m;
  const k = pop(t, 0.35);
  const fade = outFade(t, dur);
  const pw = S * 2.1;
  const ph = S * 1.45;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(k, k);
  ctx.globalAlpha *= fade;
  applyLook(ctx, style, style.accent, S);
  ctx.fillStyle = 'rgba(2,6,23,0.78)';
  rr(ctx, -pw / 2, -ph / 2, pw, ph, S * 0.12);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = rgba(style.accent, 0.7);
  ctx.lineWidth = S * 0.015;
  ctx.stroke();
  const n = 5;
  const tops = [];
  for (let i = 0; i < n; i++) {
    const g = Easing.outCubic(clamp((t - 0.15 - i * 0.1) / 0.45, 0, 1));
    const bh = ph * (0.18 + 0.12 * i) * g;
    const bw = pw * 0.11;
    const bx = -pw / 2 + pw * 0.12 + i * pw * 0.165;
    const by = ph / 2 - ph * 0.1 - bh;
    ctx.fillStyle = i % 2 ? style.secondary : style.primary;
    rr(ctx, bx, by, bw, bh, S * 0.03);
    ctx.fill();
    tops.push([bx + bw / 2, by - S * 0.06]);
  }
  const lp = clamp((t - 0.5) / 0.6, 0, 1);
  if (lp > 0) {
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = S * 0.05;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (style.glow) {
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = S * 0.2;
    }
    const segs = (tops.length - 1) * lp;
    ctx.beginPath();
    ctx.moveTo(...tops[0]);
    let end = tops[0];
    for (let i = 1; i < tops.length; i++) {
      const f = clamp(segs - (i - 1), 0, 1);
      if (f <= 0) break;
      end = [lerp(tops[i - 1][0], tops[i][0], f), lerp(tops[i - 1][1], tops[i][1], f)];
      ctx.lineTo(...end);
    }
    ctx.stroke();
    const prev = tops[Math.max(0, Math.ceil(segs) - 1)];
    const a = Math.atan2(end[1] - prev[1], end[0] - prev[0]) || -0.6;
    ctx.fillStyle = '#4ade80';
    ctx.save();
    ctx.translate(...end);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(S * 0.12, 0);
    ctx.lineTo(-S * 0.06, -S * 0.08);
    ctx.lineTo(-S * 0.06, S * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.shadowColor = 'transparent';
  const val = Math.round(248 * Easing.outCubic(clamp((t - 0.2) / 1.0, 0, 1)));
  ctx.fillStyle = style.text;
  ctx.font = `800 ${S * 0.26}px "${style.font}", Inter, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(`+${val}%`, -pw / 2 + pw * 0.08, -ph / 2 + ph * 0.08);
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + ph / 2 + S * 0.25);
}

function clock(ctx, m) {
  const { t, dur, S, style } = m;
  const k = pop(t, 0.35);
  const fade = outFade(t, dur);
  const R = S * 0.5;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(t < 0.8 ? Math.sin(t * 40) * 0.08 * (1 - t / 0.8) : 0);
  ctx.scale(k, k);
  ctx.globalAlpha *= fade;
  applyLook(ctx, style, style.primary, S);
  ctx.fillStyle = style.flat ? 'rgba(2,6,23,0.6)' : '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = style.flat ? style.primary : '#1f2937';
  ctx.lineWidth = S * 0.05;
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.lineWidth = S * (i % 3 ? 0.015 : 0.03);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78);
    ctx.lineTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9);
    ctx.stroke();
  }
  const hand = (a, len, w, c) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - Math.PI / 2) * len, Math.sin(a - Math.PI / 2) * len);
    ctx.stroke();
  };
  hand(t * 0.9, R * 0.45, S * 0.05, style.flat ? style.text : '#111827');
  hand(t * 7, R * 0.7, S * 0.03, style.secondary);
  ctx.strokeStyle = style.primary;
  ctx.lineWidth = S * 0.06;
  if (style.glow) {
    ctx.shadowColor = style.primary;
    ctx.shadowBlur = S * 0.2;
  }
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(t / dur, 0, 1));
  ctx.stroke();
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.9);
}

function trophy(ctx, m) {
  const { t, dur, S, style, intensity } = m;
  const k = pop(t, 0.4);
  const fade = outFade(t, dur);
  const rnd = seeded(m.seed);
  ctx.save();
  ctx.globalAlpha *= fade;
  const n = Math.round(36 * style.density * clamp(intensity, 0.4, 1.5));
  const colors = [style.primary, style.secondary, style.accent, '#ffffff'];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const v = S * (1.5 + rnd() * 2.5);
    const tt = Math.max(0, t - 0.15);
    const x = m.x + Math.cos(a) * v * tt;
    const y = m.y - S * 0.2 + Math.sin(a) * v * tt + S * 2.2 * tt * tt;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tt * (5 + rnd() * 8));
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha *= clamp(1 - tt / 1.8, 0, 1);
    if (i % 3 === 0) {
      star5(ctx, S * 0.05);
      ctx.fill();
    } else ctx.fillRect(-S * 0.03, -S * 0.015, S * 0.06, S * 0.03);
    ctx.restore();
  }
  ctx.translate(m.x, m.y);
  ctx.scale(k, k);
  applyLook(ctx, style, style.primary, S);
  const g = ctx.createLinearGradient(-S * 0.4, -S * 0.5, S * 0.4, S * 0.4);
  g.addColorStop(0, '#fef9c3');
  g.addColorStop(0.45, '#facc15');
  g.addColorStop(1, '#a16207');
  const fill = style.flat ? rgba(style.primary, 0.25) : g;
  ctx.strokeStyle = style.flat ? style.primary : '#ca8a04';
  ctx.lineWidth = S * 0.07;
  ctx.beginPath();
  ctx.arc(-S * 0.36, -S * 0.28, S * 0.14, Math.PI * 0.5, Math.PI * 1.5);
  ctx.moveTo(S * 0.36, -S * 0.42);
  ctx.arc(S * 0.36, -S * 0.28, S * 0.14, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-S * 0.38, -S * 0.5);
  ctx.lineTo(S * 0.38, -S * 0.5);
  ctx.bezierCurveTo(S * 0.38, -S * 0.05, S * 0.18, S * 0.08, S * 0.06, S * 0.12);
  ctx.lineTo(S * 0.06, S * 0.3);
  ctx.lineTo(-S * 0.06, S * 0.3);
  ctx.lineTo(-S * 0.06, S * 0.12);
  ctx.bezierCurveTo(-S * 0.18, S * 0.08, -S * 0.38, -S * 0.05, -S * 0.38, -S * 0.5);
  ctx.fill();
  if (style.flat) {
    ctx.lineWidth = S * 0.03;
    ctx.stroke();
  }
  ctx.fillStyle = style.flat ? style.primary : '#854d0e';
  rr(ctx, -S * 0.26, S * 0.3, S * 0.52, S * 0.14, S * 0.03);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = style.flat ? style.text : '#fff7ed';
  ctx.save();
  ctx.translate(0, -S * 0.25);
  star5(ctx, S * 0.12);
  ctx.fill();
  ctx.restore();
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.82);
}

function fire(ctx, m) {
  const { t, dur, S, style } = m;
  const k = pop(t, 0.35);
  const fade = outFade(t, dur);
  const rnd = seeded(m.seed);
  ctx.save();
  ctx.translate(m.x, m.y + S * 0.35);
  ctx.scale(k, k);
  ctx.globalAlpha *= fade;
  for (let i = 0; i < 12; i++) {
    const tt = (t * (0.8 + rnd()) + rnd()) % 1;
    ctx.fillStyle = rgba(i % 2 ? '#fb923c' : '#fde047', 1 - tt);
    ctx.beginPath();
    ctx.arc((rnd() - 0.5) * S * 0.6 + Math.sin(tt * 6 + i) * S * 0.08, -tt * S * 1.4, S * 0.025 * (1 - tt) + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  const layers = style.flat
    ? [[style.primary, 1, 0.5], [style.secondary, 0.7, 0.4]]
    : [['#dc2626', 1.0, 1], ['#f97316', 0.78, 1], ['#fde047', 0.5, 1]];
  if (style.glow) {
    ctx.shadowColor = style.flat ? style.primary : '#f97316';
    ctx.shadowBlur = S * 0.4;
  }
  layers.forEach(([c, s, a], li) => {
    const w = S * 0.42 * s;
    const h = S * 1.05 * s * (1 + 0.08 * Math.sin(t * 13 + li * 2));
    const sway = Math.sin(t * 9 + li) * w * 0.25;
    ctx.globalAlpha = fade * a;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-w * 1.1, -h * 0.1, -w * 0.6, -h * 0.6, sway, -h);
    ctx.bezierCurveTo(w * 0.2, -h * 0.65, w * 1.2, -h * 0.35, w * 0.7, -h * 0.05);
    ctx.quadraticCurveTo(w * 0.4, h * 0.12, 0, 0);
    ctx.fill();
  });
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.7);
}

function sparkleBurst(ctx, m) {
  const { t, dur, S, style, intensity } = m;
  const rnd = seeded(m.seed);
  const fade = outFade(t, dur);
  const n = Math.round(14 * style.density * clamp(intensity, 0.3, 1.6));
  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = S * (0.2 + rnd() * 1.3);
    const delay = rnd() * (dur * 0.6);
    const life = 0.9 + rnd() * 0.5;
    const age = (t - delay) / life;
    if (age < 0 || age > 1) continue;
    const s = Math.sin(Math.PI * age) * S * (0.1 + rnd() * 0.18);
    ctx.save();
    ctx.translate(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r * 0.7);
    ctx.rotate(t * 1.5 + i);
    ctx.fillStyle = i % 3 === 0 ? style.secondary : i % 3 === 1 ? style.primary : '#ffffff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = s * 1.5;
    star4(ctx, s);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y);
}

function target(ctx, m) {
  const { t, dur, S, style, W } = m;
  const k = pop(t, 0.35);
  const fade = outFade(t, dur);
  const hit = 0.55;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.globalAlpha *= fade;
  const shake = t > hit ? Math.sin((t - hit) * 60) * S * 0.03 * Math.max(0, 1 - (t - hit) * 3) : 0;
  ctx.save();
  ctx.translate(shake, 0);
  ctx.scale(k, k);
  applyLook(ctx, style, style.secondary, S);
  const rings = 4;
  for (let i = 0; i < rings; i++) {
    const r = S * 0.62 * (1 - i / rings);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    if (style.flat) {
      ctx.strokeStyle = i % 2 ? style.secondary : style.primary;
      ctx.lineWidth = S * 0.04;
      ctx.stroke();
    } else {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#ef4444';
      ctx.fill();
    }
    ctx.shadowColor = 'transparent';
  }
  ctx.restore();
  if (t > hit) {
    const q = clamp((t - hit) / 0.5, 0, 1);
    ctx.strokeStyle = rgba(style.primary, 1 - q);
    ctx.lineWidth = S * 0.04;
    ctx.beginPath();
    ctx.arc(0, 0, S * (0.6 + q * 0.6), 0, Math.PI * 2);
    ctx.stroke();
  }
  const ax = t < hit ? lerp(W * 0.7, 0, Easing.inQuad(clamp(t / hit, 0, 1))) : 0;
  ctx.translate(ax + shake, 0);
  ctx.rotate(-0.25);
  ctx.strokeStyle = style.flat ? style.text : '#78350f';
  ctx.lineWidth = S * 0.035;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(S * 0.85, 0);
  ctx.stroke();
  ctx.fillStyle = style.flat ? style.text : '#475569';
  ctx.beginPath();
  ctx.moveTo(-S * 0.04, 0);
  ctx.lineTo(S * 0.12, -S * 0.07);
  ctx.lineTo(S * 0.12, S * 0.07);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = style.secondary;
  ctx.beginPath();
  ctx.moveTo(S * 0.7, 0);
  ctx.lineTo(S * 0.9, -S * 0.1);
  ctx.lineTo(S * 0.95, 0);
  ctx.lineTo(S * 0.9, S * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.85);
}

function subscribe(ctx, m) {
  const { t, dur, S, style } = m;
  const k = pop(t, 0.35);
  const fade = outFade(t, dur);
  const click = 0.95;
  const clicked = t > click;
  const press = Math.abs(t - click) < 0.08 ? 0.92 : 1;
  const bw = S * 1.8;
  const bh = S * 0.52;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.globalAlpha *= fade;
  ctx.save();
  ctx.scale(k * press, k * press);
  applyLook(ctx, style, style.secondary, S);
  ctx.fillStyle = clicked ? '#334155' : style.flat ? rgba(style.primary, 0.2) : '#ef4444';
  rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  if (style.flat) {
    ctx.strokeStyle = style.primary;
    ctx.lineWidth = S * 0.02;
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${S * 0.2}px "${style.font}", Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(clicked ? 'SEGUINDO ✓' : 'SEGUIR', 0, S * 0.01);
  ctx.restore();
  // sino
  ctx.save();
  ctx.translate(bw / 2 + S * 0.42, 0);
  ctx.scale(k, k);
  ctx.rotate(clicked ? Math.sin((t - click) * 22) * 0.45 * Math.max(0, 1 - (t - click) * 1.5) : 0);
  ctx.fillStyle = style.flat ? style.primary : '#facc15';
  ctx.beginPath();
  ctx.moveTo(-S * 0.2, S * 0.14);
  ctx.quadraticCurveTo(-S * 0.18, -S * 0.22, 0, -S * 0.24);
  ctx.quadraticCurveTo(S * 0.18, -S * 0.22, S * 0.2, S * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, S * 0.18, S * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // cursor
  const cp = Easing.outCubic(clamp((t - 0.25) / 0.6, 0, 1));
  const cx = lerp(S * 1.3, S * 0.2, cp);
  const cy = lerp(S * 1.0, S * 0.08, cp);
  ctx.translate(cx, cy);
  ctx.scale(press, press);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = S * 0.02;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, S * 0.32);
  ctx.lineTo(S * 0.08, S * 0.24);
  ctx.lineTo(S * 0.14, S * 0.36);
  ctx.lineTo(S * 0.18, S * 0.34);
  ctx.lineTo(S * 0.12, S * 0.22);
  ctx.lineTo(S * 0.22, S * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function globe(ctx, m) {
  const { t, dur, S, style } = m;
  const k = pop(t, 0.4);
  const fade = outFade(t, dur);
  const R = S * 0.55;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(k, k);
  ctx.globalAlpha *= fade;
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
  g.addColorStop(0, rgba(style.accent, 0.55));
  g.addColorStop(1, rgba(style.flat ? '#020617' : '#1d4ed8', 0.85));
  applyLook(ctx, style, style.primary, S);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = rgba(style.primary, 0.85);
  ctx.lineWidth = S * 0.018;
  for (let i = 0; i < 6; i++) {
    const ph = t * 0.9 + (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.abs(Math.cos(ph)) * R, R, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const lat of [-0.5, 0, 0.5]) {
    ctx.beginPath();
    ctx.ellipse(0, R * Math.sin(lat), R * Math.cos(lat), R * Math.cos(lat) * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.rotate(-0.35);
  ctx.strokeStyle = rgba(style.secondary, 0.7);
  ctx.beginPath();
  ctx.ellipse(0, 0, R * 1.5, R * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const a = t * 2.4 + (i * Math.PI * 2) / 3;
    ctx.fillStyle = i === 0 ? style.secondary : style.primary;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * R * 1.5, Math.sin(a) * R * 0.42, S * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.88);
}

function warning(ctx, m) {
  const { t, dur, S, style } = m;
  const k = pop(t, 0.35);
  const fade = outFade(t, dur);
  ctx.save();
  ctx.translate(m.x + Math.sin(t * 50) * S * 0.03 * Math.max(0, 1 - t * 1.5), m.y);
  ctx.scale(k, k);
  ctx.globalAlpha *= fade;
  const pulse = 1 + 0.12 * Math.sin(t * 8);
  ctx.strokeStyle = rgba(style.flat ? style.primary : '#facc15', 0.5);
  ctx.lineWidth = S * 0.03;
  ctx.save();
  ctx.scale(pulse * 1.2, pulse * 1.2);
  ctx.beginPath();
  ctx.moveTo(0, -S * 0.5);
  ctx.lineTo(S * 0.55, S * 0.42);
  ctx.lineTo(-S * 0.55, S * 0.42);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  applyLook(ctx, style, '#facc15', S);
  ctx.fillStyle = style.flat ? rgba(style.primary, 0.25) : '#facc15';
  ctx.strokeStyle = style.flat ? style.primary : '#1f2937';
  ctx.lineWidth = S * 0.05;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -S * 0.5);
  ctx.lineTo(S * 0.55, S * 0.42);
  ctx.lineTo(-S * 0.55, S * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = style.flat ? style.primary : '#1f2937';
  ctx.font = `900 ${S * 0.55}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, S * 0.06);
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.8);
}

function people(ctx, m) {
  const { t, dur, S, style } = m;
  const fade = outFade(t, dur);
  const colors = [style.primary, style.secondary, style.accent, '#60a5fa', '#34d399'];
  ctx.save();
  ctx.globalAlpha *= fade;
  for (let i = 0; i < 5; i++) {
    const k = pop(t - i * 0.08, 0.32);
    if (k <= 0) continue;
    const x = m.x + (i - 2) * S * 0.42;
    const y = m.y - Math.sin((i / 4) * Math.PI) * S * 0.12;
    const r = S * 0.24;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    applyLook(ctx, style, colors[i], S);
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(0, -r * 0.18, r * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.75, r * 0.65, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#0b0d12';
    ctx.lineWidth = S * 0.025;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  const count = Math.round(10 * Easing.outCubic(clamp((t - 0.3) / 1, 0, 1)));
  drawLabel(ctx, m, `+${count}K ${m.label || ''}`.trim(), m.x, m.y + S * 0.55);
}

function check(ctx, m) {
  const { t, dur, S, style } = m;
  const k = pop(t, 0.35);
  const fade = outFade(t, dur);
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(k, k);
  ctx.globalAlpha *= fade;
  applyLook(ctx, style, '#22c55e', S);
  ctx.fillStyle = style.flat ? 'rgba(2,6,23,0.6)' : '#22c55e';
  ctx.beginPath();
  ctx.arc(0, 0, S * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = style.flat ? style.primary : '#ffffff';
  ctx.lineWidth = S * 0.08;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const q = Easing.outCubic(clamp((t - 0.2) / 0.4, 0, 1));
  const pts = [[-S * 0.2, 0], [-S * 0.05, S * 0.15], [S * 0.22, -S * 0.15]];
  const L1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  const L2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const len = (L1 + L2) * q;
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  if (len <= L1) ctx.lineTo(lerp(pts[0][0], pts[1][0], len / L1), lerp(pts[0][1], pts[1][1], len / L1));
  else {
    ctx.lineTo(...pts[1]);
    const f = (len - L1) / L2;
    ctx.lineTo(lerp(pts[1][0], pts[2][0], f), lerp(pts[1][1], pts[2][1], f));
  }
  ctx.stroke();
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.72);
}


function musicNotes(ctx, m) {
  const { t, dur, S, style, intensity } = m;
  const rnd = seeded(m.seed);
  const fade = outFade(t, dur);
  const n = Math.round(7 * clamp(intensity, 0.4, 1.5) * Math.max(0.6, style.density));
  const colors = [style.primary, style.secondary, style.accent];
  for (let i = 0; i < n; i++) {
    const delay = rnd() * 0.9;
    const tt = t - delay;
    if (tt < 0) continue;
    const x = m.x + (rnd() - 0.5) * S * 2.4 + Math.sin(tt * 3 + i) * S * 0.2;
    const y = m.y + S * 0.6 - tt * S * (0.7 + rnd() * 0.5);
    const sz = S * (0.22 + rnd() * 0.16);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(tt * 4 + i) * 0.25);
    const k = pop(tt, 0.3);
    ctx.scale(k, k);
    ctx.globalAlpha *= fade * clamp(1.6 - tt / 1.4, 0, 1);
    const c = colors[i % colors.length];
    applyLook(ctx, style, c, S);
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    ctx.lineWidth = sz * 0.12;
    ctx.beginPath();
    ctx.ellipse(0, 0, sz * 0.32, sz * 0.24, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sz * 0.28, -sz * 0.05);
    ctx.lineTo(sz * 0.28, -sz * 1.0);
    ctx.quadraticCurveTo(sz * 0.6, -sz * 0.8, sz * 0.62, -sz * 0.45);
    ctx.stroke();
    ctx.restore();
  }
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.85);
}

function question(ctx, m) {
  const { t, dur, S, style } = m;
  const k = pop(t, 0.4);
  const fade = outFade(t, dur);
  ctx.save();
  ctx.translate(m.x, m.y - Math.abs(Math.sin(t * 5)) * S * 0.06);
  ctx.rotate(Math.sin(t * 3) * 0.12);
  ctx.scale(k, k);
  ctx.globalAlpha *= fade;
  applyLook(ctx, style, style.secondary, S);
  ctx.fillStyle = style.flat ? 'rgba(2,6,23,0.65)' : style.secondary;
  ctx.beginPath();
  ctx.arc(0, 0, S * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  if (style.flat) {
    ctx.strokeStyle = style.secondary;
    ctx.lineWidth = S * 0.04;
    ctx.stroke();
  }
  ctx.fillStyle = style.flat ? style.secondary : '#ffffff';
  ctx.font = `900 ${S * 0.7}px "${style.font}", Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, S * 0.04);
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.75);
}

function lightning(ctx, m) {
  const { t, dur, S, style } = m;
  const k = pop(t, 0.25);
  const fade = outFade(t, dur);
  const flash = t < 0.5 ? (Math.floor(t * 20) % 2 ? 1 : 0.4) : 1;
  const col = style.flat ? style.primary : '#facc15';
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(k, k);
  ctx.globalAlpha *= fade * flash;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 1.1);
  g.addColorStop(0, rgba(col, 0.45));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-S * 1.1, -S * 1.1, S * 2.2, S * 2.2);
  ctx.shadowColor = col;
  ctx.shadowBlur = S * 0.35;
  ctx.fillStyle = col;
  ctx.strokeStyle = style.flat ? style.accent : '#78350f';
  ctx.lineWidth = S * 0.035;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(S * 0.12, -S * 0.62);
  ctx.lineTo(-S * 0.28, S * 0.06);
  ctx.lineTo(-S * 0.02, S * 0.06);
  ctx.lineTo(-S * 0.14, S * 0.62);
  ctx.lineTo(S * 0.3, -S * 0.1);
  ctx.lineTo(S * 0.03, -S * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.stroke();
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.85);
}

function thumbsUp(ctx, m) {
  const { t, dur, S, style } = m;
  const k = pop(t, 0.4);
  const fade = outFade(t, dur);
  const bump = 1 + 0.08 * Math.max(0, Math.sin((t - 0.4) * 10)) * (t > 0.4 && t < 1 ? 1 : 0);
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(k * bump, k * bump);
  ctx.rotate(-0.12 + Math.sin(t * 4) * 0.05);
  ctx.globalAlpha *= fade;
  applyLook(ctx, style, style.accent, S);
  ctx.fillStyle = style.flat ? 'rgba(2,6,23,0.6)' : '#3b82f6';
  ctx.beginPath();
  ctx.arc(0, 0, S * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = style.flat ? style.primary : '#ffffff';
  rr(ctx, -S * 0.26, -S * 0.02, S * 0.12, S * 0.3, S * 0.03);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-S * 0.1, -S * 0.02);
  ctx.lineTo(S * 0.0, -S * 0.3);
  ctx.quadraticCurveTo(S * 0.06, -S * 0.36, S * 0.1, -S * 0.28);
  ctx.lineTo(S * 0.06, -S * 0.06);
  ctx.lineTo(S * 0.22, -S * 0.06);
  ctx.quadraticCurveTo(S * 0.3, -S * 0.04, S * 0.26, S * 0.06);
  ctx.lineTo(S * 0.2, S * 0.24);
  ctx.quadraticCurveTo(S * 0.17, S * 0.29, S * 0.1, S * 0.28);
  ctx.lineTo(-S * 0.1, S * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.78);
}

function stars(ctx, m) {
  const { t, dur, S, style } = m;
  const fade = outFade(t, dur);
  ctx.save();
  ctx.globalAlpha *= fade;
  for (let i = 0; i < 5; i++) {
    const k = pop(t - 0.1 - i * 0.1, 0.3);
    if (k <= 0) continue;
    ctx.save();
    ctx.translate(m.x + (i - 2) * S * 0.42, m.y - Math.sin((i / 4) * Math.PI) * S * 0.12);
    ctx.scale(k, k);
    ctx.rotate(Math.sin(t * 3 + i) * 0.1);
    applyLook(ctx, style, style.primary, S);
    star5(ctx, S * 0.2);
    if (style.flat) {
      ctx.strokeStyle = style.primary;
      ctx.lineWidth = S * 0.03;
      ctx.stroke();
    } else {
      const g = ctx.createLinearGradient(0, -S * 0.2, 0, S * 0.2);
      g.addColorStop(0, '#fef08a');
      g.addColorStop(1, '#f59e0b');
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
  drawLabel(ctx, m, m.label, m.x, m.y + S * 0.5);
}

/* ------------------------------------------------------------------------------------------ */
/* Tipografia cinética                                                                         */
/* ------------------------------------------------------------------------------------------ */

function typoTokens(m) {
  const tokens = tokenize(m.text || '');
  const hl = new Set((m.highlights || []).map((h) => h.toLowerCase()));
  return tokens.map((tk) => {
    const n = tk.text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '');
    const highlight = !tk.br && hl.has(n);
    return { ...tk, highlight, layoutScale: highlight ? 1.18 : 1 };
  });
}

function typoStyle(m, extra = {}) {
  const s = m.style;
  return {
    font: s.font,
    weight: s.weight,
    color: s.text,
    stroke: s.outline ? 5 : 0,
    strokeColor: '#0b0b12',
    shadow: !s.glow,
    glow: s.glow ? s.accent : null,
    uppercase: s.font === 'Bebas Neue' || s.font === 'Bangers' || s.outline,
    letterSpacing: 0,
    align: 'center',
    highlightColor: s.primary,
    ...extra,
  };
}

function typography(ctx, m, variant) {
  const { t, dur, W, H, style } = m;
  const tokens = typoTokens(m);
  const words = tokens.filter((tk) => !tk.br).length || 1;
  const base = Math.min(W, H) * 0.095 * (m.scale || 1);
  const maxWidth = W * 0.82;
  const stagger = Math.min(0.16, (dur * 0.45) / words);
  const exit = outFade(t, dur, 0.3);
  let wi = -1;
  const order = tokens.map((tk) => (tk.br ? -1 : ++wi));

  if (variant === 'glitch-type') {
    const layer = getCanvas('typo-glitch', W, H);
    const lx = layer.getContext('2d');
    lx.clearRect(0, 0, W, H);
    const reveal = t * 30;
    drawTextBlock(lx, {
      tokens,
      style: typoStyle(m, { stroke: 0, glow: style.accent, letterSpacing: 2 }),
      px: base,
      cx: m.x,
      cy: m.y,
      maxWidth,
      reveal,
      alpha: exit,
      perToken: (i, tk) => (tokens[i]?.highlight ? { color: style.secondary, scale: 1.08 } : null),
    });
    const spike = t < 0.5 ? 1 - t / 0.5 : seeded(Math.floor(t * 10))() > 0.86 ? 0.8 : 0;
    if (spike > 0) glitch(lx, spike, t, `typo${m.seed}`);
    ctx.drawImage(layer, 0, 0);
    return;
  }

  if (variant === 'neon-sign') {
    const flick = t < 0.7 ? (seeded(Math.floor(t * 20) + m.seed)() > 0.45 ? 1 : 0.25) : 1;
    drawTextBlock(ctx, {
      tokens,
      style: typoStyle(m, { stroke: 0, color: '#ffffff', glow: style.primary, letterSpacing: 1 }),
      px: base,
      cx: m.x,
      cy: m.y,
      maxWidth,
      alpha: exit * flick,
      perToken: (i) => (tokens[i]?.highlight ? { glow: style.secondary, color: '#fff', scale: 1.1 } : null),
    });
    return;
  }

  if (variant === 'minimal-line') {
    const st = typoStyle(m, { weight: Math.min(style.weight, 600), stroke: 0, letterSpacing: 6, uppercase: true, shadow: true, glow: null });
    const box = drawTextBlock(ctx, {
      tokens,
      style: st,
      px: base * 0.78,
      cx: m.x,
      cy: m.y,
      maxWidth,
      alpha: exit,
      perToken: (i) => {
        const q = Easing.outCubic(clamp((t - order[i] * stagger * 0.7) / 0.5, 0, 1));
        return { alpha: q, dy: (1 - q) * base * 0.4, color: tokens[i]?.highlight ? style.primary : undefined };
      },
    });
    if (box) {
      const q = Easing.inOutCubic(clamp((t - 0.2) / 0.7, 0, 1));
      ctx.save();
      ctx.globalAlpha *= exit;
      ctx.fillStyle = style.primary;
      const lw = box.w * q;
      ctx.fillRect(m.x - lw / 2, box.y + box.h + base * 0.18, lw, Math.max(1, base * 0.04));
      ctx.restore();
    }
    return;
  }

  if (variant === 'slide-stack') {
    drawTextBlock(ctx, {
      tokens,
      style: typoStyle(m),
      px: base,
      cx: m.x,
      cy: m.y,
      maxWidth,
      alpha: exit,
      perToken: (i) => {
        const q = Easing.outCubic(clamp((t - order[i] * stagger) / 0.35, 0, 1));
        const dir = order[i] % 2 ? -1 : 1;
        const hl = tokens[i]?.highlight;
        return { alpha: q, dy: (1 - q) * base * 0.9 * dir, box: hl, boxColor: style.secondary, color: hl ? '#0b0b12' : undefined };
      },
    });
    return;
  }

  // kinetic-pop (padrão)
  drawTextBlock(ctx, {
    tokens,
    style: typoStyle(m),
    px: base,
    cx: m.x,
    cy: m.y,
    maxWidth,
    alpha: exit,
    perToken: (i) => {
      const ti = order[i] * stagger;
      const q = clamp((t - ti) / 0.28, 0, 1);
      if (q <= 0) return { hidden: true };
      const hl = tokens[i]?.highlight;
      return {
        scale: Easing.outBack(q) * (hl ? 1.16 : 1),
        alpha: clamp(q * 3, 0, 1),
        color: hl ? style.primary : undefined,
        underline: hl ? Easing.outCubic(clamp((t - ti - 0.2) / 0.35, 0, 1)) : 0,
        underlineColor: style.secondary,
        rotate: hl ? Math.sin(t * 6) * 0.02 : 0,
      };
    },
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Câmera e transições                                                                         */
/* ------------------------------------------------------------------------------------------ */

/** Transformação de câmera (aplicada às camadas de vídeo) para um motion de câmera. */
export function cameraTransform(templateId, t, dur, intensity = 1, seed = 1) {
  const p = clamp(t / dur, 0, 1);
  const k = clamp(intensity, 0, 2);
  switch (templateId) {
    case 'punch-zoom': {
      const rise = Easing.outCubic(clamp(t / 0.14, 0, 1));
      const back = 1 - Easing.inOutCubic(clamp((p - 0.62) / 0.38, 0, 1));
      return { scale: 1 + 0.16 * k * rise * back, dx: 0, dy: 0, rot: 0 };
    }
    case 'slow-push':
      return { scale: 1 + 0.09 * k * Easing.inOutQuad(p), dx: 0, dy: 0, rot: 0 };
    case 'shake': {
      const rnd = seeded(seed + Math.floor(t * 30));
      const d = Math.pow(1 - p, 2) * 0.02 * k;
      return { scale: 1.04, dx: (rnd() - 0.5) * d, dy: (rnd() - 0.5) * d, rot: (rnd() - 0.5) * d * 0.8 };
    }
    case 'pan':
      return { scale: 1.1, dx: (0.5 - Easing.inOutQuad(p)) * 0.07 * k, dy: 0, rot: 0 };
    case 'zoom-out-reveal':
      return { scale: 1 + 0.22 * k * (1 - Easing.outCubic(p)), dx: 0, dy: 0, rot: 0 };
    default:
      return { scale: 1, dx: 0, dy: 0, rot: 0 };
  }
}

/** Efeitos de transição/batida aplicados ao quadro inteiro. */
export function applyPostFx(ctx, templateId, m) {
  const { t, dur, W, H, intensity, style } = m;
  const p = clamp(t / dur, 0, 1);
  const bell = Math.sin(Math.PI * p);
  const k = clamp(intensity, 0, 2);
  switch (templateId) {
    case 'flash': {
      const a = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75;
      flashOverlay(ctx, a * 0.85 * k, '#ffffff');
      break;
    }
    case 'glitch-hit':
      glitch(ctx, bell * k, t, `gh${m.seed}`);
      break;
    case 'zoom-blur':
      zoomBlur(ctx, bell * 1.4 * k, 0.5, 0.5);
      break;
    case 'rgb-pulse':
      rgbSplit(ctx, W * 0.012 * bell * k);
      break;
    case 'light-sweep': {
      const x = lerp(-W * 0.4, W * 1.4, Easing.inOutQuad(p));
      const g = ctx.createLinearGradient(x - W * 0.25, 0, x + W * 0.25, H);
      const c = style?.primary || '#ffffff';
      g.addColorStop(0, rgba(c, 0));
      g.addColorStop(0.5, rgba(c, 0.45 * k));
      g.addColorStop(1, rgba(c, 0));
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      break;
    }
    case 'beat-pulse': {
      const src = getCanvas('beat-src', W, H);
      const sx = src.getContext('2d');
      sx.clearRect(0, 0, W, H);
      sx.drawImage(ctx.canvas, 0, 0);
      const s = 1 + 0.045 * bell * k;
      ctx.save();
      ctx.setTransform(s, 0, 0, s, (W * (1 - s)) / 2, (H * (1 - s)) / 2);
      ctx.drawImage(src, 0, 0);
      ctx.restore();
      flashOverlay(ctx, 0.1 * bell * k, '#ffffff');
      break;
    }
    default:
      break;
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Registro                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export const MOTION_TEMPLATES = [
  // Stickers / gráficos contextuais
  { id: 'coins', name: 'Moedas 3D Caindo', category: 'sticker', icon: 'Coins', draw: coins },
  { id: 'rocket', name: 'Foguete Decolando', category: 'sticker', icon: 'Rocket', draw: rocket },
  { id: 'hearts', name: 'Corações Flutuantes', category: 'sticker', icon: 'Heart', draw: hearts },
  { id: 'lightbulb', name: 'Lâmpada da Ideia', category: 'sticker', icon: 'Lightbulb', draw: lightbulb },
  { id: 'chart-up', name: 'Gráfico Subindo', category: 'sticker', icon: 'TrendingUp', draw: chartUp },
  { id: 'clock', name: 'Relógio Animado', category: 'sticker', icon: 'Clock', draw: clock },
  { id: 'trophy', name: 'Troféu + Confete', category: 'sticker', icon: 'Trophy', draw: trophy },
  { id: 'fire', name: 'Fogo', category: 'sticker', icon: 'Flame', draw: fire },
  { id: 'sparkles', name: 'Brilhos Mágicos', category: 'sticker', icon: 'Sparkles', draw: sparkleBurst },
  { id: 'target', name: 'Alvo + Flecha', category: 'sticker', icon: 'Focus', draw: target },
  { id: 'subscribe', name: 'Botão Seguir', category: 'sticker', icon: 'MousePointer2', draw: subscribe },
  { id: 'globe', name: 'Globo Digital', category: 'sticker', icon: 'Globe', draw: globe },
  { id: 'warning', name: 'Alerta', category: 'sticker', icon: 'TriangleAlert', draw: warning },
  { id: 'people', name: 'Público / Comunidade', category: 'sticker', icon: 'Users', draw: people },
  { id: 'check', name: 'Check Animado', category: 'sticker', icon: 'CircleCheck', draw: check },
  { id: 'music', name: 'Notas Musicais', category: 'sticker', icon: 'Music', draw: musicNotes },
  { id: 'question', name: 'Pergunta', category: 'sticker', icon: 'CircleHelp', draw: question },
  { id: 'lightning', name: 'Raio de Energia', category: 'sticker', icon: 'Zap', draw: lightning },
  { id: 'thumbs-up', name: 'Joinha / Like', category: 'sticker', icon: 'ThumbsUp', draw: thumbsUp },
  { id: 'stars', name: 'Avaliação 5 Estrelas', category: 'sticker', icon: 'Star', draw: stars },
  // Tipografia
  { id: 'kinetic-pop', name: 'Kinetic Pop', category: 'typography', icon: 'Type', draw: (c, m) => typography(c, m, 'kinetic-pop') },
  { id: 'slide-stack', name: 'Slide Stack', category: 'typography', icon: 'Type', draw: (c, m) => typography(c, m, 'slide-stack') },
  { id: 'glitch-type', name: 'Glitch Type', category: 'typography', icon: 'Type', draw: (c, m) => typography(c, m, 'glitch-type') },
  { id: 'minimal-line', name: 'Minimal Line', category: 'typography', icon: 'Type', draw: (c, m) => typography(c, m, 'minimal-line') },
  { id: 'neon-sign', name: 'Letreiro Neon', category: 'typography', icon: 'Type', draw: (c, m) => typography(c, m, 'neon-sign') },
  // Câmera
  { id: 'punch-zoom', name: 'Punch Zoom (Ênfase)', category: 'camera', icon: 'ZoomIn' },
  { id: 'slow-push', name: 'Push-in Suave', category: 'camera', icon: 'Focus' },
  { id: 'shake', name: 'Tremor de Impacto', category: 'camera', icon: 'Activity' },
  { id: 'pan', name: 'Pan Cinemático', category: 'camera', icon: 'Move' },
  { id: 'zoom-out-reveal', name: 'Zoom-out Revelação', category: 'camera', icon: 'ZoomOut' },
  // Transições no beat
  { id: 'flash', name: 'Flash no Beat', category: 'transition', icon: 'Zap' },
  { id: 'glitch-hit', name: 'Glitch Hit', category: 'transition', icon: 'Zap' },
  { id: 'zoom-blur', name: 'Zoom Blur', category: 'transition', icon: 'Zap' },
  { id: 'rgb-pulse', name: 'Pulso RGB', category: 'transition', icon: 'Zap' },
  { id: 'light-sweep', name: 'Varredura de Luz', category: 'transition', icon: 'Zap' },
  { id: 'beat-pulse', name: 'Pulso de Batida', category: 'transition', icon: 'Zap' },
];

export const getTemplate = (id) => MOTION_TEMPLATES.find((m) => m.id === id) || MOTION_TEMPLATES[0];

export const MOTION_CATEGORIES = {
  sticker: { label: 'Sticker / Gráfico', color: '#f59e0b' },
  typography: { label: 'Tipografia', color: '#a855f7' },
  camera: { label: 'Câmera', color: '#22d3ee' },
  transition: { label: 'Transição', color: '#ec4899' },
};
