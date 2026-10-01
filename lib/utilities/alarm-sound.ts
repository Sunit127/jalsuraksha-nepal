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

/**
 * One alarm burst (~1.35 s, repeated every 1.5 s so it sounds continuous).
 * Two detuned harsh oscillators through a compressor for maximum loudness
 * without distortion.
 * - urgent (high/danger): three fast rising siren "yelps" (650 → 1600 Hz).
 * - other alerts: three sharp high beeps.
 */
export function playAlarmBurst(urgent: boolean) {
  const c = context();
  if (!c || c.state !== "running") return;

  const compressor = c.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 0;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.1;
  const master = c.createGain();
  master.gain.value = 1;
  master.connect(compressor).connect(c.destination);

  const now = c.currentTime;
  const steps = urgent
    ? [0, 0.45, 0.9].map((at) => ({ at, len: 0.42, from: 650, to: 1600 }))
    : [0, 0.3, 0.6].map((at) => ({ at, len: 0.2, from: 1150, to: 1150 }));

  for (const { at, len, from, to } of steps) {
    const start = now + at;
    const end = start + len;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(0.9, start + 0.015);
    env.gain.setValueAtTime(0.9, end - 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    env.connect(master);
    for (const [type, detune] of [["sawtooth", 0], ["square", 12]] as const) {
      const osc = c.createOscillator();
      osc.type = type;
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(from, start);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, end);
      osc.connect(env);
      osc.start(start);
      osc.stop(end + 0.01);
    }
  }
}
