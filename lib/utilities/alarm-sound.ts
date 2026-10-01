"use client";

/**
 * Alarm siren for citizen alerts. The sound is synthesised once into a WAV
 * file and played by a looping <audio> element: media playback is not muted
 * by the iPhone silent switch (Web Audio is), keeps playing in a background
 * tab, and is driven into soft clipping for maximum loudness.
 *
 * Browsers only allow sound after the person has tapped the page, so
 * unlockAlarmSound() must run inside a tap/key handler.
 */
const RATE = 22_050;
const LOOP_S = 1.5;

type Kind = "urgent" | "normal";
const players: Partial<Record<Kind, HTMLAudioElement>> = {};
let ringing: Kind | null = null;
let unlocked = false;

/** One loop: rising yelps (urgent) or sharp beeps (normal), loud and harsh. */
function synth(kind: Kind): Float32Array {
  const out = new Float32Array(Math.round(RATE * LOOP_S));
  const steps =
    kind === "urgent"
      ? [0, 0.5, 1.0].map((at) => ({ at, len: 0.46, from: 650, to: 1700 }))
      : [0, 0.25, 0.5, 0.75].map((at) => ({ at, len: 0.18, from: 1250, to: 1250 }));
  for (const { at, len, from, to } of steps) {
    const start = Math.round(at * RATE);
    const n = Math.round(len * RATE);
    let phase = 0;
    for (let i = 0; i < n && start + i < out.length; i++) {
      const t = i / n;
      const freq = from * Math.pow(to / from, t);
      phase = (phase + freq / RATE) % 1;
      const saw = 2 * phase - 1;
      const square = phase < 0.5 ? 1 : -1;
      // 5 ms fade in/out avoids clicks; everything else is full level.
      const edge = Math.min(1, i / (0.005 * RATE), (n - i) / (0.005 * RATE));
      out[start + i] = 0.5 * saw + 0.5 * square;
      out[start + i] *= edge;
    }
  }
  // Drive into soft clipping, then normalise with headroom for resampling.
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.tanh(3 * out[i]);
    peak = Math.max(peak, Math.abs(out[i]));
  }
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] = (out[i] / peak) * 0.85;
  return out;
}

function wavUrl(samples: Float32Array): string {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

function player(kind: Kind): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  let p = players[kind];
  if (!p) {
    p = new Audio(wavUrl(synth(kind)));
    p.loop = true;
    p.preload = "auto";
    p.volume = 1;
    players[kind] = p;
  }
  return p;
}

/** Media session, so iOS treats the siren as playback (ignores silent switch). */
function preferPlayback() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
  } catch {
    // Not supported: the <audio> element is already media playback.
  }
}

/**
 * Call inside a tap/key handler. Briefly plays both sirens muted so the
 * browser allows them to start later without a tap.
 */
export function unlockAlarmSound() {
  if (unlocked) return;
  preferPlayback();
  for (const kind of ["urgent", "normal"] as const) {
    const p = player(kind);
    if (!p || ringing === kind) continue;
    p.muted = true;
    p.play()
      .then(() => {
        if (ringing !== kind) {
          p.pause();
          p.currentTime = 0;
        }
        p.muted = false;
        unlocked = true;
      })
      .catch(() => {
        p.muted = false;
      });
  }
}

export function alarmSoundUnlocked(): boolean {
  return unlocked;
}

/** Starts the looping siren. Resolves false when the browser blocked it. */
export function startAlarm(urgent: boolean): Promise<boolean> {
  const kind: Kind = urgent ? "urgent" : "normal";
  const other = players[urgent ? "normal" : "urgent"];
  if (other) other.pause();
  const p = player(kind);
  if (!p) return Promise.resolve(false);
  preferPlayback();
  ringing = kind;
  p.muted = false;
  p.volume = 1;
  if (!p.paused) return Promise.resolve(true);
  p.currentTime = 0;
  return p.play().then(
    () => {
      unlocked = true;
      return true;
    },
    () => false,
  );
}

export function stopAlarm() {
  ringing = null;
  for (const p of Object.values(players)) {
    p.pause();
    p.currentTime = 0;
  }
}
