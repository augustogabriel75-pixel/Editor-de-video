/**
 * Fontes de vídeo procedurais (sem arquivos externos). Cada fonte desenha um quadro
 * em função do tempo, então se comporta exatamente como um vídeo: pode ser cortada,
 * acelerada, filtrada, ter chroma key aplicado, etc.
 */
import { seeded } from '../lib/utils';
import { activeWordAt } from '../ai/demoTranscript';

export const DEMO_ASSETS = [
  { id: 'demo-presenter', type: 'video', demoId: 'presenter', name: 'Apresentador · Estúdio', duration: 60, category: 'Demo', width: 1920, height: 1080 },
  { id: 'demo-presenter-green', type: 'video', demoId: 'presenter', variant: 'green', name: 'Apresentador · Green Screen', duration: 60, category: 'Green Screen', width: 1920, height: 1080 },
  { id: 'demo-charts', type: 'video', demoId: 'charts', name: 'Gráficos Financeiros', duration: 20, category: 'B-roll', width: 1920, height: 1080 },
  { id: 'demo-city', type: 'video', demoId: 'city', name: 'Cidade Neon', duration: 30, category: 'B-roll', width: 1920, height: 1080 },
  { id: 'demo-nature', type: 'video', demoId: 'nature', name: 'Pôr do Sol', duration: 30, category: 'B-roll', width: 1920, height: 1080 },
  { id: 'demo-laptop', type: 'video', demoId: 'laptop', name: 'Workspace', duration: 30, category: 'B-roll', width: 1920, height: 1080 },
  { id: 'demo-abstract', type: 'video', demoId: 'abstract', name: 'Fundo Abstrato', duration: 30, category: 'Fundos', width: 1920, height: 1080 },
];

/* ------------------------------------------------------------------------------------------ */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

