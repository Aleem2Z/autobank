"use client";

/**
 * Tiny synthesized Web Audio engine for notification cues.
 *
 * Design goals:
 *  - No asset files: every sound is generated from oscillators + envelopes.
 *  - Subtle peak gain (~0.18) — these MUST NOT be annoying.
 *  - Mute persists in localStorage("autobank-muted") and reacts to changes
 *    from other tabs via the `storage` event.
 *  - iOS Safari requires AudioContext.resume() inside a user gesture; we
 *    install a one-time `pointerdown` listener at module load to satisfy that.
 *
 * All public functions are no-ops on the server.
 */

export type SoundName =
  | "prompt"
  | "success"
  | "error"
  | "coins"
  | "join";

const STORAGE_KEY = "autobank-muted";
const PEAK_GAIN = 0.18;

let audioContext: AudioContext | null = null;
let unlocked = false;
let muted: boolean | null = null; // lazy-init

const isBrowser = typeof window !== "undefined";

function readMuteFromStorage(): boolean {
  if (!isBrowser) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function ensureMuteInitialized(): void {
  if (muted !== null) return;
  muted = readMuteFromStorage();
  if (!isBrowser) return;
  // React to mute toggles in other tabs.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    muted = e.newValue === "1";
  });
}

function getContext(): AudioContext | null {
  if (!isBrowser) return null;
  if (audioContext) return audioContext;
  type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };
  const Ctor =
    window.AudioContext ??
    (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioContext = new Ctor();
  } catch {
    audioContext = null;
  }
  return audioContext;
}

export function isMuted(): boolean {
  ensureMuteInitialized();
  return muted === true;
}

export function setMuted(next: boolean): void {
  ensureMuteInitialized();
  muted = next;
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* localStorage unavailable — keep in-memory state */
  }
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function unlockAudio(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume().then(() => {
      unlocked = true;
    });
  } else {
    unlocked = true;
  }
}

// One-time gesture-driven unlock so iOS Safari permits playback.
if (isBrowser) {
  const onFirstGesture = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", onFirstGesture);
    window.removeEventListener("keydown", onFirstGesture);
  };
  window.addEventListener("pointerdown", onFirstGesture, { once: true });
  window.addEventListener("keydown", onFirstGesture, { once: true });
}

// ---------- low-level synth helpers ----------

interface ToneSpec {
  freq: number;
  start: number; // seconds offset from now
  duration: number; // seconds
  type?: OscillatorType;
  gain?: number; // peak gain (0..1)
  attack?: number; // seconds
  release?: number; // seconds
}

function playTone(ctx: AudioContext, spec: ToneSpec): void {
  const {
    freq,
    start,
    duration,
    type = "sine",
    gain = PEAK_GAIN,
    attack = 0.005,
    release = 0.06,
  } = spec;

  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + attack);
  env.gain.setValueAtTime(gain, t0 + Math.max(attack, duration - release));
  env.gain.linearRampToValueAtTime(0, t0 + duration);

  osc.connect(env).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// ---------- preset envelopes ----------

function ding(ctx: AudioContext): void {
  // Ascending two-tone "incoming!"
  playTone(ctx, { freq: 880, start: 0, duration: 0.1, type: "sine" });
  playTone(ctx, { freq: 1320, start: 0.09, duration: 0.12, type: "sine" });
}

function arpeggio(ctx: AudioContext, freqs: number[], step: number): void {
  freqs.forEach((f, i) => {
    playTone(ctx, {
      freq: f,
      start: i * step,
      duration: step + 0.04,
      type: "triangle",
      gain: PEAK_GAIN * 0.85,
      release: 0.08,
    });
  });
}

function descendingHarsh(ctx: AudioContext): void {
  playTone(ctx, {
    freq: 440,
    start: 0,
    duration: 0.12,
    type: "square",
    gain: PEAK_GAIN * 0.7,
  });
  playTone(ctx, {
    freq: 220,
    start: 0.11,
    duration: 0.16,
    type: "square",
    gain: PEAK_GAIN * 0.7,
    release: 0.1,
  });
}

function sparkle(ctx: AudioContext): void {
  // Quick high-frequency 4-note sparkle ("ka-ching"-ish)
  const notes = [1568, 1865, 2349, 2794];
  notes.forEach((f, i) => {
    playTone(ctx, {
      freq: f,
      start: i * 0.05,
      duration: 0.09,
      type: "triangle",
      gain: PEAK_GAIN * 0.65,
      attack: 0.003,
      release: 0.06,
    });
  });
}

function warmTone(ctx: AudioContext): void {
  playTone(ctx, {
    freq: 660,
    start: 0,
    duration: 0.25,
    type: "sine",
    gain: PEAK_GAIN * 0.75,
    attack: 0.08,
    release: 0.12,
  });
}

// ---------- public dispatch ----------

export function playSound(name: SoundName): void {
  if (!isBrowser) return;
  ensureMuteInitialized();
  if (muted) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    // No user gesture yet — silently skip rather than queue.
    return;
  }

  switch (name) {
    case "prompt":
      ding(ctx);
      return;
    case "success":
      // C5 - E5 - G5
      arpeggio(ctx, [523.25, 659.25, 783.99], 0.06);
      return;
    case "error":
      descendingHarsh(ctx);
      return;
    case "coins":
      sparkle(ctx);
      return;
    case "join":
      warmTone(ctx);
      return;
  }
}
