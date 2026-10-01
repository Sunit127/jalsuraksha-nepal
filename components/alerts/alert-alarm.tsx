"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, Volume2 } from "lucide-react";
import { useCitizenData } from "@/components/shared/citizen-data";
import { alarmSoundReady, playAlarmBurst, unlockAlarmSound } from "@/lib/utilities/alarm-sound";
import { formatClock, timeAgo } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types/domain";

const KEY = "js:alert-alarm:v1";
const BURST_MS = 1500;

const TONE: Record<Alert["severity"], string> = {
  danger: "bg-danger",
  high: "bg-high-strong",
  watch: "bg-watch",
  info: "bg-info",
};

/** Alert ids this device has closed. `null` until read (no alarm before that). */
function readAcked(): Set<string> | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return new Set();
  }
}

function writeAcked(ids: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    // Storage unavailable: the alarm is closed for this visit only.
  }
}

/**
 * Full-screen alarm for alerts published by the control centre. It repeats a
 * "beep-beep" (and vibrates) until the person closes it. Alerts that arrive
 * while the app is closed ring the next time it opens, if still active. On a
 * device's first visit the alerts already active are treated as seen.
 */
export function AlertAlarm() {
  const { alerts } = useCitizenData();
  const [acked, setAcked] = useState<Set<string> | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const stored = readAcked();
    const initial = stored ?? new Set(alerts.map((a) => a.id));
    if (!stored) writeAcked(initial);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only storage after mount
    setAcked(initial);
    // Only on mount: later alerts must ring, not be marked as seen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sound needs a user gesture first; any tap or key press in the app unlocks it.
  useEffect(() => {
    const unlock = () => {
      unlockAlarmSound();
      setTimeout(() => setSoundOn(alarmSoundReady()), 100);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchend", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchend", unlock);
    };
  }, []);

  const pending = acked ? alerts.filter((a) => !acked.has(a.id)) : [];
  const current = pending[0] ?? null;
  const currentId = current?.id;
  const urgent = current?.severity === "danger" || current?.severity === "high";

  // Repeat until closed.
  useEffect(() => {
    if (!currentId) return;
    const ring = () => {
      playAlarmBurst(urgent);
      if ("vibrate" in navigator) navigator.vibrate?.([250, 120, 250]);
      setSoundOn(alarmSoundReady());
    };
    ring();
    const t = setInterval(ring, BURST_MS);
    closeRef.current?.focus();
    return () => {
      clearInterval(t);
      if ("vibrate" in navigator) navigator.vibrate?.(0);
    };
  }, [currentId, urgent]);

  if (!current) return null;

  function close() {
    if (!acked || !current) return;
    const next = new Set(acked).add(current.id);
    writeAcked(next);
    setAcked(next);
  }

  const area = [current.municipality, current.district, current.river_basin].filter(Boolean).join(" · ");
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-alarm-title"
      aria-describedby="alert-alarm-body"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      data-testid="alert-alarm"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className={cn("flex items-center gap-3 px-5 py-4 text-white", TONE[current.severity])}>
          <BellRing className="size-8 shrink-0 animate-bounce" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest">{current.severity} alert</p>
            <h2 id="alert-alarm-title" className="text-lg font-extrabold leading-tight">
              {current.title}
            </h2>
          </div>
        </div>
        <div className="grid gap-3 px-5 py-4">
          <p id="alert-alarm-body" className="text-sm whitespace-pre-line">
            {current.description}
          </p>
          <p className="text-xs text-muted-foreground">
            {area && `${area} · `}
            {current.source} · {formatClock(current.created_at)} NPT ({timeAgo(current.created_at)})
          </p>
          {!soundOn && (
            <p className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Volume2 className="size-4 shrink-0" aria-hidden /> Tap anywhere to sound the alarm.
            </p>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="h-12 rounded-xl bg-foreground text-base font-bold text-background active:scale-[.98]"
          >
            I have read this — stop alarm
          </button>
          <div className="flex items-center justify-between text-xs">
            <Link href="/citizen/alerts" onClick={close} className="font-semibold text-primary">
              View all alerts
            </Link>
            {pending.length > 1 && <span className="text-muted-foreground">{pending.length - 1} more alert(s)</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
