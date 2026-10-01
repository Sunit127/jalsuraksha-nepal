"use client";

/**
 * Alarm tone for citizen alerts, generated with Web Audio (no audio file).
 * Browsers only let a page make sound after the person has interacted with
 * it, so the context is created/resumed on the first tap or key press.
 */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = AudioCtx ? new AudioCtx() : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a user gesture (tap, key press) so later alarms can sound. */
export function unlockAlarmSound() {
  const c = context();
  if (c && c.state === "suspended") void c.resume().catch(() => undefined);
}

/** True once the browser lets the page play sound. */
export function alarmSoundReady(): boolean {
  return ctx?.state === "running";
}

/** One "beep-beep" burst (two short high tones). */
export function playAlarmBurst(urgent: boolean) {
  const c = context();
  if (!c || c.state !== "running") return;
  const freq = urgent ? 1040 : 880;
  for (const offset of [0, 0.28]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    const start = c.currentTime + offset;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.2);
  }
}
