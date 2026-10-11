/** Geração de legendas automáticas (estilo TikTok/Reels) a partir da transcrição. */

export function buildCaptionChunks(transcript, { maxWords = 4, maxDur = 1.8 } = {}) {
  const chunks = [];
  for (const s of transcript.sentences) {
    let cur = [];
    const flush = () => {
      if (cur.length) chunks.push(cur);
      cur = [];
    };
    for (const w of s.words) {
      if (cur.length && (cur.length >= maxWords || w.end - cur[0].start > maxDur)) flush();
      cur.push(w);
      if (/[,;:]$/.test(w.w) && cur.length >= 2) flush();
    }
    flush();
  }
  return chunks.map((ws, i) => {
    const next = chunks[i + 1];
    const start = Math.max(0, ws[0].start - 0.05);
    let end = ws[ws.length - 1].end + 0.25;
    if (next) end = Math.min(end, next[0].start - 0.05);
    end = Math.max(end, start + 0.3);
    return {
      start,
      duration: end - start,
      words: ws.map((w) => ({ w: w.w.replace(/[.,;:!?]+$/, ''), start: w.start - start, end: w.end - start, emphasis: w.emphasis })),
    };
  });
}
