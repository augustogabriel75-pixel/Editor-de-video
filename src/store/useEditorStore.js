/**
 * Estado global do MotionCut (Zustand).
 * Controla: projeto, trilhas/clipes da timeline, reprodução (play/pause/seek), seleção,
 * histórico (desfazer/refazer), UI e o motor de IA Motion.
 *
 * Todas as atualizações são imutáveis — o histórico guarda apenas referências (structural sharing).
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { clamp, uid, FRAME, snapToFrame, isActiveAt } from '../lib/utils';
import { createDemoProject } from '../lib/demoProject';
import {
  accepts,
  clipKindForAsset,
  mediaClip,
  textClip,
  captionClip,
  motionClip,
  baseClip,
  findFreeStart,
  splitClip,
  rippleDeleteRange,
  computeDuration,
} from '../lib/clipFactory';
import { TEXT_STYLES, CAPTION_PRESETS } from '../lib/catalog';
import { clipSourceSpan, curveAverage, getCurve, hasCurve } from '../lib/speedCurves';
import { getTransformAt, keyframeAt, sortKeyframes, TRANSFORM_KEYS } from '../lib/keyframes';
import { analyzeContext, PIPELINE_STEPS } from '../ai/contextAnalyzer';
import { generateMotions, AI_LANES } from '../ai/motionGenerator';
import { parsePrompt } from '../ai/promptParser';
import { transcribe } from '../ai/transcriber';
import { buildCaptionChunks } from '../ai/captionGenerator';
import { mergeStyles } from '../engine/motionStyles';
import { getTemplate } from '../engine/motionTemplates';

const demo = createDemoProject();

const DEFAULT_PROMPT = 'Gere um motion estilo minimalista futurista para a fala atual';

const initialAI = {
  status: 'idle', // idle | analyzing | ready | error
  progress: 0,
  steps: PIPELINE_STEPS.map((s) => ({ ...s, status: 'pending' })),
  analysis: null,
  prompt: DEFAULT_PROMPT,
  scriptText: '',
  options: { stickers: true, typography: true, camera: true, transitions: true, sfx: true, intensity: 70, styleId: 'auto' },
  render: null, // { total, done, pending: [ids] }
  lastRun: null,
  error: null,
};

let historyKey = null;
let historyAt = 0;
let renderTimer = null;

const snap = (s) => ({ project: s.project, tracks: s.tracks, clips: s.clips });

export const useEditorStore = create(
  subscribeWithSelector((set, get) => {
    /* ---------------------------------------------------------------- helpers internos */
    const checkpoint = (key = null) => {
      const now = Date.now();
      if (key && key === historyKey && now - historyAt < 1200) {
        historyAt = now;
        return;
      }
      historyKey = key;
      historyAt = now;
      const s = get();
      set({ past: [...s.past.slice(-99), snap(s)], future: [] });
    };

    const commitClips = (clips, extra = {}) => {
      const duration = computeDuration(clips);
      const s = get();
      set({ clips, duration, currentTime: Math.min(s.currentTime, duration), ...extra });
    };

    const toast = (msg, type = 'info') => {
      const id = uid('toast');
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, msg, type }] }));
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3600);
    };

    const trackById = (id) => get().tracks.find((t) => t.id === id);
    const clipById = (id) => get().clips.find((c) => c.id === id);
    const onTrack = (trackId, excludeId) => get().clips.filter((c) => c.trackId === trackId && c.id !== excludeId);

    const patchClip = (id, fn) => get().clips.map((c) => (c.id === id ? fn(c) : c));

    const selectedVisual = () => {
      const s = get();
      const sel = clipById(s.selectedClipId);
      if (sel && (sel.kind === 'video' || sel.kind === 'image')) return sel;
      return s.clips.find((c) => c.trackId === 'trk-main' && isActiveAt(c, s.currentTime)) || null;
    };

    /**
     * Aplica uma nova duração ao clipe. Na trilha principal (magnética, como no CapCut) os clipes
     * seguintes acompanham a mudança; nas demais, só são empurrados se houver sobreposição.
     */
    const resizeWithRipple = (clips, clip, newDuration, patch = {}) => {
      const ratio = newDuration / clip.duration;
      const updated = { ...clip, ...patch, duration: newDuration, keyframes: (clip.keyframes || []).map((k) => ({ ...k, t: k.t * ratio })) };
      const oldEnd = clip.start + clip.duration;
      const newEnd = clip.start + newDuration;
      const after = (c) => c.trackId === clip.trackId && c.id !== clip.id && c.start >= oldEnd - 1e-3;
      const next = clips.filter(after).sort((a, b) => a.start - b.start)[0];
      let shift = 0;
      if (clip.trackId === 'trk-main' && next && Math.abs(next.start - oldEnd) < 0.05) shift = newEnd - oldEnd;
      else if (next && newEnd > next.start) shift = newEnd - next.start;
      return clips.map((c) => {
        if (c.id === clip.id) return updated;
        if (shift && after(c)) return { ...c, start: Math.max(0, c.start + shift) };
        return c;
      });
    };

    const ensureTranscript = async () => {
      const s = get();
      if (s.ai.analysis?.transcript?.words?.length) return s.ai.analysis.transcript;
      const tr = await transcribe(s, { tracks: [] }, s.ai.scriptText);
      return tr;
    };

    const startAIRender = (ids) => {
      clearInterval(renderTimer);
      if (!ids.length) return;
      set((s) => ({ ai: { ...s.ai, render: { total: ids.length, done: 0, pending: ids } } }));
      renderTimer = setInterval(() => {
        const r = get().ai.render;
        if (!r) return clearInterval(renderTimer);
        const pending = r.pending.slice(1);
        if (!pending.length) {
          clearInterval(renderTimer);
          set((s) => ({ ai: { ...s.ai, render: null } }));
          return;
        }
        set((s) => ({ ai: { ...s.ai, render: { ...r, done: r.done + 1, pending } } }));
      }, 110);
    };

    /* ---------------------------------------------------------------- estado + ações */
    return {
      project: demo.project,
      tracks: demo.tracks,
      clips: demo.clips,
      assets: demo.assets,
      duration: computeDuration(demo.clips),

      isPlaying: false,
      currentTime: 0,
      seekNonce: 0,
      previewVolume: 1,
      exporting: false,

      selectedClipId: null,
      leftTab: 'ai',
      inspectorTab: null,
      pxPerSec: 44,
      snapping: true,
      showSafeArea: false,
      modal: null,
      toasts: [],

      past: [],
      future: [],

      ai: initialAI,

      /* ---------- histórico */
      checkpoint,
      undo: () => {
        const s = get();
        if (!s.past.length) return;
        const prev = s.past[s.past.length - 1];
        historyKey = null;
        set({ past: s.past.slice(0, -1), future: [snap(s), ...s.future].slice(0, 100), ...prev, duration: computeDuration(prev.clips) });
      },
      redo: () => {
        const s = get();
        if (!s.future.length) return;
        const next = s.future[0];
        historyKey = null;
        set({ future: s.future.slice(1), past: [...s.past, snap(s)], ...next, duration: computeDuration(next.clips) });
      },

      /* ---------- UI */
      toast,
      setLeftTab: (leftTab) => set({ leftTab }),
      setInspectorTab: (inspectorTab) => set({ inspectorTab }),
      setZoom: (pxPerSec) => set({ pxPerSec: clamp(pxPerSec, 8, 260) }),
      toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
      toggleSafeArea: () => set((s) => ({ showSafeArea: !s.showSafeArea })),
      openModal: (modal) => set({ modal }),
      closeModal: () => set({ modal: null }),
      setExporting: (exporting) => set({ exporting }),
      setPreviewVolume: (previewVolume) => set({ previewVolume }),

      /* ---------- projeto */
      setProject: (patch, key = null) => {
        checkpoint(key);
        set((s) => ({ project: { ...s.project, ...patch } }));
      },
      setAspect: (aspect) => {
        checkpoint();
        set((s) => ({ project: { ...s.project, aspect } }));
      },

      /* ---------- reprodução */
      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
      seek: (t) => set((s) => ({ currentTime: clamp(t, 0, s.duration), seekNonce: s.seekNonce + 1 })),
      setTimeFromClock: (t) => set({ currentTime: t }),
      stepFrame: (dir) => {
        const s = get();
        set({ isPlaying: false });
        get().seek(snapToFrame(s.currentTime + dir * FRAME));
      },

      /* ---------- seleção */
      select: (selectedClipId) => set({ selectedClipId, inspectorTab: null }),

      /* ---------- trilhas */
      toggleTrack: (trackId, key) => {
        checkpoint();
        set((s) => ({ tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, [key]: !t[key] } : t)) }));
      },

      /* ---------- ativos */
      addAssets: (assets) => set((s) => ({ assets: [...assets, ...s.assets] })),

      addAssetToTimeline: (assetId, { trackId, start } = {}) => {
        const s = get();
        const asset = s.assets.find((a) => a.id === assetId);
        if (!asset) return null;
        const kind = clipKindForAsset(asset);
        let track = trackId ? trackById(trackId) : null;
        const desired = Math.max(0, start ?? s.currentTime);
        if (track && !accepts(track, kind)) {
          toast(`“${track.name}” não aceita esse tipo de mídia`, 'warn');
          return null;
        }
        if (!track) {
          const prefs =
            kind === 'audio'
              ? asset.synth?.kind === 'sfx'
                ? ['trk-sfx', 'trk-music', 'trk-voice']
                : asset.category === 'Voz'
                  ? ['trk-voice', 'trk-music']
                  : ['trk-music', 'trk-voice', 'trk-sfx']
              : ['trk-main', 'trk-pip'];
          const dur = asset.type === 'image' ? 5 : asset.duration;
          track = trackById(prefs.find((id) => findFreeStart(onTrack(id), desired, dur) === desired) || prefs[0]);
        }
        if (track.locked) {
          toast('Trilha bloqueada', 'warn');
          return null;
        }
        const clip = mediaClip(asset, track, desired);
        clip.start = findFreeStart(onTrack(track.id), desired, clip.duration);
        checkpoint();
        commitClips([...s.clips, clip], { selectedClipId: clip.id });
        toast(`“${asset.name}” adicionado em ${track.name}`);
        return clip.id;
      },

      /* ---------- clipes */
      updateClip: (id, patch, key = undefined) => {
        if (key !== false) checkpoint(key || null);
        commitClips(patchClip(id, (c) => ({ ...c, ...(typeof patch === 'function' ? patch(c) : patch) })));
      },

      updateClipDeep: (id, group, patch, key = undefined) => {
        if (key !== false) checkpoint(key || null);
        commitClips(patchClip(id, (c) => ({ ...c, [group]: { ...(c[group] || {}), ...patch } })));
      },

      moveClip: (id, desiredStart, targetTrackId = null, { history = true } = {}) => {
        const s = get();
        const clip = clipById(id);
        if (!clip) return;
        let trackId = clip.trackId;
        if (targetTrackId && targetTrackId !== clip.trackId) {
          const t = trackById(targetTrackId);
          if (accepts(t, clip.kind) && !t.locked) trackId = targetTrackId;
        }
        const start = findFreeStart(onTrack(trackId, id), Math.max(0, desiredStart), clip.duration, id);
        if (history) checkpoint();
        const moved = { ...clip, start, trackId };
        const fromTrack = trackById(clip.trackId);
        const toTrack = trackById(trackId);
        if (fromTrack.kind !== toTrack.kind && (toTrack.kind === 'overlay' || fromTrack.kind === 'overlay')) {
          moved.transform = toTrack.kind === 'overlay' ? { ...clip.transform, scale: 0.4, x: 0.27, y: -0.22 } : { ...clip.transform, scale: 1, x: 0, y: 0 };
        }
        commitClips(s.clips.map((c) => (c.id === id ? moved : c)));
      },

      trimClip: (id, edge, t, { history = true } = {}) => {
        const clip = clipById(id);
        if (!clip) return;
        const neighbors = onTrack(clip.trackId, id);
        const eff = (clip.speed || 1) * (hasCurve(clip) ? curveAverage(clip.speedCurve.points) : 1);
        const isMedia = clip.kind === 'video' || clip.kind === 'audio';
        const end = clip.start + clip.duration;
        if (history) checkpoint();
        if (edge === 'left') {
          const prevEnd = Math.max(0, ...neighbors.filter((c) => c.start + c.duration <= clip.start + 1e-3).map((c) => c.start + c.duration));
          let min = prevEnd;
          if (isMedia) min = Math.max(min, clip.start - clip.trimIn / eff);
          const ns = clamp(t, min, end - 0.1);
          const delta = ns - clip.start;
          commitClips(
            patchClip(id, (c) => ({
              ...c,
              start: ns,
              duration: end - ns,
              trimIn: isMedia ? Math.max(0, c.trimIn + delta * eff) : c.trimIn,
              keyframes: (c.keyframes || []).map((k) => ({ ...k, t: k.t - delta })).filter((k) => k.t >= -1e-6),
              text: c.text?.words ? { ...c.text, words: c.text.words.map((w) => ({ ...w, start: w.start - delta, end: w.end - delta })) } : c.text,
            })),
          );
        } else {
          const nextStart = Math.min(Infinity, ...neighbors.filter((c) => c.start >= end - 1e-3).map((c) => c.start));
          let max = nextStart;
          if (isMedia && Number.isFinite(clip.sourceDuration)) max = Math.min(max, clip.start + (clip.sourceDuration - clip.trimIn) / eff);
          const ne = clamp(t, clip.start + 0.1, max);
          commitClips(patchClip(id, (c) => ({ ...c, duration: ne - c.start })));
        }
      },

      splitAtPlayhead: () => {
        const s = get();
        const t = s.currentTime;
        const sel = clipById(s.selectedClipId);
        const valid = (c) => c && t - c.start > 0.05 && c.start + c.duration - t > 0.05;
        let targets = valid(sel) ? [sel] : s.clips.filter((c) => c.trackId === 'trk-main' && valid(c));
        targets = targets.filter((c) => !trackById(c.trackId)?.locked);
        if (!targets.length) {
          toast('Posicione o playhead sobre um clipe para dividir', 'warn');
          return;
        }
        checkpoint();
        let clips = s.clips;
        let lastRight = null;
        for (const c of targets) {
          const [l, r] = splitClip(c, t);
          clips = clips.flatMap((x) => (x.id === c.id ? [l, r] : [x]));
          lastRight = r.id;
        }
        commitClips(clips, { selectedClipId: lastRight });
      },

      deleteSelected: () => {
        const s = get();
        const sel = clipById(s.selectedClipId);
        if (!sel) {
          toast('Selecione um clipe para excluir', 'warn');
          return;
        }
        if (trackById(sel.trackId)?.locked) return toast('Trilha bloqueada', 'warn');
        checkpoint();
        const end = sel.start + sel.duration;
        // Trilha principal magnética: fecha o espaço deixado pelo clipe removido.
        const ripple = sel.trackId === 'trk-main';
        commitClips(
          s.clips
            .filter((c) => c.id !== sel.id)
            .map((c) => (ripple && c.trackId === 'trk-main' && c.start >= end - 1e-3 ? { ...c, start: Math.max(0, c.start - sel.duration) } : c)),
          { selectedClipId: null },
        );
      },

      duplicateSelected: () => {
        const s = get();
        const sel = clipById(s.selectedClipId);
        if (!sel) return toast('Selecione um clipe para duplicar', 'warn');
        const copy = { ...sel, id: uid('clip'), keyframes: (sel.keyframes || []).map((k) => ({ ...k, id: uid('kf') })) };
        copy.start = findFreeStart(onTrack(sel.trackId), sel.start + sel.duration, sel.duration);
        checkpoint();
        commitClips([...s.clips, copy], { selectedClipId: copy.id });
      },

      toggleClipDisabled: (id) => {
        checkpoint();
        commitClips(patchClip(id, (c) => ({ ...c, disabled: !c.disabled })));
      },

      /* ---------- keyframes & transformação */
      addKeyframe: () => {
        const s = get();
        const c = clipById(s.selectedClipId);
        if (!c || c.kind === 'audio') return toast('Selecione um clipe visual para adicionar keyframe', 'warn');
        const lt = s.currentTime - c.start;
        if (lt < 0 || lt > c.duration) return toast('Posicione o playhead dentro do clipe selecionado', 'warn');
        const existing = keyframeAt(c, lt);
        checkpoint();
        if (existing) {
          commitClips(patchClip(c.id, (x) => ({ ...x, keyframes: x.keyframes.filter((k) => k.id !== existing.id) })));
          return toast('Keyframe removido');
        }
        const cur = getTransformAt(c, lt);
        const values = Object.fromEntries(TRANSFORM_KEYS.map((k) => [k, cur[k]]));
        commitClips(patchClip(c.id, (x) => ({ ...x, keyframes: sortKeyframes([...(x.keyframes || []), { id: uid('kf'), t: lt, values }]) })));
        toast('◆ Keyframe adicionado — altere posição/escala/opacidade em outro ponto para animar');
      },

      removeKeyframe: (clipId, kfId) => {
        checkpoint();
        commitClips(patchClip(clipId, (x) => ({ ...x, keyframes: x.keyframes.filter((k) => k.id !== kfId) })));
      },

      setTransformProp: (clipId, key, value, historyKeyName) => {
        const s = get();
        const c = clipById(clipId);
        if (!c) return;
        checkpoint(historyKeyName || null);
        const lt = s.currentTime - c.start;
        if (c.keyframes?.length && lt >= 0 && lt <= c.duration) {
          const kf = keyframeAt(c, lt);
          if (kf) {
            commitClips(patchClip(clipId, (x) => ({ ...x, keyframes: x.keyframes.map((k) => (k.id === kf.id ? { ...k, values: { ...k.values, [key]: value } } : k)) })));
          } else {
            const cur = getTransformAt(c, lt);
            const values = { ...Object.fromEntries(TRANSFORM_KEYS.map((k) => [k, cur[k]])), [key]: value };
            commitClips(patchClip(clipId, (x) => ({ ...x, keyframes: sortKeyframes([...x.keyframes, { id: uid('kf'), t: lt, values }]) })));
          }
          return;
        }
        commitClips(patchClip(clipId, (x) => ({ ...x, transform: { ...x.transform, [key]: value } })));
      },

      /* ---------- velocidade */
      setSpeed: (clipId, speed, historyKeyName) => {
        const c = clipById(clipId);
        if (!c) return;
        checkpoint(historyKeyName || null);
        const span = clipSourceSpan(c);
        const avg = hasCurve(c) ? curveAverage(c.speedCurve.points) : 1;
        const sp = clamp(speed, 0.1, 10);
        commitClips(resizeWithRipple(get().clips, c, span / (sp * avg), { speed: sp }));
      },

      setSpeedCurve: (clipId, curveId, points = null) => {
        const c = clipById(clipId);
        if (!c) return;
        checkpoint(points ? `curve:${clipId}` : null);
        const span = clipSourceSpan(c);
        const curve = curveId === 'none' ? null : { id: curveId, points: points || getCurve(curveId).points };
        const avg = curve ? curveAverage(curve.points) : 1;
        commitClips(resizeWithRipple(get().clips, c, span / ((c.speed || 1) * avg), { speedCurve: curve }));
      },

      /* ---------- efeitos, transições, filtros, animações */
      toggleEffect: (effectId) => {
        const c = selectedVisual();
        if (!c) return toast('Selecione um clipe de vídeo ou imagem', 'warn');
        checkpoint();
        const has = c.effects.some((e) => e.id === effectId);
        commitClips(patchClip(c.id, (x) => ({ ...x, effects: has ? x.effects.filter((e) => e.id !== effectId) : [...x.effects, { id: effectId, intensity: 70 }] })), { selectedClipId: c.id });
        toast(has ? 'Efeito removido' : 'Efeito aplicado');
      },

      setEffectIntensity: (clipId, effectId, intensity) => {
        checkpoint(`fx:${clipId}:${effectId}`);
        commitClips(patchClip(clipId, (x) => ({ ...x, effects: x.effects.map((e) => (e.id === effectId ? { ...e, intensity } : e)) })));
      },

      applyTransition: (transitionId) => {
        const s = get();
        let c = clipById(s.selectedClipId);
        if (!c || !['video', 'overlay'].includes(trackById(c.trackId)?.kind)) {
          c = s.clips
            .filter((x) => x.trackId === 'trk-main' && x.start > 0.01)
            .sort((a, b) => Math.abs(a.start - s.currentTime) - Math.abs(b.start - s.currentTime))[0];
        }
        if (!c) return toast('Nenhum corte encontrado para aplicar a transição', 'warn');
        checkpoint();
        const same = c.transitionIn?.id === transitionId;
        commitClips(patchClip(c.id, (x) => ({ ...x, transitionIn: same ? null : { id: transitionId, duration: x.transitionIn?.duration || 0.5 } })), { selectedClipId: c.id });
        toast(same ? 'Transição removida' : `Transição aplicada em “${c.name}”`);
      },

      applyFilter: (filterId) => {
        const c = selectedVisual();
        if (!c) return toast('Selecione um clipe de vídeo ou imagem', 'warn');
        checkpoint();
        commitClips(patchClip(c.id, (x) => ({ ...x, filter: { id: filterId, intensity: x.filter?.intensity ?? 100 } })), { selectedClipId: c.id });
      },

      setAnimation: (clipId, slot, animId, duration) => {
        checkpoint();
        commitClips(
          patchClip(clipId, (x) => ({
            ...x,
            animation: { ...x.animation, [slot]: animId ? { id: animId, duration: duration ?? x.animation?.[slot]?.duration ?? (slot === 'loop' ? 0 : 0.5) } : null },
          })),
        );
      },

      /* ---------- texto & legendas */
      addText: (presetId = 'classic', content = 'Seu texto aqui') => {
        const s = get();
        const preset = TEXT_STYLES.find((p) => p.id === presetId) || TEXT_STYLES[0];
        const clip = textClip({ trackId: 'trk-text', start: s.currentTime, duration: 3, content, style: preset.style, name: `Texto · ${preset.name}` });
        clip.start = findFreeStart(onTrack('trk-text'), s.currentTime, clip.duration);
        checkpoint();
        commitClips([...s.clips, clip], { selectedClipId: clip.id });
      },

      generateCaptions: async (presetId = 'tiktok', { maxWords = 4 } = {}) => {
        const transcript = await ensureTranscript();
        if (!transcript.words.length) {
          toast('Nenhuma fala encontrada. Cole a transcrição na aba IA Motion.', 'warn');
          return 0;
        }
        const s = get();
        const preset = CAPTION_PRESETS.find((p) => p.id === presetId) || CAPTION_PRESETS[0];
        const portrait = s.project.aspect === '9:16' || s.project.aspect === '4:5';
        const chunks = buildCaptionChunks(transcript, { maxWords, maxDur: 1.9 });
        const clips = chunks.map((ch) => captionClip(ch, preset, 'trk-captions', portrait ? 0.26 : 0.33));
        checkpoint();
        commitClips([...s.clips.filter((c) => !(c.trackId === 'trk-captions' && c.autoCaption)), ...clips], { modal: null });
        toast(`💬 ${clips.length} legendas automáticas geradas (${preset.name})`, 'success');
        return clips.length;
      },

      autoCutSilences: async (minPause = 0.55) => {
        const transcript = await ensureTranscript();
        if (!transcript.words.length) return toast('Auto Cut precisa de fala transcrita', 'warn');
        const w = transcript.words;
        const ranges = [];
        if (w[0].start > 0.5) ranges.push([0.08, w[0].start - 0.12]);
        for (let i = 1; i < w.length; i++) {
          const gap = w[i].start - w[i - 1].end;
          if (gap > minPause) ranges.push([w[i - 1].end + 0.14, w[i].start - 0.12]);
        }
        const valid = ranges.filter(([a, b]) => b - a > 0.2);
        if (!valid.length) return toast('Nenhuma pausa longa encontrada');
        checkpoint();
        // A música de fundo não é cortada (continua corrida); o resto é cortado em ripple.
        const all = get().clips;
        const music = all.filter((c) => c.trackId === 'trk-music');
        let clips = all.filter((c) => c.trackId !== 'trk-music');
        let removed = 0;
        for (const [a, b] of [...valid].reverse()) {
          clips = rippleDeleteRange(clips, a, b);
          removed += b - a;
        }
        const end = computeDuration(clips);
        const trimmedMusic = music
          .filter((c) => c.start < end - 0.1)
          .map((c) => (c.start + c.duration > end ? { ...c, duration: end - c.start } : c));
        commitClips([...clips, ...trimmedMusic], { selectedClipId: null });
        set((s) => ({ ai: { ...s.ai, analysis: null, status: 'idle', steps: PIPELINE_STEPS.map((x) => ({ ...x, status: 'pending' })) } }));
        get().seek(0);
        toast(`✂️ Auto Cut: ${valid.length} pausas removidas (−${removed.toFixed(1)}s). Rode a análise de IA novamente.`, 'success');
      },

      /* ---------- IA Motion */
      setAIPrompt: (prompt) => set((s) => ({ ai: { ...s.ai, prompt } })),
      setAIScript: (scriptText) => set((s) => ({ ai: { ...s.ai, scriptText } })),
      setAIOption: (key, value) => set((s) => ({ ai: { ...s.ai, options: { ...s.ai.options, [key]: value } } })),

      runAIAnalysis: async ({ autoGenerate = true } = {}) => {
        const s0 = get();
        if (s0.ai.status === 'analyzing') return;
        set((s) => ({ isPlaying: false, ai: { ...s.ai, status: 'analyzing', progress: 0, error: null, steps: PIPELINE_STEPS.map((x) => ({ ...x, status: 'pending' })) } }));
        const setStep = (id, status) => set((s) => ({ ai: { ...s.ai, steps: s.ai.steps.map((x) => (x.id === id ? { ...x, status } : x)) } }));
        try {
          const st = get();
          const analysis = await analyzeContext(st, {
            scriptText: st.ai.scriptText,
            onStep: setStep,
            onProgress: (progress) => set((s) => ({ ai: { ...s.ai, progress } })),
          });
          set((s) => ({ ai: { ...s.ai, analysis } }));
          setStep('generate', 'running');
          await new Promise((r) => setTimeout(r, 380));
          if (autoGenerate) get().generateAIMotions({ prompt: '', scope: 'all', silent: true });
          setStep('generate', 'done');
          set((s) => ({ ai: { ...s.ai, status: 'ready', progress: 1, lastRun: Date.now() } }));
          analysis.warnings.forEach((w) => toast(w, 'warn'));
        } catch (e) {
          console.error(e);
          set((s) => ({ ai: { ...s.ai, status: 'error', error: String(e?.message || e) } }));
          toast('Falha na análise de IA', 'error');
        }
      },

      generateAIMotions: async ({ prompt, scope, silent = false } = {}) => {
        let s = get();
        if (!s.ai.analysis) {
          await get().runAIAnalysis({ autoGenerate: false });
          s = get();
          if (!s.ai.analysis) return;
        }
        const text = prompt ?? s.ai.prompt;
        const spec = parsePrompt(text);
        const sc = scope || spec.scope;
        let range = null;
        if (sc === 'current') {
          const t = s.currentTime;
          const sentences = s.ai.analysis.transcript.sentences;
          const sent = sentences.find((x) => t >= x.start - 0.3 && t <= x.end + 0.3) || sentences.find((x) => x.start >= t);
          range = sent ? { start: sent.start - 0.2, end: sent.end + 0.3 } : { start: Math.max(0, t - 0.5), end: t + 3 };
        } else if (sc === 'selection') {
          const c = clipById(s.selectedClipId);
          if (c) range = { start: c.start, end: c.start + c.duration };
        }
        const mainClips = s.clips.filter((c) => c.trackId === 'trk-main' && !c.disabled).sort((a, b) => a.start - b.start);
        const specs = generateMotions(s.ai.analysis, { options: { ...s.ai.options, prompt: text }, spec, aspect: s.project.aspect, mainClips, range });
        const overlapsRange = (c) => !range || (c.start < range.end && c.start + c.duration > range.start);
        const kept = s.clips.filter((c) => !(c.ai && overlapsRange(c)));
        const created = [];
        const sfxClips = [];
        for (const sp of specs) {
          if (sp.lane === 'sfx') {
            const asset = s.assets.find((a) => a.id === sp.assetId);
            if (!asset) continue;
            const clip = { ...mediaClip(asset, trackById('trk-sfx'), sp.start), ai: true, audio: { volume: 0.55, fadeIn: 0, fadeOut: 0, muted: false, denoise: false, denoiseLevel: 60 } };
            const busy = [...kept, ...sfxClips].some((c) => c.trackId === 'trk-sfx' && c.start < clip.start + clip.duration && c.start + c.duration > clip.start);
            if (!busy) sfxClips.push(clip);
            continue;
          }
          const trackId = AI_LANES[sp.lane];
          const clip = motionClip(sp, trackId);
          const busy = kept.some((c) => c.trackId === trackId && c.start < clip.start + clip.duration && c.start + c.duration > clip.start);
          if (!busy) created.push(clip);
        }
        checkpoint();
        commitClips([...kept, ...created, ...sfxClips], { selectedClipId: null });
        set((x) => ({ ai: { ...x.ai, lastRun: Date.now() } }));
        startAIRender(created.map((c) => c.id));
        if (!silent || created.length) toast(`✨ ${created.length} motions gerados${range ? ' para o trecho atual' : ''}${spec.styleIds.length ? ` · estilo ${mergeStyles(spec.styleIds).name}` : ''}`, 'success');
        return created.length;
      },

      clearAIMotions: () => {
        const s = get();
        checkpoint();
        commitClips(
          s.clips.filter((c) => !c.ai),
          { selectedClipId: null },
        );
        toast('Motions de IA removidos');
      },

      regenerateMotionClip: (clipId, promptText) => {
        const c = clipById(clipId);
        if (!c?.motion) return;
        const spec = parsePrompt(promptText);
        const tpl = getTemplate(c.motion.templateId);
        const styleIds = spec.styleIds.length ? spec.styleIds : c.motion.styleIds;
        const style = mergeStyles(styleIds);
        let templateId = c.motion.templateId;
        if (tpl.category === 'sticker' && spec.forcedTemplates[0]) templateId = spec.forcedTemplates[0];
        if (tpl.category === 'typography' && spec.styleIds.length) templateId = style.typography;
        if (tpl.category === 'transition' && spec.styleIds.length) templateId = style.transition;
        checkpoint();
        commitClips(
          patchClip(clipId, (x) => ({
            ...x,
            name: getTemplate(templateId).name,
            motion: { ...x.motion, templateId, styleIds, color: spec.color ?? x.motion.color, intensity: Math.round(clamp((x.motion.intensity ?? 70) * spec.intensity, 15, 140)), prompt: promptText, generatedAt: Date.now() },
          })),
        );
        startAIRender([clipId]);
        toast('✨ Motion regenerado com o novo prompt', 'success');
      },

      addMotionFromLibrary: (templateId) => {
        const s = get();
        const tpl = getTemplate(templateId);
        const lane = tpl.category === 'sticker' ? 'sticker' : tpl.category === 'typography' ? 'typography' : 'camera';
        const trackId = AI_LANES[lane];
        const duration = tpl.category === 'transition' ? 0.5 : tpl.category === 'camera' ? 1.2 : 2.4;
        const clip = baseClip({
          trackId,
          kind: 'motion',
          name: tpl.name,
          start: s.currentTime,
          duration,
          motion: {
            templateId,
            category: tpl.category,
            styleIds: ['vibrante'],
            intensity: 70,
            text: tpl.category === 'typography' ? 'Seu destaque aqui' : undefined,
            highlights: ['destaque'],
            label: null,
            reason: 'Adicionado manualmente da biblioteca de motions',
            confidence: 1,
            params: { focusX: 0.5, focusY: 0.45 },
          },
          transform: { x: 0, y: tpl.category === 'typography' ? -0.3 : 0, scale: 1, rotation: 0, opacity: 1 },
          ai: true,
        });
        clip.start = findFreeStart(onTrack(trackId), s.currentTime, duration);
        checkpoint();
        commitClips([...s.clips, clip], { selectedClipId: clip.id });
      },
    };
  }),
);

/* Seletores utilitários */
export const selectSelectedClip = (s) => s.clips.find((c) => c.id === s.selectedClipId) || null;