function drawPresenter(ctx, t, w, h, variant) {
  const u = h;
  if (variant === 'green') {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, '#16c75a');
    g.addColorStop(1, '#0b9c41');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (variant !== 'cutout') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#1e1b4b');
    g.addColorStop(0.55, '#0f172a');
    g.addColorStop(1, '#172554');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rnd = seeded(7);
    for (let i = 0; i < 9; i++) {
      const bx = (rnd() * w + Math.sin(t * 0.2 + i) * w * 0.02) % w;
      const by = rnd() * h * 0.7;
      const br = (0.05 + rnd() * 0.08) * h;
      const col = i % 3 === 0 ? '168,85,247' : i % 3 === 1 ? '34,211,238' : '236,72,153';
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      rg.addColorStop(0, `rgba(${col},${0.22 + 0.1 * Math.sin(t + i)})`);
      rg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = rg;
      ctx.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    const spot = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, h * 0.6);
    spot.addColorStop(0, 'rgba(148,163,255,0.22)');
    spot.addColorStop(1, 'rgba(148,163,255,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, w, h);
    // prateleira com objetos ao fundo
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(w * 0.06, h * 0.36, w * 0.22, h * 0.012);
    ctx.fillRect(w * 0.72, h * 0.3, w * 0.22, h * 0.012);
    ctx.fillStyle = 'rgba(34,211,238,0.5)';
    ctx.fillRect(w * 0.09, h * 0.27, w * 0.025, h * 0.09);
    ctx.fillStyle = 'rgba(236,72,153,0.45)';
    ctx.fillRect(w * 0.13, h * 0.3, w * 0.04, h * 0.06);
    ctx.fillStyle = 'rgba(250,204,21,0.5)';
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.26, h * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }

  const word = activeWordAt(t);
  const speaking = !!word;
  const emph = word ? word.emphasis : 0;
  const cx = w / 2 + Math.sin(t * 0.7) * u * 0.006 + (speaking ? Math.sin(t * 3.1) * u * 0.004 : 0);
  const headY = h * 0.42 + Math.sin(t * 1.3) * u * 0.004 - emph * u * 0.006;
  const tilt = Math.sin(t * 0.9) * 0.03 + (speaking ? Math.sin(t * 2.3) * 0.02 : 0);

  // corpo
  ctx.save();
  ctx.translate(cx, h);
  const bw = u * 0.62;
  const bodyG = ctx.createLinearGradient(0, -u * 0.36, 0, 0);
  bodyG.addColorStop(0, '#1f2937');
  bodyG.addColorStop(1, '#0b1020');
  ctx.fillStyle = bodyG;
  ctx.beginPath();
  ctx.moveTo(-bw / 2, 0);
  ctx.bezierCurveTo(-bw / 2, -u * 0.22, -bw * 0.38, -u * 0.32, -u * 0.08, -u * 0.34);
  ctx.lineTo(u * 0.08, -u * 0.34);
  ctx.bezierCurveTo(bw * 0.38, -u * 0.32, bw / 2, -u * 0.22, bw / 2, 0);
  ctx.closePath();
  ctx.fill();
  // camisa (V)
  ctx.fillStyle = '#e0f2fe';
  ctx.beginPath();
  ctx.moveTo(-u * 0.07, -u * 0.34);
  ctx.lineTo(0, -u * 0.2);
  ctx.lineTo(u * 0.07, -u * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.moveTo(-u * 0.012, -u * 0.3);
  ctx.lineTo(u * 0.012, -u * 0.3);
  ctx.lineTo(u * 0.02, -u * 0.16);
  ctx.lineTo(0, -u * 0.12);
  ctx.lineTo(-u * 0.02, -u * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // pescoço
  ctx.fillStyle = '#d9a066';
  ctx.fillRect(cx - u * 0.04, headY + u * 0.08, u * 0.08, u * 0.12);

  // cabeça
  ctx.save();
  ctx.translate(cx, headY);
  ctx.rotate(tilt);
  const skin = ctx.createRadialGradient(-u * 0.03, -u * 0.03, u * 0.02, 0, 0, u * 0.15);
  skin.addColorStop(0, '#f3c48f');
  skin.addColorStop(1, '#c98a55');
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, 0, u * 0.1, u * 0.128, 0, 0, Math.PI * 2);
  ctx.fill();
  // orelhas
  ctx.beginPath();
  ctx.ellipse(-u * 0.1, u * 0.01, u * 0.018, u * 0.03, 0, 0, Math.PI * 2);
  ctx.ellipse(u * 0.1, u * 0.01, u * 0.018, u * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
  // cabelo
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.ellipse(0, -u * 0.06, u * 0.108, u * 0.085, 0, Math.PI, 0);
  ctx.quadraticCurveTo(u * 0.11, -u * 0.02, u * 0.098, u * 0.0);
  ctx.quadraticCurveTo(u * 0.06, -u * 0.07, -u * 0.04, -u * 0.075);
  ctx.quadraticCurveTo(-u * 0.09, -u * 0.06, -u * 0.098, u * 0.0);
  ctx.closePath();
  ctx.fill();
  // olhos (com piscadas)
  const blink = (t % 3.7) < 0.12 ? 0.1 : 1;
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.ellipse(-u * 0.036, -u * 0.005, u * 0.011, u * 0.013 * blink, 0, 0, Math.PI * 2);
  ctx.ellipse(u * 0.036, -u * 0.005, u * 0.011, u * 0.013 * blink, 0, 0, Math.PI * 2);
  ctx.fill();
  // sobrancelhas
  const brow = emph > 0.9 ? u * 0.008 : 0;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = u * 0.008;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-u * 0.055, -u * 0.035 - brow);
  ctx.lineTo(-u * 0.02, -u * 0.04 - brow);
  ctx.moveTo(u * 0.02, -u * 0.04 - brow);
  ctx.lineTo(u * 0.055, -u * 0.035 - brow);
  ctx.stroke();
  // nariz
  ctx.strokeStyle = 'rgba(120,60,30,0.5)';
  ctx.lineWidth = u * 0.005;
  ctx.beginPath();
  ctx.moveTo(0, u * 0.0);
  ctx.quadraticCurveTo(u * 0.01, u * 0.03, -u * 0.004, u * 0.035);
  ctx.stroke();
  // boca sincronizada com a fala
  const open = speaking ? (0.25 + 0.75 * Math.abs(Math.sin(t * 17 + word.start * 9))) * (0.6 + emph * 0.5) : 0.05;
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.068, u * 0.026, u * (0.004 + 0.02 * open), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCharts(ctx, t, w, h) {
  ctx.fillStyle = '#060b16';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(56,189,248,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += w / 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += h / 9) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const rnd = seeded(42);
  const pts = [];
  let v = 0.75;
  for (let i = 0; i <= 40; i++) {
    v -= (rnd() - 0.35) * 0.04;
    pts.push([w * 0.06 + (i / 40) * w * 0.88, h * Math.max(0.12, v)]);
  }
  const reveal = Math.min(1, (t % 10) / 4);
  const n = Math.max(2, Math.floor(pts.length * reveal));
  // barras
  for (let i = 0; i < 14; i++) {
    const bh = h * (0.08 + 0.3 * (i / 14) * Math.min(1, ((t % 10) * 1.4 - i * 0.12)));
    if (bh <= 0) continue;
    ctx.fillStyle = i % 2 ? 'rgba(34,197,94,0.25)' : 'rgba(34,211,238,0.22)';
    ctx.fillRect(w * 0.08 + i * w * 0.062, h * 0.92 - bh, w * 0.04, bh);
  }
  ctx.save();
  ctx.shadowColor = '#22c55e';
  ctx.shadowBlur = h * 0.03;
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = h * 0.008;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
  const [lx, ly] = pts[n - 1];
  ctx.fillStyle = '#bbf7d0';
  ctx.beginPath();
  ctx.arc(lx, ly, h * 0.012, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = `800 ${h * 0.075}px Inter, sans-serif`;
  ctx.textBaseline = 'top';
  const value = Math.floor(1200 + reveal * 11280);
  ctx.fillText(`R$ ${value.toLocaleString('pt-BR')}`, w * 0.06, h * 0.06);
  ctx.fillStyle = '#4ade80';
  ctx.font = `700 ${h * 0.045}px Inter, sans-serif`;
  ctx.fillText(`▲ +${Math.floor(reveal * 248)}%`, w * 0.06, h * 0.16);
}

function drawCity(ctx, t, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#020617');
  sky.addColorStop(0.55, '#312e81');
  sky.addColorStop(0.8, '#9d174d');
  sky.addColorStop(1, '#f97316');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const rnd = seeded(3);
  for (let i = 0; i < 60; i++) {
    const a = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.5 + rnd()) + i));
    ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`;
    ctx.fillRect(rnd() * w, rnd() * h * 0.45, h * 0.003, h * 0.003);
  }
  ctx.fillStyle = '#fef9c3';
  ctx.beginPath();
  ctx.arc(w * 0.8, h * 0.18, h * 0.06, 0, Math.PI * 2);
  ctx.fill();
  const layers = [
    { speed: 8, color: '#1e1b4b', base: 0.55, seed: 11 },
    { speed: 22, color: '#0f0a24', base: 0.68, seed: 21 },
  ];
  for (const L of layers) {
    const r = seeded(L.seed);
    const offset = (t * L.speed * (h / 540)) % (w * 0.5);
    let x = -offset;
    while (x < w * 1.2) {
      const bw = w * (0.04 + r() * 0.07);
      const bh = h * (0.18 + r() * 0.35);
      const top = h * L.base - bh + h * 0.3;
      ctx.fillStyle = L.color;
      ctx.fillRect(x, top, bw, h - top);
      const cols = Math.max(2, Math.floor(bw / (h * 0.022)));
      for (let c = 0; c < cols; c++) {
        for (let row = 0; row < bh / (h * 0.03); row++) {
          const on = Math.sin(c * 7.1 + row * 3.3 + Math.floor(t * 0.6 + x) * 0.7) > 0.35;
          if (!on) continue;
          ctx.fillStyle = (c + row) % 5 === 0 ? 'rgba(34,211,238,0.85)' : 'rgba(253,224,71,0.75)';
          ctx.fillRect(x + c * (bw / cols) + bw * 0.08, top + h * 0.012 + row * h * 0.03, bw / cols * 0.45, h * 0.012);
        }
      }
      x += bw + w * 0.006;
    }
  }
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, h * 0.9, w, h * 0.1);
  for (let i = 0; i < 6; i++) {
    const px = ((t * 0.35 + i / 6) % 1) * w * 1.3 - w * 0.15;
    const grad = ctx.createLinearGradient(px - w * 0.12, 0, px, 0);
    grad.addColorStop(0, 'rgba(239,68,68,0)');
    grad.addColorStop(1, i % 2 ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.9)');
    ctx.fillStyle = grad;
    ctx.fillRect(px - w * 0.12, h * (0.93 + (i % 2) * 0.03), w * 0.12, h * 0.008);
  }
}

function drawNature(ctx, t, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#4c1d95');
  sky.addColorStop(0.45, '#db2777');
  sky.addColorStop(0.75, '#fb923c');
  sky.addColorStop(1, '#fde68a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sunY = h * (0.5 + (t % 30) * 0.004);
  const sg = ctx.createRadialGradient(w * 0.5, sunY, 0, w * 0.5, sunY, h * 0.35);
  sg.addColorStop(0, 'rgba(255,247,200,1)');
  sg.addColorStop(0.25, 'rgba(253,224,71,0.9)');
  sg.addColorStop(1, 'rgba(253,186,116,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, h);
  const ranges = [
    { y: 0.62, amp: 0.12, color: '#7c2d12', speed: 4, seed: 5 },
    { y: 0.72, amp: 0.1, color: '#431407', speed: 9, seed: 9 },
    { y: 0.84, amp: 0.07, color: '#1c0a05', speed: 16, seed: 13 },
  ];
  for (const R of ranges) {
    const r = seeded(R.seed);
    const ph = r() * 10;
    const off = t * R.speed * (h / 540);
    ctx.fillStyle = R.color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 60) {
      const xx = (x + off) / w;
      const y = h * (R.y - R.amp * (0.5 + 0.5 * Math.sin(xx * 5 + ph) * Math.cos(xx * 2.3 + ph)));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(20,10,10,0.8)';
  ctx.lineWidth = h * 0.004;
  for (let i = 0; i < 5; i++) {
    const bx = ((t * 0.05 + i * 0.13) % 1.2) * w - w * 0.1;
    const by = h * (0.25 + i * 0.04) + Math.sin(t * 2 + i) * h * 0.01;
    const f = Math.sin(t * 8 + i) * h * 0.01;
    ctx.beginPath();
    ctx.moveTo(bx - h * 0.02, by - f);
    ctx.quadraticCurveTo(bx - h * 0.01, by - h * 0.01, bx, by);
    ctx.quadraticCurveTo(bx + h * 0.01, by - h * 0.01, bx + h * 0.02, by - f);
    ctx.stroke();
  }
}

function drawLaptop(ctx, t, w, h) {
  const desk = ctx.createLinearGradient(0, 0, 0, h);
  desk.addColorStop(0, '#3f2a1d');
  desk.addColorStop(1, '#22150d');
  ctx.fillStyle = desk;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  const sway = Math.sin(t * 0.3) * h * 0.01;
  ctx.translate(sway, 0);
  const lx = w * 0.24;
  const ly = h * 0.14;
  const lw = w * 0.52;
  const lh = h * 0.58;
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, lx - h * 0.02, ly - h * 0.02, lw + h * 0.04, lh + h * 0.04, h * 0.02);
  ctx.fill();
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(lx, ly, lw, lh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(lx, ly, lw, lh);
  ctx.clip();
  const rnd = seeded(77);
  const lineH = lh / 14;
  const scroll = (t * lineH * 0.8) % (lineH * 40);
  const palette = ['#c084fc', '#22d3ee', '#4ade80', '#f472b6', '#fbbf24', '#94a3b8'];
  for (let i = 0; i < 40; i++) {
    const y = ly + i * lineH - scroll + lineH * 0.3;
    let x = lx + lw * 0.05 + (rnd() * 3 | 0) * lw * 0.04;
    const parts = 1 + Math.floor(rnd() * 4);
    for (let p = 0; p < parts; p++) {
      const pw = lw * (0.05 + rnd() * 0.18);
      ctx.fillStyle = palette[(rnd() * palette.length) | 0];
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, pw, lineH * 0.42);
      x += pw + lw * 0.015;
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(lx - h * 0.08, ly + lh + h * 0.03);
  ctx.lineTo(lx + lw + h * 0.08, ly + lh + h * 0.03);
  ctx.lineTo(lx + lw + h * 0.14, h * 0.86);
  ctx.lineTo(lx - h * 0.14, h * 0.86);
  ctx.closePath();
  ctx.fill();
  // caneca com vapor
  const mx = w * 0.86;
  const my = h * 0.66;
  ctx.fillStyle = '#e2e8f0';
  roundRect(ctx, mx - h * 0.06, my, h * 0.12, h * 0.15, h * 0.02);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = h * 0.006;
  for (let s = 0; s < 3; s++) {
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) {
      const yy = my - k * h * 0.008;
      const xx = mx + (s - 1) * h * 0.03 + Math.sin(k * 0.5 + t * 3 + s) * h * 0.01;
      k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }
  // planta
  ctx.fillStyle = '#166534';
  for (let i = 0; i < 7; i++) {
    ctx.save();
    ctx.translate(w * 0.1, h * 0.8);
    ctx.rotate(-1.2 + i * 0.4 + Math.sin(t + i) * 0.03);
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.12, h * 0.03, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawAbstract(ctx, t, w, h) {
  ctx.fillStyle = '#05010f';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const blobs = [
    ['168,85,247', 0.3, 0.4, 0.7, 1.1],
    ['34,211,238', 0.7, 0.6, 0.9, 0.7],
    ['236,72,153', 0.5, 0.3, 1.3, 0.9],
    ['59,130,246', 0.2, 0.7, 0.6, 1.4],
  ];
  blobs.forEach(([c, bx, by, fx, fy], i) => {
    const x = w * (bx + 0.2 * Math.sin(t * 0.3 * fx + i));
    const y = h * (by + 0.2 * Math.cos(t * 0.25 * fy + i * 2));
    const r = h * (0.45 + 0.1 * Math.sin(t * 0.5 + i));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${c},0.75)`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += w / 40) {
      const y = h * (i / 12) + Math.sin(x / w * 6 + t * 0.6 + i) * h * 0.03;
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
}

const DRAWERS = {
  presenter: drawPresenter,
  charts: drawCharts,
  city: drawCity,
  nature: drawNature,
  laptop: drawLaptop,
  abstract: drawAbstract,
};

const slots = new Map();

/**
 * Desenha a fonte demo `demoId` no instante `t` dentro de um canvas reservado ao `slotKey`
 * e retorna o canvas (equivalente a um quadro de vídeo decodificado).
 */
export function getDemoFrame(demoId, t, { variant = null, height = 540, slotKey = 'default' } = {}) {
  const width = Math.round((height * 16) / 9);
  const key = `${slotKey}:${height}`;
  let canvas = slots.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    slots.set(key, canvas);
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  (DRAWERS[demoId] || drawAbstract)(ctx, Math.max(0, t), width, height, variant);
  ctx.restore();
  return canvas;
}

/** Miniatura (dataURL) de uma fonte demo. */
export function demoThumbnail(asset, t = 1.6, height = 180) {
  const c = getDemoFrame(asset.demoId, t, { variant: asset.variant, height, slotKey: `thumb-${asset.id}` });
  return c.toDataURL('image/jpeg', 0.82);
}
