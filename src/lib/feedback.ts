// Subtle audio + haptic feedback for things that happen *to* the user while they're
// in the app (a new notification, an incoming chat message) — not for actions they
// just took themselves (those already have toast feedback). Sounds are synthesized
// with the Web Audio API so there's no audio file to host/license.
//
// Vibration only works on Android Chrome-family browsers — iOS Safari has never
// implemented the Vibration API (even as a PWA), so vibrate() silently no-ops there.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

function tone(ctx: AudioContext, freq: number, startAt: number, duration: number, peakGain: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function ensureRunning(ctx: AudioContext) {
  if (ctx.state === "suspended") void ctx.resume();
}

/** Two-note "ding" for a new notification. */
export function playNotifySound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  ensureRunning(ctx);
  const now = ctx.currentTime;
  tone(ctx, 880, now, 0.16, 0.08);
  tone(ctx, 1320, now + 0.09, 0.18, 0.06);
}

/** Single soft blip for an incoming chat message. */
export function playChatSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  ensureRunning(ctx);
  tone(ctx, 660, ctx.currentTime, 0.12, 0.05);
}

/** Feature-detected vibration; no-ops where unsupported (notably iOS Safari). */
export function vibrate(pattern: number | number[] = 15) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
