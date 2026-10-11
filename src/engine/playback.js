/**
 * Controlador de reprodução: liga o estado global (isPlaying / seek) ao relógio de áudio,
 * agenda o áudio no WebAudio e avança o playhead a cada quadro.
 */
import { useEditorStore } from '../store/useEditorStore';
import { ensureContext, schedule, stopAll, audioNow, onBufferLoaded } from './audioEngine';
import { tickDemoVoice, stopDemoVoice } from './demoVoice';
import { pauseAll } from './mediaPool';

let raf = null;
let anchorClock = 0;
let anchorTimeline = 0;
let useAudioClock = false;
let rescheduleTimer = null;
let initialized = false;

const perfNow = () => performance.now() / 1000;
const clockNow = () => (useAudioClock ? audioNow() : perfNow());

function anchor(from) {
  const s = useEditorStore.getState();
  const ctx = ensureContext();
  const a = schedule(s, from);
  anchorTimeline = from;
  if (a !== null && ctx && ctx.state === 'running') {
    useAudioClock = true;
    anchorClock = a;
  } else {
    useAudioClock = false;
    anchorClock = perfNow();
  }
}

function loop() {
  raf = requestAnimationFrame(loop);
  const s = useEditorStore.getState();
  if (!s.isPlaying) return;
  let t = anchorTimeline + Math.max(0, clockNow() - anchorClock);
  if (t >= s.duration) {
    s.setTimeFromClock(s.duration);
    s.pause();
    return;
  }
  s.setTimeFromClock(t);
  tickDemoVoice(s, t);
}

function start() {
  const s = useEditorStore.getState();
  let from = s.currentTime;
  if (from >= s.duration - 0.02) {
    from = 0;
    s.setTimeFromClock(0);
  }
  anchor(from);
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}

function stop() {
  cancelAnimationFrame(raf);
  raf = null;
  stopAll();
  stopDemoVoice();
  pauseAll();
}

function restartFromCurrent() {
  const s = useEditorStore.getState();
  stopDemoVoice();
  anchor(s.currentTime);
}

export function initPlayback() {
  if (initialized) return;
  initialized = true;
  const store = useEditorStore;
  store.subscribe(
    (s) => s.isPlaying,
    (playing) => (playing ? start() : stop()),
  );
  store.subscribe(
    (s) => s.seekNonce,
    () => {
      if (store.getState().isPlaying) restartFromCurrent();
    },
  );
  const reschedule = () => {
    clearTimeout(rescheduleTimer);
    rescheduleTimer = setTimeout(() => {
      if (store.getState().isPlaying) restartFromCurrent();
    }, 120);
  };
  store.subscribe((s) => s.clips, reschedule);
  store.subscribe((s) => s.tracks, reschedule);
  onBufferLoaded(reschedule);
}
